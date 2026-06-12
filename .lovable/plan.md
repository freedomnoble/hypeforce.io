## Why the delete is failing

Auth logs show the actual error returned by `auth.admin.deleteUser`:

```
ERROR: new row for relation "messages" violates check constraint "messages_check1" (SQLSTATE 23514)
500: Database error deleting user
```

What's happening:

- `public.messages.author_user_id` references `auth.users(id)` with **ON DELETE SET NULL**.
- `public.messages` also has a CHECK constraint `messages_check1`:
  `(author_type='user' AND author_user_id IS NOT NULL) OR (author_type='agent' AND author_agent_id IS NOT NULL)`
- When you delete a user who has posted any message, Postgres tries to set their `author_user_id` to NULL, which violates the CHECK, which aborts the whole `DELETE` — so the user, profile, workspace, etc. all stay.

All three failing accounts had posted messages in their starter channels, so all three hit this.

## Fix

Change the FK on `messages.author_user_id` from `ON DELETE SET NULL` to `ON DELETE CASCADE`. When a user is deleted, their authored messages get deleted with them, which keeps the CHECK satisfied. This matches how their workspaces/channels/DMs already cascade.

Migration:

```sql
ALTER TABLE public.messages
  DROP CONSTRAINT messages_author_user_id_fkey;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_author_user_id_fkey
  FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

After the migration, re-running bulk delete on those three accounts will succeed.

## Small UX improvement (optional, same edit pass)

Right now the toast just says "Deleted 0. 3 failed." with no detail. I'll surface the first failure's error message in the toast and `console.error` the full failure list, so the next time something like this happens you can see the cause without digging through auth logs.

## Other tables checked, no change needed

- `channel_memos` has a similar pair (FK SET NULL + author_type CHECK), but its check only restricts the enum value — it does NOT require `author_user_id` to be non-null. Safe as-is.
- All other public-schema FKs to `auth.users` are already CASCADE or SET NULL with no conflicting CHECKs.
- The 1 `storage.objects` row owned by these users has no FK to `auth.users`, so it doesn't block delete (it'll just be orphaned; can be cleaned up separately if you want).