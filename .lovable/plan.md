## Goal
Meter every Lovable-gateway call per user in credits (1 credit ≈ $0.01 of cost), block when balance hits 0, and let users buy more via Paddle top-up packs. BYOK calls remain unmetered.

## Model
- **Credit** = abstract unit; 1 credit ≈ $0.01 of gateway cost. Markup built into the conversion table (e.g. raw cost × 4 → credits).
- **Per individual user**, not per workspace. Each user has one balance regardless of which workspace they're in.
- **Balance = granted − consumed**, computed on the fly from two ledgers. No mutable balance column (avoids race conditions).

## Schema (one migration)

1. `credit_grants` — every credit a user receives (monthly plan refill, top-up purchase, admin comp, signup bonus).
   - `id`, `user_id`, `amount` (int, positive), `source` (`'plan_monthly' | 'topup' | 'admin' | 'signup'`), `paddle_transaction_id` (nullable, unique when set), `expires_at` (nullable — plan grants expire at period end, top-ups don't), `created_at`.

2. `credit_usage` — every metered gateway call.
   - `id`, `user_id`, `workspace_id`, `message_id` (nullable, FK), `agent_id` (nullable), `model`, `kind` (`'text' | 'image'`), `prompt_tokens`, `completion_tokens`, `image_count`, `estimated_cost_usd_micros` (bigint, raw provider cost ×1e6), `credits` (int, what we charged), `created_at`.
   - Indexed on `(user_id, created_at)`.

3. `model_pricing` — admin-editable rate card.
   - `model` (PK), `kind`, `input_per_1k_credits` (numeric), `output_per_1k_credits` (numeric), `per_image_credits` (int), `updated_at`. Seeded with current Lovable AI rate card × markup.

4. SQL function `get_user_credit_balance(uid uuid)` → int. Sums non-expired grants minus usage in current rolling window. Security definer.

5. Extend `user_usage_limits` with `hard_cap_override` (nullable int) — admin can force a lower cap than balance.

Standard GRANTs + RLS: users SELECT own grants/usage; service_role full access; pricing readable by all authenticated.

## Backend wiring

### `src/lib/credits.server.ts` (new)
- `calcCredits(model, usage)` — pure helper, looks up `model_pricing` cached at module level (refresh every 5 min), returns int credits + raw cost.
- `chargeCredits({ user_id, workspace_id, message_id, agent_id, model, kind, usage })` — insert into `credit_usage`. Returns new balance.
- `assertCanSpend(user_id)` — throws `CreditsExhaustedError` if balance ≤ 0. Used as a pre-flight check.

### `src/lib/agent-router.functions.ts` (edit)
- Before dispatching to gateway: call `assertCanSpend(originating_user_id)`. On throw, insert a system message ("You're out of credits — top up to continue") and stop.
- After `streamLLMIntoRow` completes (capture final `usage` block from the SSE `[DONE]` chunk — gateway includes `prompt_tokens`/`completion_tokens` in the final delta), call `chargeCredits`.
- For `callImageGen`: charge `per_image_credits` per generated image after success.
- BYOK path (`callProvider`): skip both check and charge.

### Monthly plan refill
- Paddle webhook (`subscription.activated`, `transaction.completed` for renewal): insert a `credit_grants` row with `source='plan_monthly'`, amount from plan config, `expires_at = current_period_end`. Plan→credits mapping lives in `pricing_config` (existing table) or a new small `plan_credit_allowances` table.
- On `subscription.canceled`: leave grants in place until they expire naturally.

### Top-up packs
- Create 3 Paddle one-time products: `credits_small` ($5 → 500c), `credits_medium` ($20 → 2200c, +10%), `credits_large` ($50 → 6000c, +20%). Created via `create_product`/`create_price` in test env (sync to live on publish).
- Webhook handler for `transaction.completed` with a top-up `price_id`: insert `credit_grants` row, `source='topup'`, no expiry, deduped by `paddle_transaction_id`.

## Frontend

### `src/components/hypeforce/credit-badge.tsx` (new)
- Small pill in the workspace header showing `{balance} credits`. Realtime: subscribe to `credit_grants` and `credit_usage` INSERTs for current user, re-query balance. Color shifts amber <100, red <20.
- Click opens a popover with: usage this month, "Buy more credits" CTA, link to BYOK setup.

### `src/components/hypeforce/credits-topup-dialog.tsx` (new)
- 3 pack cards. Each opens Paddle overlay via existing `usePaddleCheckout` with `customData: { userId, kind: 'credits_topup', credits: N }`.

### Hard-stop UX
- When gateway call is blocked, the system message in the channel includes inline "Top up" button → opens dialog. Plus toast.
- Settings → Account → Credits page showing balance, last 30 days of usage charts (group by model), grant history.

### `src/routes/_auth.profile.credits.tsx` (new)
- Full ledger view, plan info, top-up packs.

## Admin (`src/routes/pretentious.users.tsx`)
- Add to user drawer: current balance, "Grant credits" button (calls `setUsageLimit` cousin → inserts `credit_grants` with `source='admin'`), recent usage table, plan refill amount override.

## Pricing config
- `plan_credit_allowances` table: `plan` (`founder`/`pro`/`team`/`free`), `monthly_credits`, `signup_bonus`. Free defaults to ~50 credits/month + 100 signup bonus. User edits these in admin without code changes.

## Out of scope
- Per-workspace pooling (deferred).
- Auto-recharge / saved cards.
- Credit rollover semantics beyond grant `expires_at` (top-ups never expire, plan credits expire at period end).
- Refunding credits on canceled streams (small leakage acceptable).
- Real-time gateway cost reconciliation against Lovable's actual billing (we estimate; reconcile manually monthly).

## Trade-offs / risks
- **Cost estimation drift**: rate card lives in DB and must be kept in sync with Lovable AI pricing. If Lovable raises prices and you forget to update, you eat the difference. Mitigation: monthly admin alert if estimated cost / actual Lovable bill diverges >10%.
- **Streaming charge timing**: usage is charged at stream end; a user could fire many parallel streams before any completes. Mitigation: `assertCanSpend` plus a per-user concurrency cap (e.g. max 3 in-flight gateway calls) tracked in a small in-memory set keyed off `user_id` — acceptable approximation.
- **No partial-stream refund**: if stream errors mid-way we still charge for tokens received. Small and acceptable.
- **DB write volume**: one insert per agent reply — negligible.

## Build order
1. Migration (schema + seed pricing + grant function).
2. `credits.server.ts` + agent-router integration + tests.
3. Paddle products + webhook handler for top-ups + plan refill.
4. Credit badge + top-up dialog + system message hard-stop.
5. `/profile/credits` ledger page.
6. Admin drawer additions.
