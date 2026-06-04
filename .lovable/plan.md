# Switch to Paddle Payments

You previously had Stripe queued up — we'll swap to Paddle instead. Paddle acts as merchant of record, so taxes, compliance, invoicing, and chargebacks are handled for you at a flat 5% + 50¢ per transaction. No restricted Stripe key needed.

## Steps

1. **Enable Paddle** via `enable_paddle_payments`. You'll fill in a short form (email, business name, etc.). A sandbox environment is created immediately so we can test without real money. Live payments require Paddle verification, which you can submit afterwards.

2. **Create products & prices** in Paddle once enabled — matching the existing pricing tiers in your admin CMS:
   - Founder ($/mo)
   - Pro (monthly + annual)
   - Team (monthly + annual)
   - Any one-time purchases you want

3. **Wire checkout** on the landing page pricing CTAs:
   - Add a `createCheckoutSession` server function that returns a Paddle checkout URL for the selected plan.
   - Hook the existing pricing buttons to call it and redirect.

4. **Webhook handler** at `/api/public/paddle-webhook` to:
   - Verify Paddle signature
   - Upsert subscription state into your existing `subscriptions` table (used by `/pretentious/billing`)
   - Handle `subscription.created`, `subscription.updated`, `subscription.canceled`, `transaction.completed`

5. **Customer portal** link so users can manage/cancel their subscription from the profile page (Paddle hosts this).

6. **Admin billing page** (`/pretentious/billing`) — keep the existing UI; data now flows from Paddle webhooks instead of mock/Stripe data.

## Technical notes

- All Paddle API calls go through TanStack server functions (`createServerFn`) — no edge functions.
- Webhook is a public server route under `src/routes/api/public/` with signature verification before any DB write.
- Subscription state mirrored into Supabase so RLS-scoped queries (current plan, seats, status) stay fast and offline-safe.
- Frontend uses Paddle.js overlay checkout (loaded only on pricing/checkout pages) for the smoothest UX; falls back to hosted redirect.

Ready to enable Paddle?