# Fix: Annual discount showing as -0%

## Root cause

The discount logic in `landing-page.tsx` is correct, but the live data isn't. Your `pricing_config` row has `discount_percent = 0`:

```
founder_price_monthly: 900 ($9/mo)
discount_percent: 0          ← should be 10
```

So the math runs as $9 × 12 × (1 − 0%) = **$108/yr** with a **−0%** badge — exactly what your screenshot shows. The `?? 10` fallback in code only kicks in when the column is `null`, not when it's `0`.

## Fix

One data update — no schema change, no code change:

```sql
UPDATE public.pricing_config SET discount_percent = 10 WHERE id = 1;
```

After that, with $9/mo monthly:
- Annual badge: **−10%**
- Annual price card: **$8.10/mo · billed $97/yr** (rounded)
- Subhead: *"10% off · locked in forever · cancel anytime."*

## Paddle side (already correct, just confirming)

- `founder_monthly` = $9.00/mo ✅
- `founder_annual` = $97.00/yr (≈ $9 × 12 × 0.9) ✅

Checkout already routes to `founder_annual` when Annual is selected, so customers will be charged the discounted $97/yr immediately after this fix — no Paddle changes needed.

## Optional follow-up (not in this change)

The displayed annual total ($97) is rounded from the actual $97.20 (9 × 12 × 0.9). The Paddle price is $97 flat, so what the customer is charged matches the card. If you ever want them to line up exactly, we can either set `founder_annual` to $97.20 in Paddle or keep displaying $97 and adjust the rounding — say the word and I'll wire it.
