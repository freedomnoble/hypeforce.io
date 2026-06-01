
# Hybrid AI Routing: Lovable Gateway + Bring-Your-Own-Keys (BYOK)

Keep the current Lovable AI Gateway as the zero-config default, and add a Plaid-style "Connect AI Provider" flow so users can attach their own OpenAI / Anthropic / Google / Manus keys to their account. At message time, the router picks per-user keys when available and falls back to the gateway otherwise.

## User experience

1. New users work immediately — every agent runs on Lovable AI Gateway, no setup.
2. In **Profile → Connections** (new section), the user sees a Plaid-like list of providers (OpenAI, Anthropic, Google, Manus) each with a **Connect** button.
3. Clicking Connect opens a modal: paste API key → we validate it with a tiny test call → on success, store it encrypted and mark the provider as "Connected" with a green dot + masked key (`sk-...AB12`) + connected timestamp.
4. User can **Disconnect** (deletes the key) or **Reconnect** (replace) any time.
5. Per-agent (in Admin → Agents) a tiny dropdown: **Route via: Lovable Gateway (default) · My OpenAI key · My Anthropic key …** — only providers the user has connected appear.
6. On send, if the chosen route is BYOK and the key exists for that user, the agent uses it. Otherwise silent fallback to Lovable Gateway. A tiny badge under the agent reply shows which route was used (`via your OpenAI` / `via Lovable AI`).

## Backend changes

### New table `user_ai_connections`
- `user_id` (uuid, FK auth.users)
- `provider` (enum: openai | anthropic | google | manus)
- `encrypted_key` (text — encrypted at rest, see below)
- `key_last4` (text — for display)
- `status` (enum: active | invalid | revoked)
- `connected_at`, `last_validated_at`
- Unique on (user_id, provider)
- RLS: user can only read/write their own rows; service role full access.

### Encryption
Keys are encrypted with `pgsodium` (Supabase Vault) or a server-side AES-GCM using a `AI_KEYS_ENCRYPTION_SECRET` we add via add_secret. Decryption only happens inside the server function that calls the provider. Decrypted keys are **never** returned to the client — only `key_last4` and `status`.

### `agents` table — add column
- `preferred_route` (text, nullable) — values like `lovable`, `byok:openai`, `byok:anthropic`. Null = lovable default.

### Server functions (TanStack, no Edge Functions)
- `connectProvider({ provider, api_key })` — validates the key with a 1-token test request to that provider, encrypts, upserts row.
- `disconnectProvider({ provider })` — deletes row.
- `listMyConnections()` — returns providers with status + last4 (no key material).
- `setAgentRoute({ agent_id, route })` — updates `agents.preferred_route`.

### Router update (`src/lib/agent-router.functions.ts`)
For each agent reply:
1. Resolve route: agent's `preferred_route` → if `byok:<provider>` and user has an active connection, use that provider's direct API; else use Lovable Gateway.
2. Adapter layer: a tiny `callProvider(provider, key, model, system, history)` with one branch per provider (OpenAI Chat Completions, Anthropic Messages, Gemini generateContent, Manus stub). All four already speak similar JSON.
3. Insert reply with a `route_used` field on the message (new optional column, or stash in `attachments` jsonb to avoid migration churn — leaning toward a new `route_used text` column for clarity).
4. On BYOK failure (401/429/etc.), mark connection `invalid`, fall back to Lovable Gateway, and surface a toast to the user next time they open the app.

## Frontend

- New `src/routes/_auth.profile.connections.tsx` — provider cards with Connect/Disconnect, masked keys, status dots.
- Connect modal: provider-specific copy ("Get your key at platform.openai.com/api-keys"), paste field, validate button, success/fail state.
- Admin agents view: route dropdown per agent.
- Chat: small muted `via {route}` line under agent replies.

## Security

- Keys never leave the server after the initial paste.
- Validate format client-side (e.g. `sk-...`) but always re-validate server-side.
- Rate-limit connect attempts per user.
- Audit log table optional (skip for v1).
- RLS strict: only owner reads their connection row, and even then `encrypted_key` is excluded from any select used by the client (use a view or explicit column lists).

## Out of scope for this build

- OAuth flows for providers that support it (OpenAI doesn't, Anthropic doesn't, Google does but requires GCP project setup — punt).
- Usage metering / per-user billing dashboards.
- Org-level shared keys (only personal for now).

## Open question

Manus has no public chat-completions API in the same shape as the others — for v1 the Manus BYOK option will be present in the UI but the actual call will remain a stub/placeholder until you confirm the Manus endpoint contract. OK to ship that way?
