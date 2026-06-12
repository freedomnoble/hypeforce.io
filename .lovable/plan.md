# Fix the first-run tour for channel entry + mobile

## Problems

1. After onboarding the user lands on a channel (`/w/:id/c/:id`), not the workspace home. The tour does fire there (the shell is shared) but the targets it spotlights (`channels-section`, `new-channel-btn`, `dms-section`) live in a sidebar that is hidden on mobile when a channel is active. Result: spotlights point at nothing on phones.
2. Several targets are desktop-only (`hidden sm:flex`): `workspaces-rail` and `workspace-settings-btn`. On mobile they never exist, so those steps spotlight nothing.
3. The tooltip card overflows the right edge of the phone viewport (visible in the screenshot — "Welcome to your hypef…" is clipped). The centered-modal style doesn't account for narrow screens cleanly, and the docked-tooltip style relies on a target rect that isn't there for step 1.

## Fix

### A. Make the tour mobile-aware (`src/components/hypeforce/tour/tour-overlay.tsx`)

- In `WorkspaceTour`, detect viewport (`matchMedia("(max-width: 639px)")`).
- Build the step list reactively based on `isMobile`, so each step points at an element that actually exists on that breakpoint:

| Step | Desktop target | Mobile target / behavior |
|---|---|---|
| Welcome | centered modal | centered modal (no target) |
| Channels | `[data-tour="channels-section"]` | navigate to `/w/:id` first (Home tab) so sidebar shows, then same target |
| New channel | `[data-tour="new-channel-btn"]` | same, after navigate |
| DMs vs channels | `[data-tour="dms-section"]` | same |
| Workspaces / orgs | `[data-tour="workspaces-rail"]` | `[data-tour="workspace-switcher-mobile"]` (new tag on the "WORKSPACE / Testlocal ⌄" header that opens the workspaces sheet) |
| Agents | no target (concept) | same |
| @mentions | no target | same |
| Pinned context | no target | same |
| Brand voice / settings | `[data-tour="workspace-settings-btn"]` | `[data-tour="mobile-more-tab"]` on the bottom-nav "More" button, with copy adjusted to "open **More → Workspace settings**" |
| Outro (API keys) | modal | modal |

- For the "navigate to home" mobile steps, add an `onEnter` that calls `navigate({ to: "/w/$workspaceId", params })` when the current route is a channel. Passed in from `WorkspaceShell` via a new `navigateHome` prop (so the overlay stays route-agnostic).

### B. Tag the mobile-only targets (`src/components/hypeforce/workspace-shell.tsx`)

- Add `data-tour="workspace-switcher-mobile"` on the mobile sidebar's workspace header row (the one with the chevron at lines ~497-506).
- Add `data-tour="mobile-more-tab"` on the "More" `MobileTabButton` in the bottom nav (line ~968).
- Pass `navigateHome={() => navigate({ to: "/w/$workspaceId", params: { workspaceId } })}` to `<WorkspaceTour>`.

### C. Fix tooltip layout so it never overflows the viewport (`tour-overlay.tsx`)

In `tooltipStyle`:
- On mobile, always dock to bottom: `left: 12, right: 12, bottom: 12`, drop the centered/translate branch entirely. Drop the `width` value so the `left`+`right` insets size the card.
- On the card itself, add `max-w-[calc(100vw-24px)] box-border` and `max-h-[70vh] overflow-y-auto` so long bodies on small screens scroll instead of pushing off-screen.
- On desktop centered (no rect) case, keep the current centered behavior but add the same `max-w` clamp for safety.

### D. Trigger condition unchanged

The existing auto-start in `workspace-shell.tsx` (gated on `tour_completed_at` + sessionStorage) already runs on both the workspace home route and channel routes because both render `WorkspaceShell`. No change needed — the mobile-aware step list handles the channel-entry case by navigating to home for the sidebar steps.

## Out of scope

- No changes to onboarding redirects, tour copy beyond the settings step rewording, the database schema, or `tour.functions.ts`.
- No new analytics, no replay UI changes.
