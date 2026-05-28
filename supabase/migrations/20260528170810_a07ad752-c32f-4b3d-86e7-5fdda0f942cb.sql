-- 1) Generated avatars bucket (public read)
insert into storage.buckets (id, name, public)
values ('avatars-generated', 'avatars-generated', true)
on conflict (id) do nothing;

-- Public read for generated avatars
create policy "generated avatars public read"
on storage.objects for select
to public
using (bucket_id = 'avatars-generated');

-- Only owner (folder = user id) may write/update/delete
create policy "user writes own generated avatar"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars-generated' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "user updates own generated avatar"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars-generated' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "user deletes own generated avatar"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars-generated' and auth.uid()::text = (storage.foldername(name))[1]);

-- 2) Profile fields
alter table public.profiles
  add column if not exists avatar_generated_at timestamptz,
  add column if not exists avatar_generation_status text not null default 'idle',
  add column if not exists avatar_generation_model text;
