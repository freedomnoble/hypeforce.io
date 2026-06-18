# Phase 3 — Medium-term UX wins

Skip the further router split (not worth the complexity). Move on to the user-facing items from the audit.

## 1. Dynamic models in AgentWizard

Today `AgentWizard` step 2 uses a hardcoded `AVAILABLE_MODELS` list. Replace with a live list:

- New server fn `listAvailableModels` in `src/lib/ai-connections.functions.ts`:
  - Returns gateway models (the current hardcoded set, but owned server-side so we update it in one place).
  - Plus the caller's connected BYOK providers (read from `user_ai_connections`, **provider + status only — never `encrypted_key`**).
- `AgentWizard` uses `useSuspenseQuery` on this fn. Manus appears as a selectable model only when the user has an active Manus connection.
- Model dropdown groups: "Lovable Gateway" / "Your connected providers".

## 2. Manus OAuth connector

Currently Manus is BYOK-only (paste an API key). Add OAuth as a second connection path:

- New column `connection_type text not null default 'byok'` on `user_ai_connections` (values: `byok`, `oauth`). Migration with grants unchanged.
- New server fn `startManusOAuth` returning the authorize URL with a signed state cookie.
- New public route `src/routes/api/public/oauth/manus/callback.ts`:
  - Validates state, exchanges code → tokens, encrypts refresh token via existing `ai-crypto.server`, upserts `user_ai_connections` with `connection_type='oauth'`.
- `callManus` in `ai-providers.server.ts` learns to refresh the access token when `connection_type='oauth'`.
- Profile → AI Connections UI gets a "Connect with Manus" button next to the existing paste-key flow.

Requires: `MANUS_OAUTH_CLIENT_ID` + `MANUS_OAUTH_CLIENT_SECRET` (will request via add_secret when implementing).

## 3. Email-inbound fallback (design only)

The audit flagged email-inbound as a reach goal. I'll write a short design note under `docs/` covering:
- Reuses existing `src/routes/lovable/email/queue/process.ts` infra.
- Inbound address → channel mapping table.
- No code yet — just the doc so we can scope it later.

## Out of scope

- No further `agent-router` file splitting.
- No auth / billing / Paddle changes.
- No UI redesign of AgentWizard beyond the model dropdown.
- `xlsx` swap deferred.

## Suggested order

1. Dynamic models (small, no secrets needed) — ~30 min.
2. Email-inbound design doc — ~10 min.
3. Manus OAuth (needs your client id/secret from Manus dashboard) — ~45 min.

Approve and I'll start with step 1.
