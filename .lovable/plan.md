## Goal

Add an in-product "OpenClaw agent" builder to Hypeforce so non-technical users can create, configure, and chat with their own OpenClaw assistant — without ever touching GitHub, a terminal, or a config file. OpenClaw is positioned as a **gated upsell**: visible to everyone, blocked at the "Create" step for non-paying users, and capped at **$4/month COGS** per paying user, after which they upgrade or buy credits.

Channel scope (v1 AND v2): **Hypeforce internal web chat only.** No Slack, no WhatsApp, no iMessage.

## Feature flags (two-flag gate)

Two flags in the admin Feature Flags console:

1. **`openclaw_studio`** — *default OFF.* Master kill switch. When OFF, the OpenClaw entry is hidden from the sidebar everywhere. (Already in the original plan.)
2. **`openclaw_enabled`** — *default OFF.* "Is the build actually shippable yet?" When OFF (but `openclaw_studio` ON), the OpenClaw sidebar entry IS visible — clicking it opens a **"OpenClaw — coming soon"** placeholder page instead of the wizard. No provisioning, no Fly Machine calls, no paywall. This lets us tease the feature on the sidebar and collect interest before the backend is live. When ON, the full wizard / chat / paywall flow described below activates.

Both flags ship as rows in `feature_flags` set to `false` by default, manageable from `/pretentious/flags`.

The "coming soon" page is a simple branded panel with copy ("Your own AI agent, built in. Coming soon.") and an optional "Notify me" button that writes to a small `openclaw_waitlist` table (one row per user, unique on user_id).

## Architecture (confirmed)

- **One OpenClaw gateway per Hypeforce user** running on a **Fly Machine** (auto-stop when idle, ~1–2s cold start, billed per-second).
- **Hypeforce DB is source of truth** for the agent's persona, skills, and tool allowlist. The Fly Machine's filesystem is ephemeral — on boot, a small script downloads the user's workspace bundle (signed URL from Hypeforce) and writes `~/.openclaw/workspace/` from it.
- **`agents.defaults.sandbox.mode: "all"`** with the Docker backend so every non-main session runs in a sandbox.
- **WebChat channel** built into OpenClaw is the only enabled channel. Hypeforce's chat UI proxies messages over OpenClaw's WS RPC through a Hypeforce-side server route (the Fly Machine never accepts public internet traffic directly).

```text
Hypeforce UI ──► server fn ──► Fly Machines API ──► per-user OpenClaw gateway
                                                        ▲
                              signed bundle URL ────────┘ (boot pulls workspace)
```

## What the user sees

### Visibility matrix

| `openclaw_studio` | `openclaw_enabled` | What user sees |
| --- | --- | --- |
| OFF | (any) | No OpenClaw sidebar entry, no routes registered |
| ON | OFF | Sidebar entry visible → "Coming soon" placeholder + Notify-me |
| ON | ON | Full wizard / chat / paywall (described below) |

### When fully enabled

- "OpenClaw" appears in the workspace sidebar for **everyone** (including free-trial, gifted, free-preview).
- They can open the index page, see what OpenClaw is, browse skill templates, and step through the create wizard end-to-end.
- The **final "Create my agent" button** is the paywall. Non-paying users (no active sub, no comp) see an inline upgrade modal: "OpenClaw agents are included with any paid plan." with CTAs to subscribe (existing `/profile/billing`).
- Comped users get straight through (they already bypass `can_send_message()`).

### Wizard (5 steps, visible to everyone)
1. Name + avatar
2. Persona — display name, role, voice/tone (reuses fields from `AgentIdentityEditor`)
3. What is this agent good at? — multi-select from 6–8 seeded skill templates ("Research assistant," "Daily standup writer," "Email triage drafter," "Code reviewer," "Meeting note summarizer," "Competitor watcher," "Inbox zero coach," "Plain-English explainer") + free-text "anything else?"
4. Model — defaults to Lovable AI Gateway; BYOK users can pick from connected providers
5. Review + the gated "Create my agent" button

### Provisioning screen
"Setting up your private agent (about 30 seconds)…" with a determinate bar (machine create → boot → workspace pull → gateway ready).

### Chat surface (`/_auth/w/$workspaceId/openclaw/$agentId`)
- Renders inside `WorkspaceShell`, looks like a channel.
- AI SDK `useChat` keyed by `agentId`, messages persisted in Hypeforce DB.
- Streamed tool activity via `message.parts`.
- **COGS-limit state**: when the $4/mo cap hits, the composer is replaced by a non-dismissible upgrade panel with two CTAs:
  - Upgrade to $19/mo tier (if on $9 founder or lower)
  - Buy Agent Credits (pay-as-you-go top-up, reuses `CreditsTopupDialog`)
  - Past messages remain readable.

### Edit-agent panel
Same wizard reused for edits, plus Knowledge tab (reuses existing KB upload flow), Tools tab (plain-English toggles → OpenClaw sandbox allowlist), Danger Zone (delete agent → tears down Fly Machine).

### Skill Studio (Phase 3)
"Describe a skill in plain English" textbox → `generateSkillFromPrompt` server fn (Lovable AI, structured output → `{ name, description, triggers, steps, tools_used }`) → preview the rendered `SKILL.md` → save → workspace re-render → hot-reload over RPC.

## COGS tracking and $4/mo cap

### Data model (Phase 1 migration)
- `openclaw_agents` — `user_id`, `workspace_id`, `display_name`, `persona jsonb`, `model_id`, `tool_allowlist text[]`, `skill_definitions jsonb`, `fly_machine_id`, `fly_app`, `gateway_url`, `gateway_status` (`provisioning|running|stopped|error|destroyed`), `last_active_at`. RLS scopes to owner.
- `openclaw_cogs_ledger` — append-only: `user_id`, `agent_id`, `kind` (`compute_seconds|model_usage`), `amount_micros_usd bigint`, `period_start`, `period_end`, `source` (`fly|model_router`), `external_id`. Index on `(user_id, created_at)`.
- `openclaw_waitlist` — `user_id` (unique), `created_at`. For the "coming soon" Notify-me button.
- RPC `get_openclaw_cogs_cents(uid uuid, period_start timestamptz)` → cents this billing period.
- RPC `openclaw_can_use(uid uuid)` → `{ allowed, reason: 'no_subscription'|'cogs_capped'|'ok', cogs_cents, cap_cents }`.
- Existing `can_send_message()` is NOT modified — OpenClaw has its own gate so a capped OpenClaw user can still use normal Hypeforce channels.

### Data sources
- **Fly compute**: daily HMAC-protected sweep at `/api/public/openclaw/sweep` (pg_cron) pulls per-machine seconds from the Fly Machines API and writes `compute_seconds` rows.
- **Model usage**: the gateway routes through Lovable AI Gateway (default) so token usage flows through `credit_usage`. Rows tagged with an OpenClaw `agent_id` are mirrored to `openclaw_cogs_ledger` at USD-equivalent micros.
- BYOK users: only their Fly compute counts toward the cap.

### Enforcement
- Send-time: message-proxy server fn calls `openclaw_can_use(uid)` first. If `cogs_capped`, returns a typed error the chat surface catches.
- Read-side: `useQuery` on `openclaw_can_use`, polled every 30s while the chat is open + invalidated on send.
- Idle-stop: Fly auto-stop after 5 min; on next message the proxy starts the machine and waits for `gateway_status: running`.
- Hard kill at 1.5× cap ($6/mo) regardless of payment state, with email notice.

### Cap value
Stored in a small `openclaw_settings` row so it's tunable without a deploy. Default $4.00 (400 cents).

## Implementation phases

### Phase 1 — Foundations + flags + "coming soon" surface
- Migration: `openclaw_agents`, `openclaw_cogs_ledger`, `openclaw_waitlist`, `get_openclaw_cogs_cents`, `openclaw_can_use`, settings row, two feature-flag rows (`openclaw_studio` + `openclaw_enabled`, both `false`).
- Sidebar entry in `workspace-shell.tsx` gated on `openclaw_studio`.
- Route `/_auth/w/$workspaceId/openclaw` that reads `openclaw_enabled`:
  - **OFF →** "Coming soon" panel + Notify-me button (writes to `openclaw_waitlist`).
  - **ON →** wizard/list (built in Phase 2).
- Fly Machines token secret + base Fly image + bundle endpoint scaffolded but inert while `openclaw_enabled` is OFF.

### Phase 2 — Wizard + chat surface (only reachable when `openclaw_enabled` is ON)
- `/_auth/w/$workspaceId/openclaw` — landing/list visible to everyone, "Create" CTA opens wizard.
- `/_auth/w/$workspaceId/openclaw/new` — 5-step wizard. Step-5 "Create" calls `createOpenclawAgent` which re-checks subscription/comp and returns `{ paywall: true }` for non-payers; UI shows upgrade modal instead of provisioning.
- `/_auth/w/$workspaceId/openclaw/$agentId` — chat surface with COGS-capped UI state.
- Send-message server fn proxying to the gateway with typed `cogs_capped` error.

### Phase 3 — Skill Studio
- `/_auth/w/$workspaceId/openclaw/$agentId/skills` — list/create/edit as structured forms.
- `generateSkillFromPrompt` server fn (Lovable AI structured output).
- Workspace re-render + RPC reload on save.
- 6–8 starter skills seeded.

### Phase 4 — Admin + safety
- `/pretentious/openclaw` super-admin page: agents table with `user`, `machine_state`, `last_active_at`, **`cogs_this_period_cents`** (sortable, red ≥ cap, amber ≥ 80%), per-row Stop / Destroy / Rebuild / Reset COGS (audited).
- Waitlist viewer (export CSV) so we can notify users when we flip `openclaw_enabled` on.
- Email notices at 80% / 100% / 150% of cap.
- Hard quotas: 3 agents per user, 25 skills per agent, 10 `generateSkillFromPrompt` calls/hour.

### Phase 5 — deferred
Pooled gateway tier, ClawHub publish, BYO-device installer.

## Explicitly not in v1 or v2

Slack, WhatsApp, Telegram, Signal, iMessage, Discord, Teams, macOS Voice Wake, Live Canvas, iOS/Android nodes, ClawHub publish, hand-editing `openclaw.json`.

## Open implementation questions

1. **Cap math anchor** — calendar month vs each user's Paddle billing period? Recommend: **billing-period anchored** for paying users, calendar month for comped users.
2. **Pay-as-you-go credits** — new SKU vs reuse existing Hypeforce credits with a published USD→credit rate? Recommend: **reuse existing credits** (already have `CreditsTopupDialog`).
3. **Past-due users** — allow OpenClaw access (Paddle dunning will resolve) or block? Recommend: **allow**, same posture as `has_active_subscription`.

Confirm 1–3 (or "your recommendations are fine") and I'll execute Phase 1 first — that ships the two flags, the sidebar entry, and the "coming soon" page with both flags OFF by default.
