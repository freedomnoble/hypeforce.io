
-- 1. agent_reply_counters: add SELECT policy scoped to channel membership
CREATE POLICY "Channel members can read reply counters"
ON public.agent_reply_counters
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.channel_members cm
    WHERE cm.channel_id = agent_reply_counters.channel_id
      AND cm.member_type = 'user'
      AND cm.user_id = auth.uid()
  )
);

-- 2. avatars bucket: allow owners to delete their own files
CREATE POLICY "Users can delete their own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 3. support-attachments bucket: allow authenticated users to upload to their own folder
CREATE POLICY "Authenticated users can upload support attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'support-attachments'
);
