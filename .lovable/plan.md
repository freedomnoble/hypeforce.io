# Fix: invited users see "Subscribe" instead of "Gifted"

## Root cause

`src/routes/join.$token.tsx` stashes the invite token in `sessionStorage` for signed-out visitors and redirects to `/welcome`. Redemption (which sets `profiles.is_comped = true`) only runs once the user reaches `/app` — *after* finishing the whole onboarding flow. So during onboarding, `data.is_comped` is `false` and `/onboarding/features` shows **Subscribe** instead of **Gifted**.

This is not a Safari vs Chrome bug. Anyone going through the join → signup → onboarding flow as a new user hits this. You see "Gifted" in incognito because your account already has `is_comped = true` from a prior redemption.

## Change

Redeem the pending invite token as soon as the user is authenticated, before the features/subscribe step renders.

### 1. `src/lib/onboarding.functions.ts` — `getOnboardingState`
After loading the profile, if `profile.is_comped` is false, attempt to redeem any pending token (the client will pass it through). Cleanest split:
- Keep `getOnboardingState` read-only.
- Add no server-side token storage — keep the token client-side via sessionStorage as today.

### 2. `src/routes/_auth.onboarding.features.tsx`
On mount, if `!data.is_comped` and `sessionStorage` has `hypeforce.pending_invite_token`:
1. Call `redeemInviteToken({ data: { token } })`
2. On success: `sessionStorage.removeItem(...)` and refetch onboarding state (so `data.is_comped` flips to true and the button renders **Gifted**)
3. On failure: silently leave the token in place (existing `/app` fallback still runs later) and keep showing **Subscribe**

This is the minimal surface change — one `useEffect` in the features step plus a refetch on the onboarding query.

### 3. Also redeem on `/welcome` (defensive)
Add the same redeem-if-pending effect to `src/routes/welcome.tsx` once a session exists, so the comped state is in place from step 1 of onboarding (relevant if we later show pricing earlier). Optional but cheap.

## Files touched
- `src/routes/_auth.onboarding.features.tsx` — add redeem-on-mount effect + refetch
- `src/routes/welcome.tsx` — same defensive redeem when a session exists
- (No DB / server function changes — `redeemInviteToken` already does exactly what's needed.)

## Verification
1. Wipe `is_comped` for a test account, clear sessionStorage.
2. Visit `/join/<token>` signed out → sign up → reach `/onboarding/features`.
3. Button should render **Gifted** (disabled, secondary variant), Continue enabled.
4. Existing flow for already-subscribed users and non-invited users unchanged.
