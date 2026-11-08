-- PREPARED ONLY. Apply through the approved migration workflow after review; not applied in this repair round.
CREATE TABLE public.quota_limits (kind text PRIMARY KEY CHECK(kind IN ('render','chat')), daily_limit integer NOT NULL CHECK(daily_limit>0));
GRANT SELECT ON public.quota_limits TO authenticated;
GRANT ALL ON public.quota_limits TO service_role;
ALTER TABLE public.quota_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read free quota settings" ON public.quota_limits FOR SELECT TO authenticated USING(true);
-- Configuration data belongs in a separate approved data operation when activated:
-- INSERT INTO public.quota_limits(kind,daily_limit) VALUES ('render',3),('chat',15);
CREATE TABLE public.quota_reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('render','chat')),
 request_id uuid NOT NULL, fingerprint text NOT NULL, analysis_id uuid,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','completed','released','uncertain')),
 stage text NOT NULL DEFAULT 'reserved', created_at timestamptz NOT NULL DEFAULT now(), result jsonb,
 UNIQUE(user_id,kind,request_id)
);
GRANT ALL ON public.quota_reservations TO service_role;
ALTER TABLE public.quota_reservations ENABLE ROW LEVEL SECURITY;
CREATE INDEX quota_reservations_window ON public.quota_reservations(user_id,kind,created_at);
CREATE TABLE public.account_operations(user_id uuid PRIMARY KEY, deleting boolean NOT NULL DEFAULT false);
GRANT ALL ON public.account_operations TO service_role;
ALTER TABLE public.account_operations ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.reserve_quota(p_user uuid,p_kind text,p_request uuid,p_fingerprint text,p_analysis uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.quota_reservations; n integer; lim integer; available timestamptz;
BEGIN
 IF p_kind NOT IN ('render','chat') OR p_fingerprint IS NULL OR length(p_fingerprint)>128 THEN RAISE EXCEPTION 'invalid quota request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 IF EXISTS(SELECT 1 FROM public.account_operations WHERE user_id=p_user AND deleting) THEN RAISE EXCEPTION 'account locked'; END IF;
 SELECT * INTO r FROM public.quota_reservations WHERE user_id=p_user AND kind=p_kind AND request_id=p_request;
 IF FOUND THEN
  IF r.fingerprint<>p_fingerprint THEN RETURN jsonb_build_object('status','conflict'); END IF;
  RETURN jsonb_build_object('status',r.state,'id',r.id,'result',r.result);
 END IF;
 -- Server configuration is extensible; existing free limits remain the safe default.
 SELECT COALESCE((SELECT daily_limit FROM public.quota_limits WHERE kind=p_kind),CASE p_kind WHEN 'render' THEN 3 ELSE 15 END) INTO lim;
 SELECT count(*),min(t)+interval '24 hours' INTO n,available FROM (
 SELECT created_at t FROM public.usage_events WHERE user_id=p_user AND kind=p_kind AND created_at>now()-interval '24 hours'
 UNION ALL SELECT created_at FROM public.quota_reservations WHERE user_id=p_user AND kind=p_kind AND state<>'released' AND created_at>now()-interval '24 hours') x;
 IF n>=lim THEN RETURN jsonb_build_object('status','exhausted','available_at',available); END IF;
 INSERT INTO public.quota_reservations(user_id,kind,request_id,fingerprint,analysis_id) VALUES(p_user,p_kind,p_request,p_fingerprint,p_analysis) RETURNING * INTO r;
 RETURN jsonb_build_object('status','reserved','id',r.id);
END $$;
CREATE OR REPLACE FUNCTION public.finish_quota(p_user uuid,p_id uuid,p_state text,p_result jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_state NOT IN ('completed','released','uncertain') THEN RAISE EXCEPTION 'invalid state'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 UPDATE public.quota_reservations SET state=p_state,result=p_result WHERE id=p_id AND user_id=p_user AND state='pending';
END $$;
CREATE OR REPLACE FUNCTION public.prepare_image_render(p_user uuid,p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.quota_reservations SET stage='image_ready' WHERE id=p_id AND user_id=p_user AND state='pending' AND kind='render' AND stage='reserved';
 IF NOT FOUND THEN RAISE EXCEPTION 'reservation unavailable'; END IF;
END $$;
-- Relay checks this with the verified user's JWT. A caller cannot mint a reservation or replay a claimed one.
CREATE OR REPLACE FUNCTION public.claim_image_render(p_analysis uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 SELECT id INTO rid FROM public.quota_reservations WHERE user_id=auth.uid() AND analysis_id=p_analysis AND kind='render' AND state='pending' AND stage='image_ready' AND created_at>now()-interval '24 hours' ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF rid IS NULL THEN RETURN false; END IF;
 UPDATE public.quota_reservations SET stage='image_claimed' WHERE id=rid;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.get_my_quota()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH used AS (
 SELECT kind,created_at FROM public.usage_events WHERE user_id=auth.uid() AND created_at>now()-interval '24 hours'
 UNION ALL SELECT kind,created_at FROM public.quota_reservations WHERE user_id=auth.uid() AND state<>'released' AND created_at>now()-interval '24 hours'
 ) SELECT json_build_object('renders_used',(SELECT count(*) FROM used WHERE kind='render'),'chat_used',(SELECT count(*) FROM used WHERE kind='chat'),
 'renders_limit',COALESCE((SELECT daily_limit FROM public.quota_limits WHERE kind='render'),3),'chat_limit',COALESCE((SELECT daily_limit FROM public.quota_limits WHERE kind='chat'),15),
 'renders_available_at',(SELECT min(created_at)+interval '24 hours' FROM used WHERE kind='render'),'chat_available_at',(SELECT min(created_at)+interval '24 hours' FROM used WHERE kind='chat'));
$$;
CREATE OR REPLACE FUNCTION public.set_account_deleting(p_user uuid,p_deleting boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 IF p_deleting AND EXISTS(SELECT 1 FROM public.quota_reservations WHERE user_id=p_user AND state IN ('pending','uncertain') AND created_at>now()-interval '24 hours') THEN RAISE EXCEPTION 'work in progress'; END IF;
 INSERT INTO public.account_operations VALUES(p_user,p_deleting) ON CONFLICT(user_id) DO UPDATE SET deleting=EXCLUDED.deleting;
END $$;
CREATE OR REPLACE FUNCTION public.purge_owned_data(p_user uuid,p_scope text,p_analysis uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.account_operations WHERE user_id=p_user AND deleting) THEN RAISE EXCEPTION 'account not locked'; END IF;
 IF p_scope NOT IN ('analysis','chat','data','account') THEN RAISE EXCEPTION 'invalid scope'; END IF;
 IF p_scope IN ('analysis','data','account') THEN
 DELETE FROM public.favorites WHERE analysis_id IN (SELECT id FROM public.style_analyses WHERE user_id=p_user AND (p_scope<>'analysis' OR id=p_analysis));
 DELETE FROM public.style_analyses WHERE user_id=p_user AND (p_scope<>'analysis' OR id=p_analysis);
 END IF;
 IF p_scope IN ('chat','data','account') THEN DELETE FROM public.chat_messages WHERE user_id=p_user; END IF;
 IF p_scope IN ('data','account') THEN DELETE FROM public.favorites WHERE user_id=p_user; UPDATE public.profiles SET full_name='',avatar_url=NULL WHERE user_id=p_user; END IF;
 IF p_scope='account' THEN DELETE FROM public.user_roles WHERE user_id=p_user; DELETE FROM public.profiles WHERE user_id=p_user; DELETE FROM public.usage_events WHERE user_id=p_user; DELETE FROM public.quota_reservations WHERE user_id=p_user; END IF;
END $$;
REVOKE ALL ON FUNCTION public.reserve_quota(uuid,text,uuid,text,uuid),public.finish_quota(uuid,uuid,text,jsonb),public.prepare_image_render(uuid,uuid),public.set_account_deleting(uuid,boolean),public.purge_owned_data(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_quota(uuid,text,uuid,text,uuid),public.finish_quota(uuid,uuid,text,jsonb),public.prepare_image_render(uuid,uuid),public.set_account_deleting(uuid,boolean),public.purge_owned_data(uuid,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.claim_image_render(uuid),public.get_my_quota() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_image_render(uuid),public.get_my_quota() TO authenticated;
-- Do not permit client creation/deletion of usage records or reservation state.
REVOKE INSERT,UPDATE,DELETE ON public.usage_events FROM anon,authenticated;
