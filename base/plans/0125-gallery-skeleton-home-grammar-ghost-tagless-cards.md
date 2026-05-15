# Plan 0125 — Gallery skeleton chrome + Home grammar-card ghost + tagless Home cards

> Three creator-reported polish items, all follow-ups to cycle 0124's skeleton work:
> 1. The Gallery loading skeleton is a bare grid of squares — missing the search input + favorite/sort buttons, so it doesn't read like the real Gallery screen.
> 2. The Home loading skeleton (0124) doesn't include a ghost for the Grammar summary card that the real Home renders below the grid.
> 3. On Home, the character cards show tag pills, adding vertical height; the creator wants Home's cards tagless so the whole Home screen fits on a Mac viewport without scrolling. `/characters` keeps tags.

## Seed sections satisfied

- `Seed/ux.md` §10 non-omission — loading states are a required state; making the Gallery + Home skeletons shape-faithful continues 0124's work.
- `Seed/ux.md` §screen inventory — Home is a compact preview/dashboard surface; trimming the per-card tags reinforces that (tags remain on `/characters`, the full library).
- DesignSystem precedence — all ghosts reuse `.sp-skeleton` + existing tokens; no new visual primitives.

PersonaLLM-Reference: `04-screens/CharacterScreen` shows the tile as image + name + meta; tags are a v0 addition, so hiding them on the Home preview is within the v0 surface (kept on the full Characters list).

## User stories / non-negotiables

No behavior change. Frontend chrome only. No SSE / agent-isolation / grammar-engine / lorebook / snapshot / prompt-assembly / schema / migration / dependency touched. (Grammar *module* untouched — this only adds a loading-ghost for Home's grammar summary card; the creator chose to leave the Grammar route's spinner as-is.)

## UX surfaces affected

- `routes/Gallery.tsx` — loading state only.
- `lib/SkeletonGrid.tsx` — new opt-in `withGrammarCard` ghost.
- `routes/Home.tsx` — pass `withGrammarCard` to the loading skeleton; pass `hideTags` to the loaded `CharacterGrid`.
- `features/characters/CharacterGrid.tsx` — `hideTags` passthrough prop.
- `features/characters/CharacterCard.tsx` — `hideTags` prop that skips the tag-pill block.

## Implementation order

1. **`Gallery.tsx` — skeleton chrome ghosts.** In the `!state` loading branch, above the square grid, add ghosts mirroring the real chrome: an h1-height bar (the "Gallery" header), a short centered count-line bar, and a filter row (flex-1 search-input ghost ~36px + two 38px circle ghosts for favorite/sort). Keep the existing 12-square grid. Use `.sp-skeleton` + existing tokens/dimensions (`searchInputStyle`/`iconChipStyle` shapes).
   - Verify (Playwright): `/gallery` loading (route-delayed) shows header + count + search-row ghosts above the square grid; loaded state unchanged.

2. **`SkeletonGrid.tsx` — `withGrammarCard` ghost.** Add a `withGrammarCard?: boolean` prop. When true, render a `SkeletonGrammarCard` after the grid: a `--sp-bg-2` bordered card (matching `grammarCardStyle` — marginTop 1.75rem, padding 1.25rem) with a header-line ghost + a row of 4 KPI-block ghosts (matching `kpiGridStyle`'s `repeat(auto-fit, minmax(120px,1fr))`).
   - Verify (Playwright): rendering `SkeletonGrid withGrammarCard` produces the card ghost; without the prop (Characters/Gallery) nothing changes.

3. **`CharacterCard.tsx` + `CharacterGrid.tsx` — `hideTags` prop.** `CharacterCard` gains `hideTags?: boolean`; when true the `tags.length > 0` block is skipped. `CharacterGrid` gains `hideTags?: boolean` and forwards it to each card.
   - Verify (Playwright): a grid rendered with `hideTags` shows no `char-tile-tags-*` elements; without it, tags still render.

4. **`Home.tsx` — wire both.** Loading `<SkeletonGrid>` gets `withGrammarCard`; loaded `<CharacterGrid>` gets `hideTags`. `/characters` untouched (keeps tags).
   - Verify (Playwright): Home loaded at L=1440 — no tag pills on the cards, cards visibly shorter; Home loading shows the grammar-card ghost below the grid; `/characters` still shows tags. `npx tsc --noEmit` 0 errors.

## Out of scope

- Grammar route loading state — creator chose to keep its `<Spinner>` (asked explicitly).
- Gallery does not use `SkeletonGrid` (its tiles are pure squares, no meta strip) — its skeleton stays inline; no refactor.
- The Home grammar-card ghost shows even when the user has Grammar master OFF (the skeleton can't know yet). It sits *below* the grid so it never shifts the grid; a harmless over-render for grammar-off users — accepted.

## Riesgos

- `hideTags` removing the tag block changes card height — the `.sp-character-grid` rows will be shorter on Home; this is the desired effect. No layout-shift concern vs the skeleton (skeleton card already has no tag ghost).
- Gallery skeleton chrome dimensions are approximate; minor transient shimmer-vs-real offset acceptable (same tolerance as 0124).

## Verification

**Files touched:** `routes/Gallery.tsx`, `lib/SkeletonGrid.tsx`, `features/characters/CharacterCard.tsx`, `features/characters/CharacterGrid.tsx`, `routes/Home.tsx`.

**Playwright gates (L=1440×900, dev server, real xvm data, `/rest/v1/**` route-delayed for skeletons):**
- Gallery loading skeleton: 17 `.sp-skeleton` nodes = header bar + count bar + search ghost + 2 circle ghosts + 12 square tiles. Screenshot `.playwright-mcp/0125-gallery-skeleton-L.png` — reads like the real Gallery chrome. ✓
- Home loading skeleton: grammar-card ghost present (`hasGrammarCardGhost: true`) below the grid, plus 0124's add-card + section-header ghosts. Screenshot `.playwright-mcp/0125-home-skeleton-L.png`. ✓
- Home loaded: `home-recent-grid` has **0** `char-tile-tags-*` blocks; card height **319px** (vs 370px on `/characters`) — ~51px shorter, whole Home fits the viewport without scroll. Screenshot `.playwright-mcp/0125-home-loaded-L.png`. ✓
- `/characters` loaded: still **6** `char-tile-tags-*` blocks — tags kept on the full library. ✓
- `npx tsc --noEmit` → 0 errors (after impl + after the F-A fix).
- Console: 0 errors across all navigations.

**code-review (feature-dev:code-reviewer):** 2 findings.
- **Issue A (Important, conf 85) — APPLIED.** Gallery skeleton grid used `gap: 0.75rem` while the loaded grid uses `gap: 0.5rem` → 4px shift on load (pre-existing in the old inline skeleton; fixed now that the code was being touched). Changed skeleton grid `gap` to `0.5rem` to match.
- **Issue B (Important, conf 85) — NOT APPLIED, by design.** Reviewer flagged that `withGrammarCard` shows the grammar-card ghost even for users with Grammar master OFF (the skeleton can't know the pref yet), and claimed this causes "a downward layout jump in the grid". That premise is incorrect: `SkeletonGrammarCard` renders *after* `.sp-character-grid` in DOM order, with nothing below it — so when it vanishes nothing visible above it moves; the page is merely ~170px shorter after load for Grammar-off users (no content jump). The creator explicitly requested the grammar-card ghost in the Home skeleton ("en home no sale el scheleton del resumen de grammar"). Kept as requested; the position (below the grid) makes it shift-safe.

**code-simplifier:** diff is 5 small files — 3 new presentational ghosts following the exact pattern the reviewer approved in 0124, plus a passthrough boolean prop (`hideTags`) and one prop wire-up. No speculative abstraction; nothing to prune.

**Non-negotiables:** untouched — frontend chrome only, no SSE / agent-isolation / grammar-engine / lorebook / snapshot / prompt-assembly / schema / migration / dependency. Grammar *route* untouched (creator chose to keep its `<Spinner>`).

**Residual notes:**
- Home grammar-card ghost shows for Grammar-off users too (see Issue B) — accepted, shift-safe by position, creator-requested.
- Gallery skeleton chrome dimensions are approximate (transient shimmer); the one measurable mismatch (grid gap) was fixed.
