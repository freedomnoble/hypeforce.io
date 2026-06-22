
-- Tighten channel_agent_overrides writes to channel members only
DROP POLICY IF EXISTS "Workspace members write overrides" ON public.channel_agent_overrides;
CREATE POLICY "Channel members write overrides"
  ON public.channel_agent_overrides
  FOR ALL
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.channel_members cm
      WHERE cm.channel_id = channel_agent_overrides.channel_id
        AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_workspace_member(auth.uid(), workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.channel_members cm
      WHERE cm.channel_id = channel_agent_overrides.channel_id
        AND cm.user_id = auth.uid()
    )
  );

-- Also tighten SELECT on overrides to channel members
DROP POLICY IF EXISTS "Workspace members read overrides" ON public.channel_agent_overrides;
CREATE POLICY "Channel members read overrides"
  ON public.channel_agent_overrides
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.channel_members cm
      WHERE cm.channel_id = channel_agent_overrides.channel_id
        AND cm.user_id = auth.uid()
    )
  );

-- Restrict channel_memos SELECT to channel members
DROP POLICY IF EXISTS "members read channel memos" ON public.channel_memos;
CREATE POLICY "channel members read memos"
  ON public.channel_memos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.channel_members cm
      WHERE cm.channel_id = channel_memos.channel_id
        AND cm.user_id = auth.uid()
    )
  );

-- Also tighten INSERT to require channel membership
DROP POLICY IF EXISTS "members insert channel memos" ON public.channel_memos;
CREATE POLICY "channel members insert memos"
  ON public.channel_memos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.channel_members cm
      WHERE cm.channel_id = channel_memos.channel_id
        AND cm.user_id = auth.uid()
    )
    AND (
      (author_type = 'user' AND author_user_id = auth.uid())
      OR (author_type = 'agent' AND author_agent_id IS NOT NULL)
    )
  );

-- Allow ticket owners to read their own attachment metadata
CREATE POLICY "owners read own attachments"
  ON public.support_ticket_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_ticket_attachments.ticket_id
        AND t.user_id = auth.uid()
    )
  );

-- Set search_path on pgmq wrapper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
