# Free Invite Access + Upsell

## 1. Database

New migration:

- **`invite_links`** — single-row config table holding the current secret token, `enabled` boolean, `created_at`, `rotated_at`. Seed one row.
- **`profiles`** — add `is_comped boolean default false` and `show_upsell boolean default false`.

RLS:
- `invite_links`: no public access; service_role only (admin server fns read/write via `supabaseAdmin`).
- `profiles`: existing user self-read stays; only super-admin can update `is_comped` / `show_upsell` (enforced inside server fns).

## 2. Server functions (`src/lib/invites.functions.ts`)

- `getInviteConfig` (super-admin) → `{ token, enabled, url }`
- `rotateInviteToken` (super-admin) → new token
- `setInviteEnabled` (super-admin)
- `redeemInviteToken({ token })` (auth required) — validates token + enabled, sets `profiles.is_comped = true` for current user. Idempotent.
- `setUserCompFlags({ user_id, is_comped, show_upsell })` (super-admin)

## 3. Subscription gating

Update `useSubscription` / any access check so a user is treated as having access when `subscription.isActive` **OR** `profile.is_comped`. Comped users skip Paddle entirely.

## 4. Invite landing route

`src/routes/join.$token.tsx` (public):
- If signed out → store token in `sessionStorage`, redirect to `/login` (signup tab). After auth, root layout checks for stored token and calls `redeemInviteToken`, then routes to `/app`.
- If signed in → call `redeemInviteToken` immediately and route to `/app`.
- Invalid/disabled token → friendly "Invite link is no longer active" page.

No mention of free access anywhere in marketing/landing UI.

## 5. Admin UI

**New page `src/routes/pretentious.invites.tsx`** + nav item in `admin-shell.tsx`:
- Show current invite URL (`/join/<token>`), copy button.
- Toggle: invite link enabled/disabled.
- Rotate token button (confirms — old link stops working).
- List of comped users (email, joined date, upsell toggle, "Revoke comp" button).

**Users page (`pretentious.users.tsx`)** additions:
- Plan column: show "comp" badge when `is_comped`.
- In `UserDrawer`, new "Access" section with two switches: "Free access (comp)" and "Show subscribe banner".

## 6. Upsell banner

New `<UpsellBanner />` rendered inside the authenticated workspace shell (above main content, full-width). Shows only when `profile.show_upsell === true` AND user has no active paid subscription. Dismiss persists in `localStorage` per user; admin re-toggling `show_upsell` off then on resets visibility (key includes a server-side updated_at timestamp on the flag). Banner CTA opens existing Paddle checkout flow.

## Technical notes

- Token is a 32-byte url-safe random string, stored plain in `invite_links` (low-stakes; rotatable).
- Comp state lives on `profiles`, not `subscriptions`, so existing Paddle webhook logic is untouched.
- `redeemInviteToken` uses `requireSupabaseAuth`; all admin fns gate on `is_super_admin(auth.uid())`.
- Add `updated_at` column on `profiles` for show_upsell flag bump (used as banner dismiss-reset key); add trigger.
- No changes to landing page, pricing, or marketing copy.
