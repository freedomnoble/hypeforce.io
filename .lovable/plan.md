## Problem

After a successful test payment, Paddle keeps the user on its own success screen. When they manually close it, they land back on `/onboarding/features` without the `?checkout=success` query param, so the existing "advance on return" logic never fires and they're stuck on the subscribe step.

The current flow only advances in two cases:
1. They were already comped / had an active subscription on mount, or
2. They returned via Paddle's `successUrl` redirect (which isn't reliably firing).

## Fix

Make the features step advance as soon as the payment is confirmed, regardless of whether Paddle auto-redirects.

### 1. Listen to Paddle checkout events

Extend `initializePaddle` in `src/lib/paddle.ts` to accept an optional `eventCallback`. Re-initialize Paddle inside `usePaddleCheckout` (or pass a callback through `openCheckout`) so the caller can react to `checkout.completed`.

### 2. Advance immediately on `checkout.completed`

In `src/routes/_auth.onboarding.features.tsx`, when the Paddle event fires:
- Switch into the "confirming" state (reuse the existing success UI).
- Call `advance({ data: { to: 4 } })`.
- Start polling `getOnboardingState` every ~1.5s (max ~20s) until `has_active_subscription` is true (webhook landed) — or proceed after the advance call succeeds, whichever comes first.
- Navigate to `/onboarding/invites`.

### 3. Belt-and-suspenders: poll on mount if returning manually

On mount of the features step, if the user manually closed the Paddle overlay and returned without the `?checkout=success` param, kick off a short subscription poll (5 attempts, 2s apart) before showing the subscribe button. If a subscription appears, advance and navigate. If not, render the subscribe CTA as today.

### 4. Keep the existing `?checkout=success` path

Leave the current query-param handling intact as a third safety net for the case where Paddle does redirect.

## Files to touch

- `src/lib/paddle.ts` — accept and wire up an `eventCallback` in `Paddle.Initialize`.
- `src/hooks/usePaddleCheckout.ts` — forward an optional `onEvent` callback to `Paddle.Initialize` / `Paddle.Checkout.open`.
- `src/routes/_auth.onboarding.features.tsx` — handle `checkout.completed`, add post-checkout polling, and add the mount-time short poll fallback.

## Out of scope

- Webhook handler and DB schema (already correct).
- Other onboarding steps.
- Live-mode behavior (same code path, no changes needed).
