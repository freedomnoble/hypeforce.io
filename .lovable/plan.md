## Goal

On mobile (`< md`, i.e. `< 768px`), make the four existing panels reachable through Slack-style navigation instead of all stacking into one scroll. Desktop and tablet layouts are unchanged. No visual redesign — same components, same styling, just rewired for mobile.

The four panels today:
1. **Far-left workspace rail** (`<aside hidden sm:flex>` in `workspace-shell.tsx`) — workspaces + global actions (settings, inbox, help, sign-out).
2. **Sidebar** (`<aside hidden md:flex>` in `workspace-shell.tsx`) — channels list + DMs list + bottom user row.
3. **Main chat** (`<main>` — channel or DM page content).
4. **Right context panel** (`<aside hidden lg:flex>` in `_auth.w.$workspaceId.c.$channelId.tsx` and `_auth.w.$workspaceId.d.$dmId.tsx`) — Members / details.

## Mobile flow

- Landing on a workspace route with no channel/DM selected → show the **Sidebar** full-screen (channels + DMs list), like Slack's Home tab. The chat `<main>` is hidden on mobile in this state.
- Tap a channel/DM → navigate to its route; on mobile show the **chat** full-screen with a top bar that has:
  - Back chevron (left) → returns to the channels list.
  - Channel/DM title (center, tappable) → opens the **right context panel** as a right-side Sheet.
  - Workspace avatar (far left, before back) → opens the **workspaces drawer** as a left-side Sheet (mirrors Slack's org switcher).
  - User avatar (far right) → opens a **profile sheet** with workspace settings, theme toggle, inbox, help, sign-out (the actions currently on the far-left rail bottom).
- Bottom tab bar (mobile only): **Home** (channels list), **DMs** (DM-filtered list), **Activity** (admin inbox), **More** (profile sheet). Matches Slack's bottom nav pattern without copying it.

## Implementation

### 1. `src/components/hypeforce/workspace-shell.tsx`

- Wrap the far-left rail and the sidebar's content so on mobile they render inside `Sheet` (from `@/components/ui/sheet`) instead of as `aside`s:
  - Keep current `aside` markup intact for `sm:`/`md:` breakpoints (no change desktop/tablet).
  - Add three mobile-only sheets, controlled by new state (`workspacesSheetOpen`, `sidebarSheetOpen`, `profileSheetOpen`):
    - **Workspaces sheet** (`side="left"`, narrow) — reuses the workspace list + "new workspace" button from the far-left rail.
    - **Sidebar sheet** is NOT needed because the sidebar IS the mobile home view (see point 2).
    - **Profile sheet** (`side="right"` or bottom) — reuses the bottom user row actions: theme toggle, Workspace Settings, Inbox, Help, Sign out.
- On mobile, render the sidebar inline (full-width, fills the screen minus bottom tab bar) **only when no channel/DM is active**. When a channel/DM is active, hide the sidebar on mobile and show `<main>` full-width. Use `activeChannelId`/`activeDmId` props (already passed in) plus Tailwind responsive classes (`md:flex` stays for desktop; add a conditional `flex md:flex` vs `hidden md:flex` based on active state for mobile).
- Add a **mobile bottom tab bar** (`fixed bottom-0 inset-x-0 md:hidden`) with 4 tabs: Home, DMs, Activity, More. Home/DMs route to `/w/$workspaceId` (clearing active channel/DM); Activity opens inbox flyout; More opens profile sheet.
- The `<main>` already takes `children`. On mobile, ensure `main` is `h-[100dvh] - bottom-bar` and that internal chat scroll works (the chat page already manages its own scroll container — verify it uses `flex-1 overflow-y-auto`).

### 2. `src/routes/_auth.w.$workspaceId.c.$channelId.tsx` and `…d.$dmId.tsx`

- The chat header (h-14 top bar) gets two new mobile-only buttons:
  - Left: workspace avatar button (`md:hidden`) → calls a shell-exposed callback to open the workspaces sheet, plus a back chevron that navigates to `/w/$workspaceId` (which shows the sidebar list on mobile).
  - The existing header title becomes a tappable button on mobile that opens the right context panel as a Sheet.
  - Right: user avatar (`md:hidden`) → opens profile sheet.
- The right context `<aside>` stays `hidden lg:flex` for desktop. On mobile, render the same content inside a `Sheet` (`side="right"`) controlled by local state, toggled by the title tap.

To avoid prop-drilling, add lightweight context (`MobileShellContext`) in `workspace-shell.tsx` exposing `openWorkspacesSheet()`, `openProfileSheet()`, and the active workspace + profile data so chat pages can wire their mobile header buttons.

### 3. `src/routes/_auth.w.$workspaceId.index.tsx`

Currently redirects to first channel. On mobile this is wrong — user should land on the channel list. Change: only auto-redirect on `md+` screens (check `useIsMobile()` from `src/hooks/use-mobile.tsx`). On mobile, just render `<WorkspaceShell workspaceId={...} />` (no active channel) so the sidebar shows full-screen.

### 4. Bottom tab bar

New small component `MobileTabBar` rendered inside `WorkspaceShell` (mobile-only). 4 buttons with lucide icons (`Home`, `MessageSquare`, `Bell`, `MoreHorizontal`). Active state derived from current route + active props.

### 5. DMs tab

Reuse the existing DM filter state. The DMs tab navigates to `/w/$workspaceId` and sets a query param `?view=dms` that the sidebar reads to pre-select the DM section / scroll to it (or simply renders only DMs). Minimal: set `dmFilter` to `"all"` and scroll the DM section into view.

## Non-goals

- No changes to colors, fonts, paddings, glass effects, or any desktop/tablet layout.
- No changes to chat behavior, message sending, agents, auth, or routing other than the mobile-only index behavior.
- No new dependencies (Sheet, Avatar, Button, useIsMobile all already exist).

## Verification

Resize preview to mobile (375×812):
1. Land on `/w/:id` → channels + DMs list fills screen, bottom tab bar visible, no horizontal/vertical page scroll outside lists.
2. Tap a channel → chat fills screen, header shows workspace-avatar + back + title + user-avatar.
3. Tap title → right context Sheet slides in from right.
4. Tap workspace avatar → workspaces Sheet slides in from left.
5. Tap user avatar or "More" tab → profile Sheet with settings/theme/inbox/help/sign-out.
6. Tap "DMs" tab → returns to list focused on DMs.
7. Resize to ≥ `md` → exact current desktop layout, no mobile bars visible.
