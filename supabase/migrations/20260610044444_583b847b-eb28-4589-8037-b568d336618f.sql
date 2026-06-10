
-- Extra extraction tracking on files
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS extraction_status TEXT,
  ADD COLUMN IF NOT EXISTS extraction_error TEXT;

-- Project log table
CREATE TABLE IF NOT EXISTS public.channel_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user','agent')),
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  title TEXT,
  body TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS channel_memos_channel_idx
  ON public.channel_memos(channel_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_memos TO authenticated;
GRANT ALL ON public.channel_memos TO service_role;

ALTER TABLE public.channel_memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read channel memos" ON public.channel_memos
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "members insert channel memos" ON public.channel_memos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(auth.uid(), workspace_id)
    AND (
      (author_type = 'user' AND author_user_id = auth.uid())
      OR (author_type = 'agent' AND author_agent_id IS NOT NULL)
    )
  );

CREATE POLICY "author or admin update memo" ON public.channel_memos
  FOR UPDATE TO authenticated
  USING (
    (author_type = 'user' AND author_user_id = auth.uid())
    OR public.is_workspace_admin(auth.uid(), workspace_id)
  );

CREATE POLICY "author or admin delete memo" ON public.channel_memos
  FOR DELETE TO authenticated
  USING (
    (author_type = 'user' AND author_user_id = auth.uid())
    OR public.is_workspace_admin(auth.uid(), workspace_id)
  );

CREATE TRIGGER channel_memos_set_updated_at
  BEFORE UPDATE ON public.channel_memos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_memos;
