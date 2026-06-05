## Fix: ThemeProvider auth-event loop saturating Supabase connections

The diagnosis is correct and matches the code in `src/components/hypeforce/theme-provider.tsx`. Two compounding issues:

1. `refreshCustomThemes()` calls `supabase.auth.getUser()` — a network round-trip that itself emits auth events.
2. `onAuthStateChange(() => refreshCustomThemes())` fires on every event (`INITIAL_SESSION`, `TOKEN_REFRESHED`, `USER_UPDATED`, …), so each call re-triggers itself → 6-connection pool to the Supabase host saturates → `/pretentious`'s `checkSuperAdmin` and `/login`'s `signInWithPassword` queue forever.

### Changes

**`src/components/hypeforce/theme-provider.tsx`** — two surgical edits:

1. Replace `supabase.auth.getUser()` with `supabase.auth.getSession()` inside `refreshCustomThemes` (reads from memory/localStorage, no network, no event emission). Use `sess.session?.user?.id` for the auth gate.

2. Filter the `onAuthStateChange` listener to only refetch on `SIGNED_IN` / `SIGNED_OUT`, ignoring `INITIAL_SESSION`, `TOKEN_REFRESHED`, `USER_UPDATED`.

No other files need to change. The `auth-attacher` timeout and `__root.tsx` invalidation filter from earlier turns stay as-is — they're complementary safety nets, but this is the actual source.

### Verification

- Reload `/pretentious` while signed in as `freedom.jnoble@gmail.com` → should resolve to admin shell within ~1s instead of hanging at "verifying access…".
- Network tab should show one `getSession` (local, no request) and one `checkSuperAdmin` POST, not a flood of `/auth/v1/user` calls.
- Login flow on `/login` should complete normally on the first attempt with no 15s timeout.
