## Mobile pricing redesign

Goal: on small screens, collapse the two pricing cards into one Founder card so the price, benefits, and CTA all fit on screen without the button overlapping the next section. Keep the existing two-card layout untouched on `md+`.

### Changes — `src/components/hypeforce/landing-page.tsx`, pricing section only

1. **Hide the "Standard seat" anchor card on mobile.**
   Add `hidden md:block` to the Standard card wrapper (line 427). The grid stays `grid-cols-1 md:grid-cols-2`, so on mobile only the Founder card renders and centers naturally.

2. **Show $9 with $19 crossed out on the Founder card.**
   In the price block (lines 454–466), when `billing === "monthly"` prepend a strikethrough `$${standardMonthly}` before the `$${monthly}` price (e.g. `$19` muted + line-through, then `$9` large). For `annual`, prepend the strikethrough `$${standardMonthly}` the same way before `$${annualPerMonth}`. Layout: keep the existing `flex items-baseline gap-1.5`, with the strikethrough sized smaller (e.g. `text-3xl`) and `text-muted-foreground line-through` so the $9 stays the visual anchor.

3. **Highlight founder-exclusive bullets.**
   In the Founder card bullets (lines 472–478), wrap the founder-only items in an accent style so it's obvious what the first 1,000 get vs. the standard plan:
   - "Founding Member badge on your profile" — already uses `text-electric font-semibold` on the badge label; extend to the full line.
   - "$9/mo price locked for life"
   - "Early access to new agents and features"
   - "Direct line to the team in #founders"

   "Everything in Standard" stays muted/regular so it reads as the baseline.

   Implementation: pass an optional `highlight` prop to the existing `Bullet` component (or inline a `className` wrapper) that switches the text + check icon color to `text-electric` and weight to `font-medium`. I'll check `Bullet`'s signature first; if it doesn't accept a prop, I'll wrap the children with a `<span className="text-electric font-medium">…</span>` to avoid touching the shared component.

4. **No behavior or copy changes** beyond the strikethrough price addition. CTA, billing toggle, headline, subhead, and FAQ all stay as-is. Desktop renders identically to today.

### Out of scope
- No changes to `pricing_config` values (already $9 founder / $19 standard per the last migration).
- No changes to the Standard card on desktop.
- No changes to FAQ, hero, or footer CTA.