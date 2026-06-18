# Plan: Revert footer wordmark to small inline lockup

Restore the pre-change footer in `src/components/hypeforce/landing-page.tsx` while keeping every other edit from the last turn (gold Hail Mary note, Meet Your Team section, section reorder).

## Change

Replace the full-width glassmorphism wordmark block with the original compact footer row:

- Small wordmark image (`h-5 w-auto`) inline with `· © {year}` on the left.
- Footer links on the right.
- No glass panel, no 75% opacity wrapper.

## Files

- `src/components/hypeforce/landing-page.tsx` — footer JSX only (~lines 599–620).

Nothing else changes.
