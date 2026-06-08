# Custom teammates with role + model + route

Replace the 3-prompt() "New agent" flow with a proper dialog so users can stand up multiple custom teammates — each with its own name, handle, role/system prompt, model, and route (Lovable gateway or a connected BYOK key). Any agent whose model is an image model becomes image-only automatically.

## 1. New "Create teammate" dialog (`src/components/hypeforce/workspace-settings-sheet.tsx`)

Replace `addAgent`'s `prompt()` chain with a real dialog (`Dialog` + `Form`) containing:

- **Name** — display name.
- **Handle** — auto-derived from name (slugified, lowercased), editable. Validated `^[a-z0-9_-]+$`, unique per workspace (uniqueness already enforced client-side via `select` check + DB-side already throws on conflict).
- **Role** — short text (≤120 chars) → stored as `description`.
- **System prompt** — multiline textarea (placeholder: "You are X, a Y who focuses on…").
- **Route** — radio:
  - "Lovable AI Gateway (recommended)"
  - One entry per connected BYOK provider (`My openai key`, `My google key`, etc.), pulled from `listMyConnections`. Disabled rows for providers they haven't connected, with a "Connect in Profile → AI Connections" hint.
- **Model** — curated dropdown, filtered by the chosen route:
  - **Lovable gateway models** (chat): `openai/gpt-5-mini`, `openai/gpt-5`, `openai/gpt-5-nano`, `google/gemini-3-flash-preview`, `google/gemini-2.5-flash`, `google/gemini-2.5-pro`. **Image:** `google/gemini-2.5-flash-image` (Nano Banana).
  - **BYOK openai:** `gpt-5-mini`, `gpt-5`, `gpt-4o-mini`.
  - **BYOK anthropic:** `claude-3-5-sonnet-latest`, `claude-3-5-haiku-latest`.
  - **BYOK google:** `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash-image`.
  - **BYOK manus:** disabled with note "Direct API not wired up yet — use Lovable gateway."
  - Each option carries a one-line capability hint (e.g. "Fast & cheap", "Best reasoning", "Image generator — replies with pictures").
- Helper hint above the model picker: "Pick the same model twice with different prompts to spin up two specialists (e.g. a Strategist and a Copywriter both on GPT-5-mini)."

On submit:
- If route is BYOK and that provider isn't connected → toast error + link.
- Insert into `agents` with `{ workspace_id, name, handle, provider, model, description, system_prompt, preferred_route }` where `provider` is derived from the model namespace (`openai/…` → `openai`, `google/…` → `google`, or the BYOK provider).
- Call `setAgentRoute` after insert to persist route (uses the existing admin-gated server fn).
- Reload list.

## 2. Edit teammate (same dialog, prefilled)

Add an Edit button next to Delete on each agent row. Opens the same dialog prefilled. Save uses `supabase.from("agents").update(...)` for name/description/system_prompt/model and `setAgentRoute` for the route. Handle is read-only on edit (existing channel memberships and mentions key off it).

## 3. Router uses the agent's chosen model (`src/lib/agent-router.functions.ts`)

Currently the router hardcodes `google/gemini-2.5-flash` or `openai/gpt-5-mini` per provider, ignoring `agent.model`. Change the Lovable-gateway path to:

```
const model = isImageAgent
  ? "google/gemini-2.5-flash-image"
  : (agent.model && agent.model.includes("/") ? agent.model : providerDefault);
```

`isImageAgent` already triggers on `agent.model === "google/gemini-2.5-flash-image"`; broaden to "any model whose ID ends in `-image` or contains `image-preview`" so future image models (Nano Banana 2, gpt-image-2) automatically image-mode. BYOK path already uses `agent.model`, no change there.

## 4. Defensive cleanup

- Remove the inline `prompt()`/provider-string flow from `workspace-settings-sheet.tsx` once replaced.
- Keep `SUPPORTED_PROVIDERS` and BYOK list as-is (anthropic + manus still selectable as BYOK).
- No DB schema change — `agents` already has `name, handle, provider, model, description, system_prompt, preferred_route, avatar_url`.

## Files
- Edit: `src/components/hypeforce/workspace-settings-sheet.tsx` — new Dialog component for create/edit; gate model list by route.
- Edit: `src/lib/agent-router.functions.ts` — honor `agent.model`; broaden image detection.

## Out of scope
- Avatar upload / AI-generated avatars (per your call).
- Per-agent temperature / tool toggles.
- Manus direct adapter (still gateway-aliased).
- Migrating existing rows; they keep current model/provider.
