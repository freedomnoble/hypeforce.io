# CPTO Report — Response Plan

I read the audit and cross-checked the repo. The findings are accurate:

- `user_ai_connections` RLS lets `authenticated` SELECT `encrypted_key` (migration `20260601210545`, line 24). The client only ever needs `provider, key_last4, status` (confirmed in `listMyConnections`, `ai-connections.functions.ts:47`). The router reads `encrypted_key` via the user-scoped client (`agent-router.functions.ts:447`) — that read should move to service role.
- `ai-providers.server.ts:71` still throws `"Manus direct API not yet implemented"`.
- `agent-router.functions.ts` is 686 lines with sequential lookups per message.
- `AgentWizard` uses a hardcoded `AVAILABLE_MODELS` list.
- `bun audit` deps as described.

The plan below is phased by risk. We ship Phase 1 immediately, then Phase 2/3 once you approve.

---

## Phase 1 — Immediate (security + Manus unblock)

**1. Lock down `encrypted_key` (new migration)**
- Revoke column-level SELECT on `encrypted_key` from `authenticated`:
  - `REVOKE SELECT ON public.user_ai_connections FROM authenticated;`
  - `GRANT SELECT (user_id, provider, key_last4, status, connected_at, last_validated_at) ON public.user_ai_connections TO authenticated;`
- Keep INSERT/UPDATE/DELETE grants and existing RLS policies.
- `service_role` keeps `GRANT ALL`.
- Switch the router's BYOK fetch (`agent-router.functions.ts:447` and `:626`) to a small `.server.ts` helper that uses `supabaseAdmin`, scoped by the already-authenticated `userId`. No other client read of `encrypted_key` exists.
- Verify: `listMyConnections` continues to work (it doesn't request `encrypted_key`); agent send path still resolves BYOK keys.

**2. Implement Manus provider in `ai-providers.server.ts`**
- Replace the throw at `:71` with a real `task.create` / `task.sendMessage` call against the Manus v2 API using the decrypted BYOK key.
- Map response to the existing provider return shape (content + usage). Keep OAuth token support as a TODO hook (Phase 3).
- Add minimal Zod validation for the response and friendly error mapping.

**3. Safe dep bumps**
- `bun update brace-expansion js-yaml ws` and re-run `bun audit`. No app code touched.
- Defer `vite`, `@tanstack/start-server-core`, and `xlsx` to Phase 2 with explicit regression testing.

---

## Phase 2 — Short-term (router refactor + risky deps)

**4. Decouple `invokeAgentRouter`** into a thin orchestrator plus three modules under `src/lib/agent-router/`:
- `context.server.ts` — history, pinned files, memos, identity overrides, reply counters in **one** batched call (single Supabase RPC or `Promise.all` of typed queries returning a single `RouterContext`).
- `prompt.server.ts` — system prompt assembly from persona + context.
- `execution.server.ts` — provider invocation + credit charging + persistence.
- `invokeAgentRouter` becomes ~80 lines wiring these together. Public signature unchanged so callers don't break.

**5. Kill N+1**
- Replace per-message sequential lookups with a single `get_agent_router_context(agent_id, channel_id, user_id)` Postgres function (SECURITY DEFINER, returns JSON). Falls back to the new `context.server.ts` if RPC missing.

**6. Risky dep updates**
- Bump `vite` and `@tanstack/start-server-core`; smoke test SSR, server functions, and the auth gate.
- Decide on `xlsx`: either pin + document the risk (no current import/export feature uses untrusted Excel input) or swap to `exceljs`. I'll recommend after I grep usages.

---

## Phase 3 — Medium-term (UX wins)

**7. Dynamic models in `AgentWizard`**
- Replace `AVAILABLE_MODELS` with a `useSuspenseQuery` that combines gateway models + the user's active `user_ai_connections` (provider list only, no keys). Manus shows up automatically when connected.

**8. Manus OAuth ("Plaid-like" connector)**
- New route `src/routes/api/public/oauth/manus/callback.ts` (signature-verified).
- New server fn `startManusOAuth` returning the authorize URL.
- Store the returned token in `user_ai_connections` using the same encryption path as BYOK; add a `connection_type: 'oauth' | 'byok'` column via migration.

**9. Email-inbound fallback** — design only this phase; defer build until OAuth lands. Reuses `src/routes/lovable/email/queue/process.ts` infra.

---

## Out of scope / explicit non-goals

- No changes to auth provider config, billing, or Paddle.
- No UI redesign of the wizard — only the model list source.
- No edge functions added; everything stays in TanStack server functions per project conventions.

---

## Suggested execution order

Ship **Phase 1** as one PR (migration + router BYOK read swap + Manus provider + safe deps). That closes the security finding and unblocks Manus the same day. Phase 2 and 3 follow as separate PRs.

Want me to proceed with Phase 1 only, or Phase 1+2 in sequence?