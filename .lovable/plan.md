## Root cause

The three links on the profile page are already wired to `/profile/billing`, `/profile/credits`, and `/profile/connections`, and those route files exist with real implementations. They "do nothing" because of a TanStack file-routing conflict:

- `src/routes/_auth.profile.tsx` is the route at `/profile`, but its component renders the profile form directly — it does **not** render an `<Outlet />`.
- `_auth.profile.billing.tsx` / `.credits.tsx` / `.connections.tsx` are children of `/profile`, so they're meant to render inside the parent's `<Outlet />`.
- Result: the URL changes when you click a link, but the parent route has no slot to render the child, so the page visibly stays on the profile form — looks like the buttons are dead.

## Plan

1. Split the `/profile` route into a tiny layout + an index page:
   - Rename `src/routes/_auth.profile.tsx` → `src/routes/_auth.profile.index.tsx` (this becomes the profile form at `/profile`, unchanged content).
   - Create a new `src/routes/_auth.profile.tsx` that is a minimal layout: `component: () => <Outlet />`, with the same `head()` title.
2. Verify by clicking each of the three rows on `/profile`:
   - Subscription & billing → `/profile/billing` renders the existing Paddle billing page (manage plan / cancel / customer portal).
   - Credits → `/profile/credits` renders the credits balance/history/top-up page.
   - AI Connections → `/profile/connections` renders the BYOK key management page.
3. No DB changes, no new dependencies, no edits to the three destination pages — they already work; we're just letting them render.

## Technical details

- Layout file content (new `_auth.profile.tsx`):
  ```tsx
  import { createFileRoute, Outlet } from "@tanstack/react-router";
  export const Route = createFileRoute("/_auth/profile")({
    component: () => <Outlet />,
  });
  ```
- The renamed `_auth.profile.index.tsx` keeps the existing `createFileRoute("/_auth/profile/")` (TanStack treats `index` segment as the parent's root path) and the full `ProfilePage` component, including the three `<Link to="/profile/...">` rows.
- Nothing changes for the billing/credits/connections route files.
