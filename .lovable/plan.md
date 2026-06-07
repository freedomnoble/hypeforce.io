## Goal

Stop blocking the onboarding flow on Paddle webhook confirmation. Let users continue immediately after they signal intent (click Subscribe), and reconcile subscription status in the background.

## UX changes (`/onboarding/features`)

- Remove the "I've paid — check again" link and the "Payment is still syncing…" copy.
- Remove the full-screen "You're in! / Setting up the next step…" confirming state.
- Keep the Subscribe button as the primary CTA.
- Add a secondary **Continue** button below Subscribe.
  - Disabled by default.
  - Becomes enabled the moment the user clicks Subscribe (intent captured), and stays enabled for the rest of the session.
  - Also enabled immediately if the user already has an active sub / is comped (returning user).
- Clicking Continue: optimistically advance step → navigate to `/onboarding/invites`. No waiting, no polling.

## Intent tracking

- On Subscribe click: set a local "intent given" flag (component state + `sessionStorage` key like `hf_subscribe_intent`) so the Continue button stays unlocked if they bounce back from Paddle to this screen.
- Still call `advance({ to: 4 })` in the background when they hit Continue, and `patch({ step: 4 })` in the cache so the rest of the flow doesn't regress.

## Background reconciliation

- Drop the `?checkout=success` polling loop and the auto-advance on `checkout.completed`. We no longer need to gate the UI on it.
- Keep the existing Paddle webhook (`/api/public/payments/webhook`) as the source of truth — it already writes to `subscriptions` with the right `environment`.
- The existing `has_active_subscription` SQL function + `useSubscription`-style reads continue to gate premium features elsewhere in the app. No change needed there.

## Access enforcement (the "shut off access if it never processes" half)

- No new server logic in this pass — access is already derived from the `subscriptions` table via `has_active_subscription`. If the webhook never arrives, the user simply won't have an active sub and existing gates will block premium features after onboarding.
- Out of scope for this change (call out, don't build): a future cleanup job could flag users who hit Continue with intent but never got a webhook within N hours and downgrade their workspace / prompt them. We can add that later if it becomes a real problem.

## Files to change

- `src/routes/_auth.onboarding.features.tsx`
  - Remove: `confirming` state, `checking` state, `syncMessage`, `pollForSubscription`, `handleCheckAgain`, the `?checkout=success` effect branch, the "You're in!" return block, the "I've paid — check again" button.
  - Add: `intentGiven` state, hydrated from `sessionStorage` and from `data?.has_active_subscription || data?.is_comped`.
  - Add: `<Button>Continue</Button>` under Subscribe, `disabled={!intentGiven}`, onClick advances + navigates to `/onboarding/invites`.
  - In `onSubscribe`: set `intentGiven = true` and persist to `sessionStorage` before opening checkout. Remove the `onEvent` auto-advance.
  - Use `useOnboardingState()` (already imported pattern in sibling steps) instead of the local `fetchState` effect, so there's no loading flash.
- No changes to webhook, DB, or server fns.

## Verification

1. Fresh user lands on `/onboarding/features` — Subscribe enabled, Continue disabled.
2. Click Subscribe → Paddle opens. Close it without paying → Continue is now enabled. Click → lands on `/onboarding/invites` instantly, no spinner.
3. Returning user with active sub lands on the screen → Continue enabled immediately (Subscribe still visible but they can just continue).
4. Confirm no "loading your workspace" / "preparing" / "I've paid" copy appears anywhere in the step.
