I reviewed the recording and current runtime signals. The loop is no longer just a background chunk issue: the app is repeatedly bouncing through the `/app` gateway (`loading workspace… step: session`) and sometimes landing in the root error boundary (`This page didn't load`). The fix should make `/app` a stable one-shot resolver instead of a route that can re-run repeatedly during auth/session invalidation.

Plan:

1. Harden the auth gate
- Update `src/routes/_auth.tsx` so protected routes tolerate the post-signup/session write race the same way `/app` partially does: retry `getSession()` briefly before redirecting to `/login`.
- Avoid console-noisy redirects and make the redirect destination deterministic.

2. Make `/app` loop-proof
- Replace the current `useEffect` gateway resolver with a guarded resolver that:
  - only runs once per mount/attempt,
  - ignores stale async completions,
  - waits for auth state to settle before deciding there is no session,
  - navigates directly to `/onboarding/*` when onboarding is incomplete,
  - does not get restarted by harmless auth/query invalidations.
- Add better error detail in the `/app` route error UI so if it fails again the actual message is visible.

3. Stop global auth invalidation from interrupting onboarding
- Adjust the root auth-state invalidation behavior so sign-in still refreshes app state, but it does not repeatedly invalidate while the user is already inside `/app` or `/onboarding` resolution.
- Keep query invalidation for real sign-in/sign-out transitions only.

4. Stabilize onboarding index and step screens
- Add error handling around `getOnboardingState()` in `/onboarding` index and the first steps so a transient server-function/auth failure shows a retryable error instead of throwing into the root boundary.
- If onboarding state says the user is complete, navigate once to `/app`; otherwise navigate once to the correct next step.

5. Verify the exact flow from the recording
- Test mobile-sized `/welcome` → create profile → `/onboarding/team`.
- Test tapping Continue on the team step to ensure it advances instead of bouncing back to `/app` or showing the root error boundary.
- Check console/network for repeating `getSession`, `_serverFn`, or module import failures after the fix.