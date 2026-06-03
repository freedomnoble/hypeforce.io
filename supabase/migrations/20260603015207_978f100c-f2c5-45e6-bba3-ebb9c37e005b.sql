
-- ============ messages: split channel vs DM read ============
DROP POLICY IF EXISTS "members read messages" ON public.messages;

CREATE POLICY "members read channel messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  channel_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.channel_members cm
    WHERE cm.channel_id = messages.channel_id
      AND cm.member_type = 'user'
      AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "participants read dm messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  dm_id IS NOT NULL
  AND public.is_dm_participant(auth.uid(), dm_id)
);

-- ============ workspace_members: remove self-insert-any-workspace ============
DROP POLICY IF EXISTS "self insert membership" ON public.workspace_members;

CREATE POLICY "admin insert membership"
ON public.workspace_members
FOR INSERT
TO authenticated
WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

-- ============ channel_members: split into INSERT (any member) and UPDATE/DELETE (creator/admin) ============
DROP POLICY IF EXISTS "members modify channel members" ON public.channel_members;

CREATE POLICY "members add channel members"
ON public.channel_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = channel_members.channel_id
      AND public.is_workspace_member(auth.uid(), c.workspace_id)
  )
);

CREATE POLICY "creator or admin update channel members"
ON public.channel_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = channel_members.channel_id
      AND ((c.created_by = auth.uid()) OR public.is_workspace_admin(auth.uid(), c.workspace_id))
  )
);

CREATE POLICY "creator, admin, or self remove channel members"
ON public.channel_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = channel_members.channel_id
      AND (
        c.created_by = auth.uid()
        OR public.is_workspace_admin(auth.uid(), c.workspace_id)
        OR (channel_members.member_type = 'user' AND channel_members.user_id = auth.uid())
      )
  )
);

-- ============ profiles: restrict to self + shared workspace members ============
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;

CREATE POLICY "profiles readable by self or shared workspace"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.workspace_members me
    JOIN public.workspace_members them
      ON them.workspace_id = me.workspace_id
    WHERE me.user_id = auth.uid()
      AND them.user_id = profiles.id
  )
);

-- ============ storage: attachments – require workspace membership ============
DROP POLICY IF EXISTS "attachments read auth" ON storage.objects;

CREATE POLICY "attachments read for workspace members"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.bucket = 'attachments'
      AND f.path = storage.objects.name
      AND public.is_workspace_member(auth.uid(), f.workspace_id)
  )
);

-- ============ storage: knowledge – require workspace membership ============
DROP POLICY IF EXISTS "knowledge read auth" ON storage.objects;

CREATE POLICY "knowledge read for workspace members"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'knowledge'
  AND EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.bucket = 'knowledge'
      AND f.path = storage.objects.name
      AND public.is_workspace_member(auth.uid(), f.workspace_id)
  )
);

-- ============ storage: drop broad SELECT on public avatar buckets ============
-- Direct public URLs (/storage/v1/object/public/...) still work without RLS.
-- Removing these policies blocks listing/enumeration via the API.
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "generated avatars public read" ON storage.objects;
