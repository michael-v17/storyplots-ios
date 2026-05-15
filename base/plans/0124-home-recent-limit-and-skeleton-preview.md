# Plan 0124 — Home recent-character limit + preview-shaped skeletons

> Polish cycle from creator feedback on the Home screen: "Recent Characters" renders 6 cards, the 6th wraps alone onto a second row and looks broken. Creator wants Home capped at **top 5 on desktop / top 4 on mobile** as a preview, with `/characters` staying the full unbounded list. Plus: the loading skeletons for Home and Characters should include ghost placeholders for the chrome above the grid (the "Add Character" card on both; the search/filter bar on Characters) so the loading state mirrors the real screen instead of just showing bare tiles.

## Seed sections satisfied

- `Seed/ux.md` §screen inventory — Home is a dashboard/preview surface; Characters is the full library. Capping Home reinforces that split.
- `Seed/ux.md` §10 non-omission — loading states are a required state; making them shape-faithful is a quality improvement, not a new surface.
- DesignSystem precedence: skeleton ghosts reuse `.sp-skeleton` shimmer + existing tokens (`--sp-bg-2`, `--sp-border-strong` dashed, `--sp-radius`). No new visual primitives.

PersonaLLM-Reference: `04-screens/CharacterScreen` documents image-tile + meta-below; nothing here changes the card shape — only how many render and what the loading placeholder shows.

## User stories / non-negotiables

No behavior change. Frontend chrome only. No SSE / agent-isolation / grammar / lorebook / snapshot / prompt-assembly path touched. No schema, no migration, no new dependency.

## UX surfaces affected

- `routes/Home.tsx` — Recent Characters count + loading skeleton.
- `routes/Characters.tsx` — loading skeleton only (list itself unchanged, already unbounded).
- `lib/SkeletonGrid.tsx` — new opt-in ghost blocks.

## Implementation order

1. **`SkeletonGrid` — opt-in chrome ghosts.** Add two boolean props: `withAddCard` (ghost of the dashed "Add Character" card — dashed-border box + `.sp-skeleton` circle + 2 `.sp-skeleton` lines, dimensions matching the real card) and `withFilterBar` (ghost row: one wide `.sp-skeleton` block ≈ search input height + 3 small `.sp-skeleton` squares ≈ layout buttons). Both render above the existing `.sp-character-grid`. Wrap the whole thing so the `role="status"` container still covers everything.
   - Verify (Playwright): on `/` during load, `data-testid="loading"` contains the add-card ghost; on `/characters` during load it contains add-card ghost + filter-bar ghost. No console errors.

2. **`Home.tsx` — top 5 / top 4 by breakpoint.** Import `useBreakpoint`. Change `RECENT_LIMIT` 6 → 5 (load buffer). Slice at render: `const limit = bp === "S" ? 4 : 5; characters.slice(0, limit)`. Pass `withAddCard` to the loading `<SkeletonGrid>` and drop `count` to 5.
   - Verify (Playwright): L=1440 shows exactly 5 recent cards; S=375 shows exactly 4; resize across the breakpoint re-slices.

3. **`Characters.tsx` — preview-shaped skeleton.** Pass `withAddCard` + `withFilterBar` to the loading `<SkeletonGrid>`. List rendering unchanged (stays unbounded — confirmed already no cap).
   - Verify (Playwright): `/characters` loading state shows add-card ghost + filter-bar ghost above the tile grid; loaded state still lists every character.

4. **Typecheck + cross-breakpoint gate.** `npx tsc --noEmit` → 0 errors. Playwright sweep `/` and `/characters` at L=1440 and S=375, loading + loaded states.

## Out of scope

- `/characters` card density / sizing — creator confirmed "ya muestra todos, está bien", no grid change.
- Gallery skeleton — also consumes `SkeletonGrid` but creator didn't ask; `withAddCard`/`withFilterBar` default false so Gallery is untouched.
- The `storyplots-design` skill is unavailable this session (same as cycle 0075) — manual fallback: ghosts reuse existing component patterns + tokens only, no new visual decisions.

## Riesgos

- `useBreakpoint` "S" is ≤640px; the app's mobile single-column starts there. 4 cards on the 2-col mobile grid = 2 clean rows. 5 on desktop auto-fill wraps at narrow M widths — accepted, creator asked for a count not a single row.
- Skeleton ghost dimensions are approximate; minor shimmer-vs-real shift is acceptable (skeletons are transient). Keep add-card ghost height close to the real ~72px card to minimise it.

## Verification

**Files touched:** `lib/SkeletonGrid.tsx`, `routes/Home.tsx`, `routes/Characters.tsx`.

**Discovered-necessary subtask (added during impl):** `Characters.tsx` had a pre-existing quirk — `userId` is null both while the session restores *and* when genuinely logged out, so the data-load effect's `if (!userId)` branch flashed `characters-empty` over the loading skeleton on every reload. Added `if (sess.status !== "ready") return;` guard + `sess.status` to the dep array so the skeleton stays up until the session resolves. Without this the Characters skeleton (the whole point of subtask 3) was never actually visible.

**Playwright gates (L=1440×900, S=375×812, dev server, real xvm data):**
- Home L: `home-recent-grid` renders exactly **5** cards, one clean row, no orphan 6th. ✓
- Home S=375: renders exactly **4** cards (2-col grid → 2 rows). ✓
- Home loading skeleton (`/rest/v1/**` delayed via route interception): `withAddCard` + `withSectionHeader` ghosts present, 5 skeleton cards. ✓
- Characters loading skeleton: `withAddCard` + `withFilterBar` ghosts present (`hasAddCardGhost: true`, `hasFilterBarGhost: true`), 10 skeleton cards. ✓ Screenshot `.playwright-mcp/0124-characters-skeleton-L.png`.
- Characters loaded: still lists **all 6** characters (unbounded, unchanged). ✓
- `npx tsc --noEmit` → 0 errors (run after each subtask + after the F1 fix).
- Console: 0 errors across all navigations.

**code-review (feature-dev:code-reviewer):** 1 material finding.
- **F1 (Important, conf 85) — APPLIED.** Home skeleton was missing the "Recent Characters" header row between the add-card and the grid → ~24–37px downward layout shift when data resolved (contrary to the zero-shift goal). Fix: added `withSectionHeader` prop + `SkeletonSectionHeader` ghost; tuned `SkeletonAddCard` (marginBottom 1.25→1.75rem, inner text column `minHeight: 49`) and the header ghost (`height: 34`, bar `height: 26`) against measured real dimensions (add-card 81px/mb 28px, header 34px/mb 20px). Re-measured shift: **−7px** (skeleton grid 7px below real — negligible, transient). Screenshot `.playwright-mcp/0124-home-skeleton-L-final.png`.
- F2 (effect dep correctness) and F3 (`minWidth: 200` filter ghost) — reviewer self-downgraded to non-actionable: guard is sound (cleanup only registered on runs that open a channel; no loops/stale closures), and the filter ghost wraps rather than overflows (matches the real `searchInputStyle`).

**code-simplifier:** diff is 3 small files; the reviewer assessed structure and found no speculative abstraction. The three `with*` booleans are independently composable (Characters = addCard + filterBar, Home = addCard + sectionHeader) — a single `variant` enum would be less flexible, not simpler. `addCardStyle` is a module const. No changes applied.

**Non-negotiables:** untouched — frontend chrome only, no SSE / agent-isolation / grammar / lorebook / snapshot / prompt-assembly / schema / migration / dependency.

**Residual notes:**
- `SkeletonAddCard.marginBottom` is 1.75rem (exact for Home). Characters' real add-card wrapper is 1.25rem, so the Characters skeleton add-card sits ~8px tall — negligible, transient, and Characters was not the flagged surface.
- The Characters page h1 ("Your Characters", above the add-card) still has no skeleton counterpart; on desktop that's a small uniform offset of the whole skeleton block, on mobile it's hidden via `.sp-page-h1`. Out of scope for 0124's flagged finding; can be a follow-up if creator surfaces it.
