## Goal

A guided "first run" tour inside `/app` that teaches new users the core Hypeforce concepts. Hybrid format: a welcome modal, spotlight coach marks pointing at real UI on desktop and mobile, and an outro that branches on whether they want to bring their own API keys. Replayable from the profile panel.

## Tour steps

1. **Welcome** — full-screen modal: "Your hypeforce, in one workspace." Buttons: *Take the 90s tour* / *Skip*.
2. **Channels list** — spotlight the channels section in the sidebar. "Channels are rooms shared with your team and agents."
3. **Add a channel** — spotlight the `+` next to Channels. "Create a channel per project, launch, or topic."
4. **DMs vs channels** — spotlight the DMs section. "DMs are private 1:1 threads with one agent or teammate. Channels are shared."
5. **Workspace / org switcher** — spotlight the workspace name / switcher at the top of the rail. "Switch between orgs and workspaces here."
6. **Agents in a channel** — spotlight the channel header members/agents area. "Add or remove agents per channel — each channel has its own roster."
7. **@mention an agent** — spotlight the composer. "Type `@` to call an agent. `@all` pings every agent in the channel."
8. **Context & alignment** — spotlight the pinned-context / channel memo panel. "Pin briefs and alignment docs here so every reply stays on-message."
9. **Personality, roles, brand voice** — spotlight the workspace settings entry (gear). "Set agent personalities, roles, and your brand voice in workspace settings."
10. **Outro — API keys?** — modal: *Do you want to use your own AI provider keys?*
    - **No, use Hypeforce credits** → close tour, focus the composer.
    - **Yes, add my keys** → navigate to `/profile/connections` and end the tour there.

Each step shows: step counter (`3 / 10`), title, one-sentence body, *Back* / *Next* / *Skip tour*. On mobile, the tooltip docks to the bottom of the screen with an arrow pointing to the target; on desktop it floats next to the target.

## Trigger & persistence

- Auto-run once on first visit to `/w/$workspaceId` after onboarding completes.
- Gate stored on `profiles` as a new boolean column `tour_completed_at timestamptz` (nullable). Set via a tiny server function `markTourSeen` and cleared via `resetTour` for replay.
- Add a **Take the tour** row in the mobile profile sheet and the desktop profile menu — calls `resetTour` then navigates back to the workspace which re-triggers the tour.
- A session-storage flag prevents re-running within the same tab if the user dismisses mid-tour.

## Technical design

New files:
- `src/components/hypeforce/tour/tour-provider.tsx` — context + state machine (current step, next/back/skip, target lookup by `data-tour="<id>"`, position calc with `getBoundingClientRect`, resize/scroll listeners, focus trap on tooltip).
- `src/components/hypeforce/tour/tour-overlay.tsx` — fixed full-screen overlay with an SVG mask that cuts a rounded rectangle around the target (darkens the rest), plus the tooltip card. Responsive: tooltip floats on `sm+`, docks bottom on mobile. Uses framer-motion for fade/slide.
- `src/components/hypeforce/tour/steps.ts` — declarative step list (`id`, `target`, `title`, `body`, `placement`, optional `onEnter` to e.g. open the mobile sidebar before highlighting it).
- `src/components/hypeforce/tour/welcome-modal.tsx` and `outro-modal.tsx` — full-screen step 1 and step 10.
- `src/lib/tour.functions.ts` — `markTourSeen`, `resetTour` server fns (auth-gated via `requireSupabaseAuth`).

Touch points (add `data-tour` attributes only, no behavior changes):
- `workspace-shell.tsx`: workspace switcher, channels header + `+` button, channels list, DMs section, channel header members area, composer, pinned-context panel, workspace settings (gear), profile entry.
- `_auth.w.$workspaceId.c.$channelId.tsx`: composer + pinned context anchors if they live there.

Mobile handling:
- Steps that target sidebar items first call `onEnter` to open the mobile nav sheet, wait one frame, then measure the target. Closing the tour restores prior sheet state.
- Tooltip never wider than `min(360px, 100vw - 24px)`; safe-area inset respected.

Trigger wiring:
- In `WorkspaceShell`, on mount, read `profiles.tour_completed_at`. If null and `profiles.onboarding_step >= 8`, mount `<TourProvider autoStart />`.
- "Take the tour" entries in profile panel call `resetTour()` then `tour.start()`.

## Out of scope

- No new onboarding routes; the existing `/onboarding/*` flow is untouched.
- No changes to agent/channel/membership logic.
- No analytics beyond a single `tour_completed_at` timestamp.
- No copy changes to existing screens beyond adding `data-tour` hooks.
