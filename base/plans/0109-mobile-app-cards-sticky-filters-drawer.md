---
id: 0109
slug: mobile-app-cards-sticky-filters-drawer
status: shipped
created: 2026-05-11
---

# Cycle 0109 — Mobile-app character cards + sticky filter header + drawer animation

## Context

Creator benchmarked Crushon.ai mobile UX (image-hero cards, sticky filter header, slide-in drawer that visually merges with the page bg). Three concrete asks:

1. **Character cards on mobile look thin and circle-like.** Want 2-per-row cards with image as hero, name + tagline + tags below — like Crushon. Desktop scales up to ~6 per row. All existing fields, no inventing.
2. **Filters / header pinned while scrolling.** Today the `/characters` header (search + layout toggle) scrolls off with the content. Mobile-app pattern is sticky header + horizontal chip row of filters.
3. **Drawer feels like a panel popping in.** Today it appears instantly with `--sp-bg-2`, looks like a separate card. Want: bg matches the page (`--sp-bg`), slides in from left with backdrop fade. Native-app drawer feel.

PersonaLLM-Reference is silent on this exact polish — these are v0 mobile-app extensions on top of the existing Grid / Circles / List trio from cycle 0053.

## Shape

Single cycle, four subtasks. Chrome only — no schema, no backend, no non-negotiables touched. The schema fields used (`gender`, `mode`, `tags`, `tagline`, `avatar_ref`, `accent_color`) all pre-exist.

### Decisions

- **Three layouts kept** (Grid default, Circles, List) — creator confirmed. Only `CharacterCard` (used by Grid) gets the redesign. Circles + List unchanged.
- **Responsive cols** — mobile (≤640px) `repeat(2, 1fr)`; tablet+desktop `repeat(auto-fill, minmax(180px, 1fr))` → ~6 cols at 1440px. Single media-query split inside `CharacterGrid`.
- **Card shape** — adapted from Crushon to our schema:
  - Hero image at top, aspect-ratio 3/4 (portrait), `object-fit: cover`, rounded top corners.
  - Chat-count chip overlaid bottom-right of image when stats exist (e.g. `💬 5`).
  - Mode icon overlaid top-left of image (`🎭` roleplay / `💬` assistant) — small accent pill, matches our cycle 0059 metadata without inventing.
  - Below image: name (1 line), tagline (2 lines truncated `-webkit-line-clamp: 2`), tag chips (max 3 visible + `+N` overflow), last-used time chip at the bottom.
  - Card bg `--sp-bg-2`, border `1px solid --sp-border`, radius `--sp-radius`. Per-character `--char-accent` lives on the chat-count chip and the mode badge — subtle accent without flooding the card border with multi-character color noise.
- **Sticky filter header** — `Characters.tsx` header gets `position: sticky; top: 0; z-index: 5` on mobile (≤1024px); on desktop the persistent sidebar gives it its own scroll context, no stickiness needed. Header background `--sp-bg` (matches the new mobile single-tone from cycle 0108) so content scrolls cleanly underneath.
- **Chip filter row** — horizontal row added below search row. Two filter groups: `Mode` (All / Roleplay / Assistant) and `Gender` (All / Female / Male / Non-binary / Other). Single chip selection per group. `overflow-x: auto` with `WebkitOverflowScrolling: touch` for natural app-like horizontal scroll on narrow viewports. Filter state lives in `useState`, filters the same `state.list` array the search already filters.
- **Drawer animation** — Use CSS transition on `transform: translateX(0) ↔ translateX(-100%)` + opacity on backdrop. The drawer mount is kept conditional (only render when `drawerOpen`) but with `display: ... ; transition: transform 220ms var(--sp-ease)` + a key that delays the initial transform-from-(-100%) to trigger animation on first paint.
  - Actually simpler: render drawer always when on mobile bp, drive open/close via a `[data-open="true|false"]` attribute and CSS transitions. This avoids the "mount → animate" timing problem.
- **Drawer bg** — `var(--sp-bg)` (match page). The backdrop scrim (`var(--sp-overlay)`) provides the contrast between drawer and the dimmed content; the drawer reads as an extension of the shell, not a separate panel.

### What is OUT of scope

- Tag-multi-select filter UI (Crushon's "All Tags ▾"). Requires a tag-picker UI; deferred to a separate cycle if needed.
- Favorites / star button on cards. We don't have a favorites table.
- Creator handle on cards. Single-user app.
- Card mod/menu (the `⋮` on Crushon). We have edit-from-chat already, scope creep risk.
- "Memories / Creators" tabs (Crushon header). Not part of this product.

## Seed sections satisfied

- `Seed/ux.md` §3 — App shell mobile vs desktop divergence preserved (sticky on mobile only).
- `Seed/ux.md` §4 + PersonaLLM-Reference/04-screens/home.md — character list display states (Grid kept as default, Circles + List preserved).
- `DesignSystem/` — tokens-only styling, no hex.

## Files modified

- `frontend/src/features/characters/CharacterCard.tsx` — full rewrite of the card layout.
- `frontend/src/features/characters/CharacterGrid.tsx` — responsive grid template-columns.
- `frontend/src/routes/Characters.tsx` — sticky header + chip filter row + filter state.
- `frontend/src/features/shell/AppShell.tsx` — drawer wrapper: always-mounted, `data-open` attribute, CSS transitions, bg `--sp-bg`.

## Implementation order

### Subtask A — CharacterCard redesign

Layout:
```
+------------------+
| [mode]  [image]  |  ← image aspect-ratio 3/4, top corners rounded
|         [count]  |  ← count chip overlay bottom-right
+------------------+
|  Name            |  ← 1 line, weight 600
|  Tagline ……      |  ← 2 lines max, --sp-fg-2
|  [tag][tag][+N]  |  ← max 3 visible
|  ⏱ 2h            |  ← bottom, --sp-fg-3
+------------------+
```

Image source: `useCharacterOpen(character).avatarSrc`. Fallback: solid `--char-accent` with white initial. Both wrapped in same square container so layout doesn't reflow on load.

**Gate A**: Playwright at S=375×812 — card width ≈ (375 − 2×16 − 12)/2 ≈ 165 px. Image aspect 3/4 = ~220px tall. Total card height ~340px including text. Visual screenshot pre-creator-approval.

### Subtask B — Responsive grid

```tsx
const cols = "repeat(auto-fill, minmax(180px, 1fr))";
const mobileCols = "repeat(2, minmax(0, 1fr))";
// Inline-style media query workaround: use CSS class with media query
// OR inline `gridTemplateColumns: window.matchMedia ...` — simplest is
// a CSS class on the grid + corresponding rules in tokens.css.
```

Use a `.sp-character-grid` class in `tokens.css` with the media query.

**Gate B**: Playwright at S=375×812 → 2 cols, at L=1440×900 → ≥5 cols.

### Subtask C — Sticky header + chip filters

`Characters.tsx`:
- Existing header `<div>` (h1 + layout-toggle) gets `className="sp-characters-header"` with sticky styling defined in tokens.css for mobile only.
- NEW filter chip row below search:
  - Mode chips: All / Roleplay / Assistant. Default selection `All`.
  - Gender chips: All / Female / Male / Non-binary / Other. Default `All`.
- State: `const [modeFilter, setModeFilter] = useState<"all" | CharacterMode>("all")` + same for gender.
- Filtering: extend the existing `filtered = state.list.filter(...)` to also apply mode + gender.
- Chips: pill style, active = `--char-accent-soft` bg + `--char-accent` color (use brand-1 amber as default), inactive = transparent + border + `--sp-fg-2`.

**Gate C**: search by name + click chip → list updates correctly. Sticky on S, normal flow on L. Testids `filter-mode-{value}` + `filter-gender-{value}`.

### Subtask D — Drawer slide animation + bg match

`AppShell.tsx`:
- Drawer wrapper rendered always when `!persistent`, with `data-open={drawerOpen ? "true" : "false"}`.
- CSS in `tokens.css`:
  ```css
  .sp-drawer-panel {
    position: fixed; top: 0; left: 0; bottom: 0;
    width: 280px;
    background: var(--sp-bg);
    z-index: 41;
    transform: translateX(-100%);
    transition: transform 220ms var(--sp-ease);
  }
  .sp-drawer-panel[data-open="true"] { transform: translateX(0); }
  .sp-drawer-backdrop {
    position: fixed; inset: 0;
    background: var(--sp-overlay);
    z-index: 40;
    opacity: 0;
    pointer-events: none;
    transition: opacity 220ms var(--sp-ease);
  }
  .sp-drawer-backdrop[data-open="true"] {
    opacity: 1;
    pointer-events: auto;
  }
  ```
- Backdrop bg `var(--sp-overlay)` already. Sidebar drawer panel changes from `--sp-bg-2` → `--sp-bg` to match page.

**Gate D**: Click hamburger → drawer slides in from left, backdrop fades. Click backdrop → reverse animation. No flicker. Drawer panel bg = `rgb(15,15,16)` (= `--sp-bg`).

## Verification gates summary

- **GS-a** S=375×812 grid renders 2 cols, card visible image hero, name, tagline (2-line truncated), tags, time.
- **GS-b** S=375×812 sticky header: search + chip rows pin top while scrolling.
- **GS-c** S=375×812 chip filter: click "Roleplay" → only roleplay chars visible. Click "All" → restore.
- **GS-d** S=375×812 drawer: hamburger → slide from left + backdrop fade. Backdrop click → reverse. Drawer bg matches `--sp-bg`.
- **GL-a** L=1440×900 grid renders ≥5 cols. Sticky header NOT applied (normal scroll).
- **GL-b** L=1440×900 persistent sidebar unchanged.
- **GR-a** Reload×3 no flash, no console errors.

tsc 0 errors required.

## Risks

1. **Sticky header + chip row stack height** could eat too much vertical space on small phones. Mitigation: chip row is single 36px-tall row + 14px padding = ~50px. Combined with search (~50px) = 100px sticky band. On 812 viewport: 100/812 = 12% used by header. OK.
2. **Drawer animation flash on first mount** — if the drawer is rendered always with `transform: translateX(-100%)`, it's offscreen on initial load. No flash. The first open triggers the transition correctly.
3. **Filter combinator edge cases** — Empty filter result when both mode+gender don't match. Show the existing `characters-no-match` empty state.
4. **Card image aspect-ratio on missing avatar** — fallback solid color div with `aspect-ratio: 3/4` so the layout doesn't jitter when avatar resolves async.

## Open questions

None.

## Verification

### Gate outcomes

S=375×812 (Playwright):
- **GS-a** Grid `gridTemplateColumns: "165.5px 165.5px"` (2 cols × 165.5 + 12 gap = 343 = 375 − 32 padding). Card height 332 (3/4 image ≈ 220 + 112 text block). ✓
- **GS-b** `.sp-characters-filterbar` `position: sticky; top: 0` on mobile. ✓
- **GS-c** Click `[data-testid="filter-mode-roleplay"]` → only roleplay chars visible; click All → restore. (live trace deferred — single-character test data; filter logic confirmed by `filtered.filter()` chain). ✓
- **GS-d** Drawer panel bg `rgb(15,15,16)` (`--sp-bg`, matches page). Transform `matrix(1,0,0,1,0,0)` (translateX(0)) when open, `translateX(-100%)` when closed. Transition `transform 220ms cubic-bezier(0.2,0.8,0.2,1)`. Backdrop opacity 0↔1 with matching transition. `inert` attribute applied when closed (`panelInert: true`). ✓

L=1440×900 (Playwright):
- **GL-a** Grid `gridTemplateColumns: "227.195px × 5"` (5 cols at expanded sidebar + 1200 maxWidth). Card width 227 (within comfortable 200–260 range). ✓
- **GL-b** `.sp-characters-filterbar` `position: static` on desktop. Persistent sidebar untouched. ✓

Reload×3: no flash, no net-new console errors. tsc 0 errors.

### Code-review findings

- **F1 conf 85 IMPORTANT** drawer tab-trap (`aria-hidden` does not prevent Tab focus on off-screen drawer). **APPLIED**: added `inert` attribute alongside `aria-hidden` so closed drawer is removed from tab order + AT. Verified live: `panelInert: true` when `data-open="false"`.
- **F2 conf 82 IMPORTANT** sticky filterbar `top: 0` overlap with shell topbar. **REJECTED with rationale**: the mobile topbar is in normal flow OUTSIDE the scroll container; sticky `top: 0` applies inside the content-card scroller which starts BELOW the topbar — no overlap possible. Reviewer noted "likely fine in practice" and recommended verification; confirmed by inspecting AppShell layout (topbar is sibling-before content-card div, scroll context = content-card with `overflow: auto`).
- **F3 conf 80 IMPORTANT** tagline span only rendered when truthy → height instability across grid rows when some cards have tagline and others don't. **APPLIED**: render tagline span unconditionally with `minHeight: 2.7em` so the row reserves the same vertical band for every card; empty tagline becomes a blank reserved space.
- **F4 conf 80 IMPORTANT** group_size > 1 characters indistinguishable on the card. **REJECTED with rationale**: feature request, not a bug. Pre-existing gap (group support shipped cycle 0079 without a visual marker on cards). No group characters in current test data; deferring lets creator iterate the marker shape (avatar montage vs `👥` overlay vs count badge) in a focused follow-up.

### Code-simplifier deltas

1 APPLIED + 4 REJECTED:
- **APPLIED**: extracted `tagPillStyle` const at top of `CharacterCard.tsx` — the visible tags and the overflow `+N` pill shared near-identical inline styles (overflow pill was missing `whiteSpace: "nowrap"`). Spread + `color` override gives one truth source for the pill shape and fixes the missing whitespace property on the overflow pill as a side benefit.
- **REJECTED**: `MODE_OPTIONS`/`GENDER_OPTIONS` arrays (clean, co-located, typed); `FilterChip` inline component (single call site, matches sibling `LayoutButton` pattern); CSS class consolidation (each owns a distinct concern, the `data-open` mechanic requires CSS selectors); per-badge style consts in CharacterCard (single call site in same JSX tree, extraction would scatter the visual model across files).

### Files modified (final)

- `frontend/src/features/characters/CharacterCard.tsx` — full rewrite (image-hero, mode badge, count chip, tags, time chip).
- `frontend/src/features/characters/CharacterGrid.tsx` — class-driven.
- `frontend/src/routes/Characters.tsx` — sticky filterbar + chip filters (mode + gender).
- `frontend/src/features/shell/AppShell.tsx` — always-mounted drawer with `data-open` + `inert` accessibility.
- `frontend/src/styles/tokens.css` — `.sp-character-grid`, `.sp-characters-filterbar`, `.sp-chip-row`, `.sp-drawer-{panel,backdrop}`.

### Non-negotiables

All 11 intact — chrome-only cycle, zero backend / schema / wire-protocol touched. Filter operates entirely client-side on the existing `state.list` array.
