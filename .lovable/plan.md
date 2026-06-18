## OpenClaw Phase 2

Replace the `WizardPlaceholder` with the real agent-builder experience. Everything stays gated behind the existing `openclaw_enabled` feature flag and `openclaw_can_use` (subscription + COGS cap) check — no plan/billing changes.

### 1. Agent list (`/w/$workspaceId/openclaw`)

When the flag is on, render the user's agents from `openclaw_agents` scoped to the current workspace:

- Empty state with "Create your first agent" CTA.
- Card grid: display name, model, gateway status pill (`provisioning` / `ready` / `error` / `stopped`), last-active timestamp.
- "New agent" button → opens the wizard sheet.
- Each card links to the detail page.

### 2. Five-step create wizard (sheet/dialog)

Single multi-step component, local form state, persists on final step.

1. **Identity** — display name, short description.
2. **Persona** — system prompt textarea + tone presets (writes to `persona` jsonb).
3. **Model** — pick from a curated allowlist (`google/gemini-3-flash-preview`, `openai/gpt-5-mini`, `anthropic/claude-haiku-4-5`).
4. **Skills** — freeform skill cards (name + instructions), stored in `skill_definitions` jsonb.
5. **Tools & review** — checkbox list for `tool_allowlist` (`web_search`, `code_exec`, `image_gen`, `http_fetch`), review summary, Create button.

Create flow: server fn `createOpenclawAgent` inserts the row, then kicks off Fly provisioning (next section), then returns the new agent id. UI navigates to the detail page.

### 3. Agent detail page (`/w/$workspaceId/openclaw/$agentId`)

- Header with name, model, status pill, last-active.
- Tabs: **Overview** (persona + skills + tools, read-only summary), **Config** (edit form reusing wizard fields), **Runtime** (`fly_app`, `fly_machine_id`, `gateway_url`, status, "Restart" and "Stop" buttons).
- Delete agent (destroys Fly machine, removes row).
- No chat UI yet — that's Phase 3.

### 4. Fly machine provisioning

A thin Fly Machines client in `src/lib/fly.server.ts` (called only from server functions, never from routes/components at module scope). Uses Fly's Machines REST API.

Server functions in `src/lib/openclaw.functions.ts`:

- `createOpenclawAgent` — insert row, set `gateway_status='provisioning'`, call Fly to create a per-agent app + machine, store `fly_app`, `fly_machine_id`, `gateway_url`, set `gateway_status='ready'` (or `error` with a logged reason).
- `restartOpenclawAgent` / `stopOpenclawAgent` — POST to Fly machine lifecycle endpoints.
- `deleteOpenclawAgent` — destroy machine + app, delete row.
- `listOpenclawAgents` / `getOpenclawAgent` — read for the list and detail pages.
- All gated by `requireSupabaseAuth` and re-check `openclaw_can_use` before any Fly call to respect the COGS cap.

A single agent image is used (assumed already published — image ref configurable via `FLY_AGENT_IMAGE`). Per-machine env includes the agent id, model, persona, tools, and a one-shot signed token the agent uses to call back into Hypeforce.

Status is updated synchronously inside the create handler; a follow-up "refresh status" server fn polls Fly when the user re-opens the detail page.

### 5. Secrets required

Two new runtime secrets are needed before the Fly code can run. I'll request them after this plan is approved:

- `FLY_API_TOKEN` — Fly.io personal access token (`fly auth token`).
- `FLY_ORG_SLUG` — Fly organization slug agents are created in.

Optional override: `FLY_AGENT_IMAGE` (defaults to a placeholder; I'll note the exact value to set once the agent image is published).

### 6. Out of scope (Phase 3+)

- Live chat / streaming responses from the agent gateway.
- Tool execution sandbox.
- Sharing agents across workspace members.
- Per-tool usage metering beyond the existing `openclaw_cogs_ledger`.

### Files

- New: `src/routes/_auth.w.$workspaceId.openclaw.$agentId.tsx`, `src/components/hypeforce/openclaw/agent-card.tsx`, `src/components/hypeforce/openclaw/agent-wizard.tsx`, `src/lib/fly.server.ts`.
- Edited: `src/routes/_auth.w.$workspaceId.openclaw.tsx` (list + wizard trigger), `src/lib/openclaw.functions.ts` (CRUD + Fly orchestration).

No DB migration — `openclaw_agents` already has every column we need.
