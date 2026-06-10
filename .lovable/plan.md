## What the error actually is

Your DB does **not** gate sending on subscription. The only requirement to insert a message is being a `workspace_member`. The real cause for the `brand-voice` channel:

- `handle_new_user` (the signup trigger) only adds the new user to `channel_members` for **one** of the four default channels (`launch-plan`). The other three (`brand-voice`, `build-log`, `market-research`) have agents added but **no user row**.
- The send call does `.insert(...).select().single()`. The INSERT's `WITH CHECK` passes (you're a workspace member), but the `RETURNING` row is filtered by the SELECT policy, which requires a `channel_members` row for the user. PostgREST surfaces that as the cryptic `new row violates row-level security policy for table "messages"` toast you're seeing.

Verified: for workspace Madelocal, `channel_members` has user rows for `launch-plan` only; `brand-voice`/`build-log`/`market-research` have no user member, so sending there throws RLS for the workspace owner.

## Plan

### 1. Fix the root cause (DB migration)

- Update `public.handle_new_user()` to insert a `channel_members` row (member_type `user`) for the creating user on **all four** default channels, not just `launch-plan`.
- One-shot backfill: for every existing channel, insert a `channel_members` row for the workspace owner (and any `workspace_members` with role `owner`/`admin`) where one doesn't already exist. Scoped to channels created by the owner so we don't auto-join admins into channels someone else explicitly invited them out of.

### 2. Make the toast customer-friendly

In `src/routes/_auth.w.$workspaceId.c.$channelId.tsx` `send()` and `src/routes/_auth.w.$workspaceId.d.$dmId.tsx` (DM send), replace the raw `e.message` with a friendly message:

- Detect Postgres permission / RLS errors (Supabase `PostgrestError` with `code` `42501` or message containing `row-level security` / `permission denied`) and show: **"Couldn't send your message. Please refresh and try again — if it keeps happening, contact support."**
- Other errors keep a short generic fallback: **"Couldn't send your message. Please try again."**
- Log the original error to `console.error` so we still see it in dev tools / logs.

Skipping the literal "To start a new channel please subscribe" wording because (a) it's a different bug than missing subscription, and (b) it would mislead users who actually have an active subscription. Happy to swap wording if you'd rather.

### 3. Verify

- After migration runs and you reload, try sending in `brand-voice`, `build-log`, `market-research` — should succeed.
- Force an RLS error (e.g. simulate by signing in as a non-member) → confirm the friendly toast appears, not the raw Postgres string.

## Technical details

- Migration touches: `public.handle_new_user` (replace), and a one-time `INSERT ... ON CONFLICT DO NOTHING` into `public.channel_members` for owner-created channels. No table schema changes, no new GRANTs needed.
- Frontend touches: `send()` catch block in the two route files above. No new dependencies.
