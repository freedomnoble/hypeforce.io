
-- Per-user BYOK AI provider connections
CREATE TYPE public.ai_provider AS ENUM ('openai','anthropic','google','manus');
CREATE TYPE public.ai_connection_status AS ENUM ('active','invalid','revoked');

CREATE TABLE public.user_ai_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.ai_provider NOT NULL,
  encrypted_key text NOT NULL,
  key_last4 text NOT NULL,
  status public.ai_connection_status NOT NULL DEFAULT 'active',
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_validated_at timestamptz,
  UNIQUE (user_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ai_connections TO authenticated;
GRANT ALL ON public.user_ai_connections TO service_role;

ALTER TABLE public.user_ai_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads own connections"
  ON public.user_ai_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "owner inserts own connections"
  ON public.user_ai_connections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner updates own connections"
  ON public.user_ai_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "owner deletes own connections"
  ON public.user_ai_connections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Add per-agent preferred route
ALTER TABLE public.agents
  ADD COLUMN preferred_route text;
