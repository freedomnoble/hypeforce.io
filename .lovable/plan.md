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

### Other deferred items

- Further `agent-router.functions.ts` splitting — not worth the complexity.
- `xlsx` → `exceljs` swap in `file-extraction.server.ts`.
