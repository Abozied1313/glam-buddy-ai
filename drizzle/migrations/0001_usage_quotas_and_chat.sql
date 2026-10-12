CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('render','chat')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own usage" ON public.usage_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX usage_events_user_kind_time ON public.usage_events (user_id, kind, created_at DESC);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL CHECK (char_length(content) <= 8000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own chat" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users clear own chat" ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX chat_messages_user_time ON public.chat_messages (user_id, created_at);

CREATE OR REPLACE FUNCTION public.get_my_quota()
RETURNS json LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT json_build_object(
    'renders_used', (SELECT count(*) FROM public.usage_events WHERE user_id = auth.uid() AND kind = 'render' AND created_at > now() - interval '24 hours'),
    'chat_used', (SELECT count(*) FROM public.usage_events WHERE user_id = auth.uid() AND kind = 'chat' AND created_at > now() - interval '24 hours'),
    'renders_limit', 3,
    'chat_limit', 15
  )
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_quota() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_quota() TO authenticated;