# Phase 3 — Status

## Done

- **Dynamic models in AgentWizard** — `listAvailableModels` server fn returns gateway models + the caller's active BYOK providers. Wizard step 2 groups them as "Lovable Gateway" / "Your connected providers". Manus appears only when the user has an active Manus key.
- **Email-inbound fallback (design only)** — see `docs/email-inbound-design.md`.

## Deferred / future goals

### Manus OAuth ("Plaid-like" connect button)

Not possible today. Manus's OAuth ("Open App") flow is currently restricted to
internal Manus team use — third-party public authorization is not yet
available. Manus remains BYOK-only (users paste an API key, same as OpenAI /
Anthropic / Google).

Revisit when Manus opens OAuth to external developers. Sketch for that day:

- Add `connection_type` (`byok` | `oauth`) on `user_ai_connections`.
- `startManusOAuth` server fn → authorize URL + signed state cookie.
- Public callback at `src/routes/api/public/oauth/manus/callback.ts` — exchange code, encrypt refresh token via `ai-crypto.server`, upsert connection.
- Teach `callManus` to refresh access tokens when `connection_type='oauth'`.
- Secrets needed at that point: `MANUS_OAUTH_CLIENT_ID`, `MANUS_OAUTH_CLIENT_SECRET`.

### Lovable as a buildable agent

Blocked on Lovable shipping a public Projects API. The AI Gateway
(`LOVABLE_API_KEY`) is public today, but it only does chat / embeddings /
image gen — same shape as the OpenAI/Gemini BYOK providers already in the
wizard. Adding it as just another LLM would be misleading; the value is in
having `@lovable` actually build and update Lovable projects from chat.

Revisit when Lovable publishes a Projects API (create project, push files /
prompts, read preview URL). Sketch for that day:

- Add `"lovable"` to `SUPPORTED_PROVIDERS` in `src/lib/ai-connections.functions.ts` (BYOK `LOVABLE_API_KEY`).
- Add a `callLovable` adapter in `src/lib/ai-providers.server.ts` (chat for replies, projects API for builds).
- Add `lovable_project_tag` on `agents` (or `channel_agent_overrides`) mapping an agent to a Lovable project URL.
- `pushToLovableProject` server fn called from the agent-router when the user `@`-mentions the tagged agent, e.g. `@lovable update "landing-v2" with this copy from gemini`.
- Agent replies post the live preview URL back into the channel.

Until that API exists, users keep using the Lovable editor directly and paste
preview links into channels manually.

### Other deferred items

- Further `agent-router.functions.ts` splitting — not worth the complexity.
- `xlsx` → `exceljs` swap in `file-extraction.server.ts`.
