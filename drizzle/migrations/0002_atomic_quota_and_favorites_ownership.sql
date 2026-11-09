CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION public.consume_quota(_user_id uuid, _kind text, _limit int)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _used int;
  _id uuid;
BEGIN
  IF _user_id IS NULL OR _kind NOT IN ('render','chat') OR _limit IS NULL OR _limit < 0 THEN
    RAISE EXCEPTION 'invalid quota request';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_user_id::text || ':' || _kind));
  SELECT count(*) INTO _used FROM public.usage_events
   WHERE user_id = _user_id AND kind = _kind AND created_at > now() - interval '24 hours';
  IF _used >= _limit THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.usage_events (user_id, kind) VALUES (_user_id, _kind) RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_quota(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH d AS (DELETE FROM public.usage_events WHERE id = _event_id AND user_id = _user_id RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM d);
$$;

REVOKE ALL ON FUNCTION public.consume_quota(uuid, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_quota(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_quota(uuid, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_quota(uuid, uuid) TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.usage_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_quota()
RETURNS json
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'renders_used', (SELECT count(*) FROM public.usage_events WHERE user_id = auth.uid() AND kind = 'render' AND created_at > now() - interval '24 hours'),
    'chat_used', (SELECT count(*) FROM public.usage_events WHERE user_id = auth.uid() AND kind = 'chat' AND created_at > now() - interval '24 hours'),
    'renders_limit', 3,
    'chat_limit', 15,
    'renders_available_at', (SELECT min(created_at) + interval '24 hours' FROM public.usage_events WHERE user_id = auth.uid() AND kind = 'render' AND created_at > now() - interval '24 hours'),
    'chat_available_at', (SELECT min(created_at) + interval '24 hours' FROM public.usage_events WHERE user_id = auth.uid() AND kind = 'chat' AND created_at > now() - interval '24 hours')
  )
$$;

DROP POLICY IF EXISTS "Users can add to their favorites" ON public.favorites;
CREATE POLICY "Users can add to their favorites" ON public.favorites
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.style_analyses sa WHERE sa.id = analysis_id AND sa.user_id = auth.uid())
  );