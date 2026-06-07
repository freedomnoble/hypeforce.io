Yes — this step should have a Continue/check status path. Right now it only auto-advances when Paddle redirects back with `?checkout=success` or fires the checkout event in the same tab. If you manually return to `/onboarding/features`, the page falls back to the normal Subscribe state even if payment is still syncing.

Plan:

1. Update `/onboarding/features` to support manual Paddle returns
- On page load, check the current onboarding/subscription state as it already does.
- If the account is already subscribed or comped, immediately advance to the invites step.
- If the URL has `?checkout=success`, keep the current auto-confirm behavior.
- If the user is on this page after checkout but the webhook is still delayed, keep polling for a short period instead of showing a dead end.

2. Add explicit recovery controls
- Add an “I’ve paid — check again” button when the user is still shown the Subscribe screen.
- When a paid/comped state is detected, show a clear “Continue” button that advances onboarding to `/onboarding/invites`.
- If payment sync takes too long, show a calm message like “Payment is still syncing. Try again in a moment.” instead of trapping the user.

3. Make the advance action safe and repeatable
- Centralize the “advance to next step” logic so it can be triggered by:
  - Paddle checkout completion event
  - Paddle success URL
  - manual “check again” button
  - already-active subscription on page load
- Prevent duplicate timers/navigation from firing multiple times.

4. Verify the recovery case
- Test the exact scenario: paid in Paddle, manually return to `/onboarding/features`, then trigger the new check/continue path.
- Confirm it lands on `/onboarding/invites` and does not bounce back to `/app` or the root error page.