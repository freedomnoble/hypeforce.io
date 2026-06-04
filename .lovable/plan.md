## Add Use Cases Section to Landing Page

Insert a new section on the landing page between "Plays well with" (logo strip) and "The platform" (features grid) showcasing four concrete use cases.

### Placement
File: `src/components/hypeforce/landing-page.tsx`
Position: After the `PLAYS WELL WITH` `<section>` and before the `#features` `<section>`.

### Section Content

**Eyebrow:** "Use cases"
**Headline (h2):** "25X yourself or your team"
**Subtext:** "Hype up your work with 5 agents that work together. That's 5x5 the productivity and work shipped."

**Four use case cards** in a responsive grid (1 col mobile, 2 cols tablet+):

1. **Solo Founder Launchpad** — "Launch campaigns and ship features together. One agent researches market demand, another scopes the build, another writes the marketing copy, another runs the repo tests — all in parallel, all aligned to your brand, vision and voice."

2. **Data, SOPs & Marketing in One Room** — "Cast each agent in a role and brief the outcome. They model the data, write SOPs from the findings, and turn the results into marketing copy your team and agents can run with — together, in one channel."

3. **Trend-to-Brand Marketing Engine** — "A research agent scans trending content on your target channels. A strategy agent maps trends to your brand (or proposes a new course). Copy and image/video agents ship on-brand assets using your colors, logos and voice."

4. **Brand Voice Command Center** (derived from features: shared context, pinned briefs, channel memory) — "Pin the brief once. Every agent — ChatGPT, Claude, Gemini, Manus — reads the room before replying, so your tone, positioning and product facts stay consistent across every message, doc and campaign."

### Visual Treatment
- Match existing section rhythm: `relative z-10 mx-auto max-w-7xl px-5 lg:px-8 py-20`
- Reuse existing classes: `hf-eyebrow`, `hf-h2`, `glass rounded-2xl p-6`
- Each card: small icon tile (`liquid-glass rounded-xl w-11 h-11`, `text-electric`) using lucide icons already imported where possible (e.g. `Rocket`, `Database`, `TrendingUp`, `Megaphone` — add new icon imports from `lucide-react`), title in `font-display text-lg`, body in `text-sm text-muted-foreground leading-relaxed`.
- Add a small numbered tag (01–04) in `text-electric/70 font-display` above each title, mirroring the `StepCard` aesthetic for visual rhyme with "How it works".
- No new design tokens, no style.css changes.

### Scope Guardrails
- Frontend-only edit to one file.
- No routing, auth, or backend changes.
- Do not touch theme provider, hero, nav, pricing, FAQ, or footer.
