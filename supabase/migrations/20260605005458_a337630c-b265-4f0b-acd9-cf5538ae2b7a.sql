
-- Tighten support_ticket_attachments: server inserts via admin client only.
DROP POLICY IF EXISTS "anyone inserts attachments" ON public.support_ticket_attachments;

-- Allow ticket owners to reply to their own tickets.
CREATE POLICY "ticket owner inserts own messages"
ON public.support_ticket_messages
FOR INSERT
TO authenticated
WITH CHECK (
  author = 'user'
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_ticket_messages.ticket_id
      AND t.user_id = auth.uid()
  )
);

-- Storage: attachments bucket — uploader can delete/update their own objects
CREATE POLICY "attachments uploader delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.bucket = 'attachments' AND f.path = storage.objects.name
      AND f.uploader_id = auth.uid()
  )
);

CREATE POLICY "attachments uploader update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.bucket = 'attachments' AND f.path = storage.objects.name
      AND f.uploader_id = auth.uid()
  )
);

-- Storage: knowledge bucket — workspace admins can delete/update
CREATE POLICY "knowledge admin delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'knowledge'
  AND EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.bucket = 'knowledge' AND f.path = storage.objects.name
      AND public.is_workspace_admin(auth.uid(), f.workspace_id)
  )
);

CREATE POLICY "knowledge admin update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'knowledge'
  AND EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.bucket = 'knowledge' AND f.path = storage.objects.name
      AND public.is_workspace_admin(auth.uid(), f.workspace_id)
  )
);

-- Storage: support-attachments — super admins can read & delete; ticket owners can read their own
CREATE POLICY "support attachments admin read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND public.is_super_admin(auth.uid())
);

CREATE POLICY "support attachments owner read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND EXISTS (
    SELECT 1
    FROM public.support_ticket_attachments sa
    JOIN public.support_tickets t ON t.id = sa.ticket_id
    WHERE sa.file_path = storage.objects.name
      AND t.user_id = auth.uid()
  )
);

CREATE POLICY "support attachments admin delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND public.is_super_admin(auth.uid())
);
