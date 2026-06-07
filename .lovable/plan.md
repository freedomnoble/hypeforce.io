## Goal

Let new users finish signup, run through onboarding, and subscribe **without** verifying their email. The verification email is still auto-sent on signup, but it never blocks them. Verification is required only to:

- Create a **second channel** (the first one made during onboarding is fine)
- Create a **second workspace** (the auto-seeded "Atelier" is fine)
- **Invite teammates**

Existing users in the DB are grandfathered as verified so nothing breaks for them.

## Changes

### 1. Auth config
- Turn on `auto_confirm_email` in Supabase auth so `supabase.auth.signUp()` on `/welcome` returns a session immediately — no "check your inbox" dead end.
- Because Supabase will now mark `email_confirmed_at` at signup, we track our own "user actually clicked the link" state separately (see #2).

### 2. Database
Add to `profiles`:
- `email_verified_at timestamptz null` — set when the user clicks our verification link.
- `verification_token uuid null` + `verification_token_sent_at timestamptz null`.

Backfill: `update profiles set email_verified_at = now()` for every existing row (grandfathered).

A helper SQL function `public.is_email_verified(uuid)` returns `true` when `email_verified_at is not null`.

### 3. Send verification on signup
After `supabase.auth.signUp()` succeeds in `/welcome`, call a new server fn `sendVerificationEmail` that:
- Generates a token, stores it on the profile.
- Sends an email via Lovable Emails with a link to `/verify-email?token=…`.

The user is navigated straight into onboarding — the email is informational.

### 4. `/verify-email` route
Public route. Reads `token`, calls server fn `confirmEmailVerification({ token })`, which validates the token against the profile and sets `email_verified_at = now()`. Shows success / "link expired, resend" UI. A "Resend verification email" button is available here and in the in-app banner.

### 5. In-app banner
A small dismissible banner in `workspace-shell` shown when `email_verified_at` is null: "Verify your email to unlock invites and more workspaces / channels. [Resend]".

### 6. Server-side gates
Add a shared `assertEmailVerified(userId)` helper used in:
- `createFirstChannel` — rename intent stays, but reject if the user already owns ≥1 user-created channel in this workspace and is unverified. (Onboarding's first channel still works because it's the first.)
- A new `createWorkspace` path (or wherever workspace creation lives) — reject if the user already owns ≥1 workspace and is unverified.
- `sendOnboardingInvites` and any invite-send fn — reject if unverified.

Each gate throws a typed error like `EMAIL_VERIFICATION_REQUIRED` so the UI can show a clean "Verify your email to continue" modal with a resend button instead of a generic toast.

### 7. UI affordances
- Channel-create and workspace-create buttons stay enabled, but on the verification error show a modal: "Confirm your email to unlock this." with **Resend email** and **I've verified, retry**.
- Invite form shows the same modal on submit.

### 8. Onboarding flow
No structural change. `/welcome` → onboarding → features/subscribe all proceed without verification. The features/subscribe step does **not** check verification.

## Technical notes

- Files touched:
  - `src/routes/welcome.tsx` — call `sendVerificationEmail` after `signUp`, navigate to `/onboarding` immediately whether or not `data.session` exists (auto-confirm makes session reliable).
  - `src/lib/onboarding.functions.ts` — add gate to `createFirstChannel` and `sendOnboardingInvites`.
  - New `src/lib/email-verification.functions.ts` — `sendVerificationEmail`, `confirmEmailVerification`, `resendVerificationEmail`.
  - New `src/routes/verify-email.tsx`.
  - `src/components/hypeforce/workspace-shell.tsx` — verify banner.
  - Wherever 2nd workspace / 2nd channel UI lives — wrap submit with verification error handling modal.
- Migration: new columns + grandfather backfill + `is_email_verified` SQL helper.
- Auth config call: `auto_confirm_email: true`, `disable_signup: false`, `external_anonymous_users_enabled: false`, `password_hibp_enabled: true`.
- Email sending uses Lovable's email infrastructure (auto-send template on signup); if no email domain is configured yet, the setup dialog will be shown before scaffolding the verification template.
