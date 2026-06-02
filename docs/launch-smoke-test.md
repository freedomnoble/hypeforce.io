# Launch Smoke Test Checklist

Run through this checklist before inviting real users. It covers the critical
auth, routing, collaboration, and BYOK flows that have broken in the past.

The checklist is split into **Automated checks** (things you can run from the
command line) and **Manual checks** (things a human must click through in the
preview or production build).

> Do **not** paste real API keys or passwords into this document or any
> screenshot you attach to a bug report. Use throwaway test accounts.

---

## Automated checks

The project uses [Vitest](https://vitest.dev/) (`vitest@^4`) but does not yet
expose a `test` npm script. Run tests directly with `bunx`:

```bash
# Production build must pass
bun install
bun run build

# Unit tests for the pure auth-invalidation helper
bunx vitest run src/lib/__tests__/auth-invalidation.test.ts
```

### What is covered today

- `src/lib/__tests__/auth-invalidation.test.ts` — pure-function tests for the
  `shouldInvalidateRouter` helper used by `src/routes/__root.tsx`. Verifies
  that `INITIAL_SESSION`, `TOKEN_REFRESHED`, `USER_UPDATED`, and repeated
  `SIGNED_IN` for the same user do **not** trigger router invalidation, while
  real identity transitions do.

### What should become automated next

Server functions in `src/lib/*.functions.ts` (`bootstrap`, `collab`,
`ai-connections`, `agent-router`) are integration-shaped — they need a live
Supabase test project to exercise RLS. Until a test database is wired up they
remain manual checks below. Candidates to automate first:

1. `ensureUserBootstrap` idempotency (running it twice produces no duplicates).
2. `createWorkspaceWithOwner` rollback when membership insert fails.
3. `setAgentRoute` rejecting invalid route strings via the Zod schema.

---

## Manual checks

Use a fresh incognito window for each "new user" scenario. Watch the network
panel and console for the listed flicker / loop symptoms.

### 1. Production build passes

- [ ] `bun run build` exits 0 with no `@tanstack/query-core` resolution error
      and no TypeScript errors.
- [ ] `bun run build:dev` also succeeds (this is what the preview uses).

### 2. New user sign-up lands in a workspace without flicker

- [ ] Sign up at `/login` with a new email.
- [ ] After email confirmation, the app should land on
      `/w/:workspaceId/c/:channelId` directly.
- [ ] The "loading workspace… step: workspace" gateway overlay must **not**
      reappear after the workspace UI has rendered.
- [ ] The "No workspace yet / Sign out and back in to seed one" copy must
      **never** appear — the gateway calls `ensureUserBootstrap`
      (`src/lib/bootstrap.functions.ts`) to repair missing workspaces.

### 3. Existing user sign-in does not visibly visit `/app`

- [ ] Sign in at `/login` with a confirmed account.
- [ ] The URL bar should transition `/login` → `/w/:workspaceId/c/:channelId`
      without a visible stop on `/app` or `/`.
- [ ] Refreshing while on the workspace stays on the workspace.

### 4. Unauthenticated protected route redirects to `/login`

- [ ] In a fresh incognito window, open `/w/anything/c/anything` directly.
- [ ] You should be redirected to `/login` (handled by `_auth.tsx` guard).
- [ ] Same for `/profile` and `/profile/connections`.

### 5. Workspace creation: owner membership + landing route

- [ ] From the workspace shell, click **New Workspace** and enter a name.
- [ ] The new workspace appears in the sidebar and you land on its default
      channel without an error toast.
- [ ] No "half-broken" workspace: if you reload, the new workspace is still
      present with you as a member. This is enforced atomically by
      `createWorkspaceWithOwner` in `src/lib/collab.functions.ts` — if the
      `workspace_members` insert fails, the workspace row is deleted.

### 6. Channel creation: creator membership

- [ ] Inside a workspace, create a new channel.
- [ ] You should immediately be able to post in it (you are a member).
- [ ] Reload — the channel persists and you are still listed as a member.
      Atomicity is enforced by `createChannelWithMembership`.

### 7. DM creation: all participants present

- [ ] Start a DM with an agent (e.g. `@manus`) via the "Group DM" or
      `startDmWithAgent` helper in `src/components/hypeforce/workspace-shell.tsx`.
- [ ] Reload — both you and every selected agent/user appear in the DM
      participant list. Atomicity is enforced by `createDmWithParticipants`.

### 8. Cross-tenant isolation

- [ ] In browser A, sign in as user A and note a workspace id from the URL.
- [ ] In browser B (different account), paste user A's
      `/w/:workspaceId/c/:channelId` URL.
- [ ] User B must be denied: either redirected away or shown an empty/forbidden
      state — never user A's messages, channel list, or workspace name.
- [ ] Repeat for `/w/:workspaceId/admin` and `/w/:workspaceId/d/:dmId`.

### 9. AI provider key connection (BYOK)

Tested from `/profile/connections`
(`src/routes/_auth.profile.connections.tsx`).

- [ ] Connect a provider key (OpenAI / Anthropic / Google / Manus).
- [ ] The UI shows only a masked preview (e.g. `sk-…abcd`) — never the full
      key, even after refresh.
- [ ] Open DevTools → Network. No request or response body contains the raw
      key after it has been saved (the server returns metadata only).
- [ ] Console / source maps do not contain the raw key.
- [ ] Disconnect removes the connection and any agent routed to it falls back
      gracefully (see check 10).

### 10. Agent route assignment

- [ ] As a **non-admin** workspace member, attempt to change an agent's
      `preferred_route` from the admin UI. The action must be rejected with a
      clear error toast (enforced server-side by `setAgentRoute` via
      `is_workspace_admin`).
- [ ] As an admin, try to set a route to `byok:openai` while you have **no**
      active OpenAI connection. The server must reject it.
- [ ] As an admin, try to submit an arbitrary route string (e.g. via devtools
      `fetch` to the server function). The Zod `RouteSchema` must reject
      anything outside `lovable` or `byok:{openai|anthropic|google|manus}`.
- [ ] When a routed BYOK provider call fails at runtime, the agent posts a
      friendly in-chat message and the connection is auto-marked `invalid`
      in `user_ai_connections`.

---

## Sign-off

| Date | Build SHA | Tester | Result |
|------|-----------|--------|--------|
|      |           |        |        |
