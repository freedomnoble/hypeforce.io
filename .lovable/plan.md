## Why

Two issues are tangled together:

1. **The Paddle error you saw.** Paddle refuses checkouts when the customer email matches your own seller account email. `freedom.jnoble@gmail.com` is your Paddle seller, so any checkout opened with that email fails with a generic "an error occurred". Fix: test with a `+test` alias (e.g. `freedom.jnoble+test@gmail.com`) or any other inbox. No code change needed for this part.

2. **The wrong-page bug.** The "Subscribe" CTA on `/profile/billing` (and the in-app upsell banner) currently links to `/onboarding/features`. That step reads the user's email and billing choice from onboarding state / sessionStorage, neither of which is populated for an existing user, so it also opens checkout with empty `customData.userId` and a missing email. Even after you switch test emails, that path is brittle.

## What to build

Replace the placeholder Subscribe button on `/profile/billing` with a real subscribe flow that lives on the billing page:

- When the user has no active subscription, show a "Choose your plan" card with two options:
  - **Monthly** — $9/mo (`founder_monthly`)
  - **Annual** — $97/yr (`founder_annual`), labeled "Save ~10%"
- Clicking either opens the Paddle overlay via the existing `usePaddleCheckout` hook, passing the signed-in user's real email and `customData: { userId }`, with a `successUrl` back to `/profile/billing?checkout=success`.
- On `checkout.completed`, toast success and refetch the billing query so the active-subscription card appears as soon as the webhook lands.
- Point the in-app `UpsellBanner`'s Subscribe button at `/profile/billing` (it already does) — no change needed there.

Everything else on the billing page (cancel, reactivate, customer portal, period info) stays as is.

## Files to touch

- `src/routes/_auth.profile.billing.tsx` — add the plan-picker card + `usePaddleCheckout` wiring for the no-subscription state. Remove the `Link to="/onboarding/features"` fallback.

No backend, schema, or pricing changes. The `founder_monthly` and `founder_annual` prices already exist in the Paddle catalog.

## After implementation

I'll ask you to retry checkout with a non-seller email (e.g. `freedom.jnoble+test@gmail.com` and test card `4242 4242 4242 4242`) to confirm the overlay opens and the subscription row appears.
