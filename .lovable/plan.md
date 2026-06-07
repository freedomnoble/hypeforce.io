The flashes come from two places:

1. Every onboarding step (team, project, features, invites, channel) calls `getOnboardingState` on mount and gates its UI behind a local `loading` state, so each step shows `loading…` for a few hundred ms while it refetches the same data it already had on the previous step.
2. The `/onboarding` index route shows `preparing your workspace…` while it figures out which step to send you to. You hit it any time something navigates to `/onboarding` instead of directly to a step.

Plan:

1. Cache onboarding state once, share across all steps
- Wrap `getOnboardingState` in a shared React Query (`['onboarding-state']`) with a sensible `staleTime` (e.g. 60s).
- Use it from every step (`team`, `project`, `features`, `invites`, `channel`) instead of each one calling `useServerFn(getOnboardingState)` + local `useEffect` + `setLoading`.
- After a mutation that changes onboarding state (set name, set project, advance step, subscribe, save invites), invalidate or `setQueryData` so the next screen has fresh data without a visible refetch.

2. Stop blocking each step on the fetch
- Render the step's form immediately. Prefill values from the cached query when present; if cache is empty on first load, show the form with empty fields rather than a spinner panel.
- Remove the per-step `loading…` placeholder. Keep small inline spinners only on submit buttons.

3. Make `/onboarding` quieter
- Render nothing (or just the layout chrome) while the index resolves, instead of the `preparing your workspace…` text. The redirect is fast; the message is what makes the gap feel like a load.
- Keep the existing retry/error UI for the rare actual failure case.

4. Verify the flow
- Walk team → project → features → invites → channel and confirm there is no `loading…` / `preparing…` flash between steps, and that prefilled values still appear correctly.