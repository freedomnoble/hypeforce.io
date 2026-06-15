## Newsprint theme tweaks

Update only the Newsprint theme block in `src/styles.css` (lines ~806–942). No other files change.

### Light mode
- Keep paper texture on the body background (already there).
- `.glass` / `.glass-strong` panels become true frosted glassmorphism:
  - `background-color` reduced to **60% opacity** white-paper (`oklch(0.99 0.006 85 / 0.60)`); `.glass-strong` slightly higher (~0.70) for hierarchy.
  - Add `backdrop-filter: blur(20px) saturate(140%)` so the paper texture shows through.
  - Remove the opaque paper-texture fill on the panels (texture lives on the body, not the panel) so the frost reads.
  - Keep the layered drop shadows for premium depth.
- Force panel text + foreground tokens to **charcoal** (`oklch(0.18 0.005 60)`) so copy on glass stays legible.

### Dark mode
- Background stays charcoal (already there); drop the paper texture on `body` (no change needed — it's already charcoal-only).
- `.glass` / `.glass-strong` panels become frosted glass over charcoal:
  - `background-color` set to **50% opacity** light paper (`oklch(0.94 0.012 85 / 0.50)`) — keeps the "paper on charcoal" feel but translucent.
  - Add `backdrop-filter: blur(20px) saturate(130%)`.
  - Remove the opaque paper-texture fill on the panel so the blur reads as glass; keep texture only on buttons/accents via the existing `.btn-paper` rule.
  - Keep charcoal shadows.
- Card/popover tokens unchanged; only the `.glass*` surfaces get the new translucency.

### Notes
- Use standard `backdrop-filter` only — Lightning CSS adds the `-webkit-` prefix at build (per project rule).
- No component or token-name changes; existing surfaces using `.glass` / `.glass-strong` pick up the new look automatically.
- No changes to buttons, accents, or the paper-texture URIs themselves.
