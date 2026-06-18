## Plan

Fix the onboarding subscription step so new users are no longer stuck and can start a card-backed 5-day trial.

### What I’ll change

1. **Make the trial button clickable**
   - The current “5-day free trial” button is disabled when an app-side trial already exists, which traps users on this screen.
   - I’ll change it so the trial button opens the built-in payments checkout instead of disabling.

2. **Use payment-provider trial behavior**
   - Update the existing monthly and annual subscription prices to include a **5-day trial**.
   - Checkout will show the card-on-file flow with 5 days free, then the selected paid amount after the trial.

3. **Add monthly / annual toggle on onboarding**
   - Add a small segmented toggle on the subscription screen.
   - Monthly opens `founder_monthly`; annual opens `founder_annual`.
   - Both will use the 5-day trial.

4. **Make Continue work after checkout starts/completes**
   - Keep Continue disabled until the user has started checkout or already has access.
   - When checkout opens or completes, enable Continue and keep the onboarding flow moving to the next step.
   - Add error feedback if checkout fails instead of silently doing nothing.

5. **Keep the app icon restored**
   - Leave the `app-icon.png` usage intact on onboarding/welcome.

### Technical notes

- Files likely touched:
  - `src/routes/_auth.onboarding.features.tsx`
  - possibly shared pricing constants if useful
- Payment catalog updates:
  - Patch the test and live `founder_monthly` and `founder_annual` prices to add `trial_period: { interval: "day", frequency: 5 }`.
- No database schema changes planned.
- No changes to the theme work in this pass except avoiding regressions on the onboarding screen.