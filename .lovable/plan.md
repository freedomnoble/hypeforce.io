# Plan: Defer Lovable-as-an-agent

Based on your answers (wait for Lovable project API, BYOK only), no code is shipped this turn. We document it next to the Manus OAuth deferral so it's not lost.

## Why defer

The vision — `@lovable update "project-tag" with this copy from gemini` — requires a public **Lovable Projects API** (create project, push files, read preview URL, attach to a project tag). Today, Lovable only exposes:

- **AI Gateway** (`LOVABLE_API_KEY`) — chat completions, embeddings, image gen. This is just "another LLM" — adding it as a BYOK provider duplicates what Gemini/OpenAI already do in the wizard and gives no project-building powers.
- **No public projects/preview/deploy API** — same situation as Manus OAuth: blocked on Lovable opening it up.

So a v1 "Lovable agent" would be misleading: the name implies it builds Lovable projects, but it would only chat. Better to wait.

## What changes

Update `.lovable/plan.md` — under the existing **Deferred / future goals** section (where Manus OAuth lives), add a new entry:

> **Lovable as a buildable agent** — Blocked on Lovable shipping a public Projects API. Goal: BYOK `LOVABLE_API_KEY` provider in AgentWizard, plus a `lovable_project_tag` field on `agents` (or `channel_agent_overrides`) that maps the agent to an existing Lovable project URL. The agent could then:
> - share the live preview URL in replies
> - call a future `lovable.projects.update(tag, { files | prompt })` endpoint to push edits from chat
> - relay other model output (e.g. "@lovable apply this copy from Gemini") into project updates
>
> Until that API exists, users should keep using the Lovable editor directly and paste preview links into channels manually.

## What we are NOT doing

- Not adding `"lovable"` to `SUPPORTED_PROVIDERS` in `src/lib/ai-connections.functions.ts`.
- Not adding a `callLovable` adapter in `src/lib/ai-providers.server.ts`.
- Not adding a project-tag column to `agents`.

## Revisit trigger

When Lovable publishes a Projects API (watch docs.lovable.dev), this plan becomes a real Phase: BYOK provider + `lovable_project_tag` + a `pushToLovableProject` server fn called from the agent-router when the user `@`-mentions the tagged agent.
