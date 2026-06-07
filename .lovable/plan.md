# Fix: "Claim founder spot" goes to /login

## Problem
In `src/components/hypeforce/landing-page.tsx`, `handleCheckout` redirects signed-out users straight to `/login`, bypassing the new onboarding flow. The hero/footer "Claim founder spot" anchors and the pricing CTA all funnel through this same path.

## Change
Update `handleCheckout` so that when there is no signed-in user it sends them to `/welcome` (the new onboarding entry) with the pricing intent preserved, instead of `/login`. After they create a profile, the onboarding gate at `/app` will resume them and the features step (step 4) will trigger Paddle checkout for the founder plan automatically.

Specifically:
- Replace the `/login?redirect=/#pricing` redirect in `handleCheckout` with `navigate({ to: "/welcome", search: { intent: "founder", billing } })` (using TanStack `useNavigate`, not `window.location`).
- In `src/routes/welcome.tsx`, read the `intent` / `billing` search params and stash them on the profile (or in `sessionStorage`) so the onboarding features step can pre-select the right Paddle priceId (`founder_monthly` vs `founder_annual`).
- Leave the existing "Log in" link on `/welcome` pointing to `/login` so returning users still have a path in.

## Files touched
- `src/components/hypeforce/landing-page.tsx` — swap the guest redirect target.
- `src/routes/welcome.tsx` — accept and forward `intent` / `billing` search params.
- `src/routes/_auth.onboarding.features.tsx` — use the stashed billing choice when opening Paddle checkout.

No database, RLS, or pricing logic changes.
