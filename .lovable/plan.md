# Free Trial Plan

A 5-day comp window stored on the profile. Two ways in: a feature-flagged landing CTA, and a separate trial invite link (always works, independent of the flag).

## 1. Data model

Migration adds three columns to `profiles`:
- `trial_started_at timestamptz`
- `trial_ends_at timestamptz`
- `trial_cancel_requested_at timestamptz`

New row in `feature_flags`:
- key `free_trial_landing`, default `false`, description "Show 5-day free trial CTA on landing page".

New row in `invite_links` table (extend the existing single-row table or add a `kind` column — we'll add `kind text not null default 'comp' check (kind in ('comp','trial'))` plus a second seed row with `kind='trial'`, its own random token, its own `enabled` flag). Existing redeem path stays comp-only.

`has_active_subscription`/onboarding state already treats `is_comped` as access. Trial gives access via `trial_ends_at > now()` — we'll teach the few read sites (`onboarding.functions.ts`, `upsell-banner.tsx`, `useSubscription`/billing page, message-send gate) to also accept an active trial.

Helper SQL function `is_on_trial(uid uuid) returns boolean` — used by the message-send gate and any server-side check. (Pure SQL, SECURITY DEFINER, reads profiles.)

## 2. Trial invite link

`/join/<trial-token>` — same route handles both kinds. `redeemInviteToken` is updated to look up the row, branch on `kind`:
- `comp` → set `is_comped = true` (existing behavior).
- `trial` → set `trial_started_at = now()`, `trial_ends_at = now() + interval '5 days'` (only if not already on/past a trial; re-redemption is a no-op).

`pretentious.invites.tsx` gains a second card: "Free trial link" with rotate / enable toggle / copy URL, mirroring the existing comp link UI.

## 3. Landing page CTA (feature flag)

`landing-page.tsx` reads `free_trial_landing` flag (anon-safe read via existing pattern). When ON:
- Primary CTA copy switches to "Start 5-day free trial" and links to `/welcome?trial=1`.
- `/welcome` reads `?trial=1`, stashes `sessionStorage.hypeforce.trial_intent = '1'`, and after account creation calls `startTrial` server fn (new, in `invites.functions.ts`) which stamps the same trial columns. No token needed — flag is the gate.

When flag is OFF, landing CTA is unchanged. Trial token link still works regardless of the flag.

## 4. Onboarding / Subscribe screen

`_auth.onboarding.features.tsx`:
- After existing comp-redeem effect, run a parallel "trial redeem" check: if `sessionStorage` has the trial token *or* `trial_intent` flag and the user has no active trial, call `startTrial`/`redeemInviteToken` and refetch.
- Button rendering logic:
  - `is_comped` → "Gifted" (unchanged)
  - active trial (`trial_ends_at > now()`) → button greyed/disabled labeled "5-day free trial". Continue button enabled by default (no need to click subscribe).
  - day 5 of trial (`trial_ends_at - now() < 24h`) → under Subscribe button render a tiny "Request cancellation" link → opens confirm dialog → calls `requestTrialCancellation` server fn (stamps `trial_cancel_requested_at`, emails admin via existing email infra, sets `subscriptions`-equivalent UI state to "cancellation requested"). Same control surfaces on `/profile/billing` while trial is in cancel-requested state.

`getOnboardingState` returns `trial_started_at`, `trial_ends_at`, `trial_cancel_requested_at` so the client can render the right state.

## 5. In-app banner (day 4)

`upsell-banner.tsx` already gates on `is_comped`. Extend it:
- If user has an active trial, banner is suppressed on days 1–3.
- On day ≥ 4 (i.e. `trial_ends_at - now() <= 48h`), show a trial-specific variant: "Your free trial ends in N hours — claim your founder seat for $9/mo" with Subscribe button. Not dismissable on day 5.
- After `trial_ends_at` passes with no subscription, banner becomes the hard expiry banner (see §6).

## 6. Day-5 / expired message gate

In `invokeAgentRouter` (the only user-message entry point), before composing the user message:
- Load profile trial columns + active-sub check.
- If `is_comped` or `has_active_subscription` → proceed.
- If `is_on_trial(uid)` → proceed.
- Else if user previously had a trial (`trial_started_at not null` and `trial_ends_at <= now()`) and no sub → throw a typed error `TRIAL_EXPIRED`.

Client (channel + DM pages + share dialog) catches `TRIAL_EXPIRED` and opens a subscribe modal pinned to the $9 founder price (reuse `usePaddleCheckout` with `founder_monthly`). The modal blocks send until they subscribe or close.

No retroactive cleanup needed — trial messages stay in history.

## 7. Cancellation request

New server fn `requestTrialCancellation` (auth required):
- Stamps `trial_cancel_requested_at = now()`.
- Sends one email to the admin inbox (reuse existing transactional email infra / `support_tickets` insert — pick whichever the project already uses for admin notifications; we'll use a `support_tickets` row with subject "Trial cancellation request" so it shows in `/pretentious/support`).
- Idempotent (no-op if already stamped).

Once stamped, the Subscribe screen + banner show "Cancellation requested — we'll be in touch" instead of subscribe CTA, and the day-5 message gate is replaced by a friendly "your trial has ended" notice (no upsell). Admin can still toggle `is_comped` or extend trial from `/pretentious/users`.

## 8. Admin (`/pretentious/users`)

Add to the per-user row:
- Read-only trial state (started / ends / cancel requested).
- Buttons: "Start 5-day trial", "Extend trial +5 days", "End trial now".
Wires to a new `setUserTrial` server fn (super-admin only) in `invites.functions.ts`.

## Files touched

- **Migration**: new columns on `profiles`, `kind` column + seed row on `invite_links`, `is_on_trial` SQL fn, new feature flag row.
- `src/lib/invites.functions.ts` — branch `redeemInviteToken` on kind; add `startTrial`, `requestTrialCancellation`, `setUserTrial`.
- `src/lib/onboarding.functions.ts` — return trial fields.
- `src/lib/agent-router.functions.ts` — trial gate + `TRIAL_EXPIRED` throw.
- `src/components/hypeforce/landing-page.tsx` — flag-driven CTA copy + link.
- `src/routes/welcome.tsx` — handle `?trial=1` + redeem trial token.
- `src/routes/join.$token.tsx` — unchanged (server fn handles kind).
- `src/routes/_auth.onboarding.features.tsx` — trial button state, day-5 cancel link, trial redeem effect.
- `src/components/hypeforce/upsell-banner.tsx` — trial-aware variants.
- `src/routes/_auth.w.$workspaceId.c.$channelId.tsx`, `.d.$dmId.tsx`, `share-message-dialog.tsx` — catch `TRIAL_EXPIRED`, open subscribe modal.
- `src/routes/_auth.profile.billing.tsx` — trial state + cancellation control.
- `src/routes/pretentious.invites.tsx` — second card for trial link.
- `src/routes/pretentious.users.tsx` — trial admin controls.

## Open items I'll default unless you say otherwise

- Banner copy day 4: "Your trial ends in ~2 days. Lock in your $9 founder seat." Day 5: "Last day of your trial — subscribe to keep your workspace."
- Cancellation email goes to support_tickets (already monitored in `/pretentious/support`). If you'd rather have a direct email, swap to Mailgun/Resend.
- Trial messages are NOT deleted on expiry — they remain visible read-only.
