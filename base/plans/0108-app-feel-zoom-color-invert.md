---
id: 0108
slug: app-feel-zoom-color-invert
status: shipped
created: 2026-05-10
---

# Cycle 0108 — App-feel: kill zoom, scale mobile, invert chrome colors

## Context

Two creator complaints surfaced after deploy (cycle 0105) on iPhone:

1. **Web-page-y zoom behavior.** iOS auto-zooms when an input with `font-size < 16px` gets focus, and pinch / double-tap zoom are still active anywhere on the page. The product reads as a website, not as an app.
2. **Mobile chrome too small.** Sidebar drawer rows, settings list rows, and inline body text feel like a desktop site shrunk to phone width — not native phone-app-sized.

Plus a chrome inversion request:

3. **Color polarity.** Today the OUTER (body, sidebar gutter) is darker (`--sp-bg` `#0F0F10`) and the INNER content card is lighter (`--sp-bg-2` `#1C1C1E`). Creator wants the opposite: a slightly-lighter chrome **frame** around a darker reading **pane**. On mobile, single tone (the dark inner) — no two-tone topbar+sheet.

Provenance: creator screenshot review of `/` Home on desktop (showed the dark outer frame + lighter inner card today), iPhone live testing (showed the auto-zoom on input focus and the small sidebar drawer items).

## Shape

Single cycle, all chrome — zero backend, zero schema, zero non-negotiable touched. Three interlocking subtasks because the font-base bump *also* fixes the iOS auto-zoom (16px is iOS Safari's threshold), which means subtask A serves both the zoom kill and the mobile-bigger requests with one coherent change.

### Token & layout decisions

- **Viewport**: add `maximum-scale=1.0, user-scalable=no` to the meta tag. Kills pinch-zoom + double-tap-zoom + auto-zoom-on-focus across all of iOS Safari and Android Chrome. The accessibility tradeoff is intentional (creator chose "comportamiento tipo app" over "honor browser zoom"); image lightboxes are full-screen surfaces where zoom is not needed.
- **Base font scale**: `--sp-text-base` 15px → 16px. html/body inherit. Children that read `var(--sp-text-base)` or inherit body font-size (most cards, lists, labels) scale up by 6.7% globally — this is what "everything looks slightly bigger like an app" means in practice. Subtle, intentionally not aggressive (per creator: "subtly try it yourself to see that it looks good").
- **Hardcoded `fontSize: 15` on inputs** → bump to 16:
  - `frontend/index.html` line 119 — `[data-form="stack"]` input/textarea/select (covers ~24 sub-routes via global rule).
  - `frontend/src/features/chat/Composer.tsx` line 123 — chat textarea.
  - `frontend/src/routes/Characters.tsx` line 200 — `searchInputStyle`.
- **Mobile sidebar drawer scale-up** (only mobile/M; desktop persistent sidebar untouched):
  - Drawer nav row icons 18 → 22 px.
  - Drawer nav row padding 0.5rem 0.75rem → 0.75rem 1rem.
  - Drawer Settings + Persona footer rows match the same scale.
  - The sidebar's `mode === "drawer"` branch is the existing discriminator — bump scale conditional on that, leave persistent untouched.
- **Color invert (AppShell-level only — no token edits)**:
  - Outer flex container: `background: var(--sp-bg-2)` (was implicitly `--sp-bg` from body).
  - Persistent (desktop L) content card: `var(--sp-bg)` (was `var(--sp-bg-2)`).
  - Mobile non-chat content sheet: `var(--sp-bg)` (was `var(--sp-bg-2)`). Mobile = single-tone now: outer bg-2, content sheet bg, gradient between them flips.
  - Mobile topbar gradient: `linear-gradient(180deg, var(--sp-bg-2) 0%, var(--sp-bg-2) 55%, var(--sp-bg) 100%)` (was `--sp-bg → --sp-bg-2`).
  - Sticky topbar fade strip below it: `linear-gradient(180deg, var(--sp-bg) 0%, transparent 100%)` (was `--sp-bg-2 → transparent`).
  - Drawer overlay surface (the slide-in panel itself): `var(--sp-bg-2)` (was `var(--sp-bg-1)`) — matches the new outer light frame so when the drawer pulls in, it reads as a continuation of the light gutter rather than an unrelated panel.
  - Backdrop: keep `var(--sp-overlay)` (already the right scrim, reads on top of any bg).

Internal elevation hierarchy is preserved — sub-cards inside the new dark inner card still use `--sp-bg-2` (now LIGHTER than parent), inputs `--sp-bg-3` (lighter still). Same elevation logic, just inverted parent-vs-card relationship.

### What is explicitly OUT of scope

- Token semantics: `--sp-bg`, `--sp-bg-1`, `--sp-bg-2`, `--sp-bg-3` keep their hex values. Only **where** they're applied at the AppShell level changes. This means features/cards across the rest of the app are untouched.
- Auth surface (`/sign-in`, `/sign-up`, `/reset-password`) — sits outside AppShell. Not touched.
- Chat shell internal chrome — owns its own card chrome via `ChatShell.tsx`. Not touched (scope-creep risk; if it looks wrong post-invert, defer to a follow-up).
- iPhone-specific safe-area padding — the existing `env(safe-area-inset-bottom)` in Composer is untouched.
- Image lightbox pinch-zoom — `user-scalable=no` kills it system-wide; the creator accepted that explicitly ("quizás en una imagen sí pero no en cualquier parte" was the original ask, but follow-up chose "comportamiento tipo app donde no hay zoom"). Lightbox already fills the viewport, so loss is minimal. If creator wants pinch back on the lightbox specifically, that's a scoped follow-up cycle (not bundled).

## Seed sections satisfied

- `Seed/ux.md` §3 — App shell adapts to breakpoint. The single-tone mobile + two-tone desktop is exactly the "L vs S" divergence the seed mandates.
- `Seed/design.md` — chrome elevation system is preserved (only the parent-child polarity changes); tokens stay frozen.
- `DesignSystem/colors_and_type.css` — read-only. Neither tokens.css nor DesignSystem are edited.

PersonaLLM-Reference is silent on this exact polarity (the reference app uses a single dark surface throughout); this is a v0-specific extension, declared as such in the plan.

## Non-negotiables intact

All 11 non-negotiables from `creator-vision.md §8` are unaffected — this cycle is pure visual chrome:
- SSE / agent isolation / grammar default OFF / per-conv lorebook / edit-as-trim / branching / snapshots / Supabase truth / BYOK / vendor-agnostic / plain-text reply path → all wire-protocol-untouched.

## Files modified

- `frontend/index.html` — viewport meta + `[data-form="stack"]` input font-size 15→16.
- `frontend/src/styles/tokens.css` — `--sp-text-base: 15px → 16px`.
- `frontend/src/features/shell/AppShell.tsx` — outer wrapper bg + content card bg + topbar gradient + topbar fade strip + drawer panel bg.
- `frontend/src/features/shell/Sidebar.tsx` — drawer-mode scale: nav row icon size + padding (conditional on `mode === "drawer"`).
- `frontend/src/features/chat/Composer.tsx` — textarea font-size 15→16.
- `frontend/src/routes/Characters.tsx` — search input font-size 15→16.

## Implementation order — atomic subtasks with gates

### Subtask A — viewport + font-base bump

**Edits:**
- `index.html` viewport meta: `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`.
- `index.html` `[data-form="stack"]` input rule: `font-size: 15px → 16px`.
- `tokens.css` `--sp-text-base: 15px → 16px`.
- `Composer.tsx` `textareaStyle.fontSize: 15 → 16`.
- `Characters.tsx` `searchInputStyle.fontSize: 15 → 16`.

**Gate A** (Playwright @ S=375×812 with iPhone 14 Pro UA):
- Open `/` — body computed font-size = 16px.
- Open `/character/new` (CharacterForm) — focus the Name input, viewport scale stays at 1.0 (no auto-zoom). `screenshot.height` doesn't shrink as a sign of zoom.
- Open `/chat/<convId>` — composer textarea computed font-size = 16px; focus does not zoom.
- Pinch-zoom gesture is rejected (assert via JS that `document.documentElement.clientWidth === window.innerWidth` after a programmatic touch event sequence — or visual: take screenshot, attempt zoom, take second screenshot, compare bbox of a known element).

### Subtask B — mobile sidebar drawer scale

**Edits:**
- `Sidebar.tsx` `itemStyle(collapsed, active, isDrawer?)` gains an `isDrawer` flag. When `isDrawer`: padding `0.75rem 1rem`, icon size 22 (passed to `<Icon icon={item.icon} size={iconSize} />`).
- Footer Settings row + collapsed/expanded persona row also receive the bigger size in drawer mode.

**Gate B** (Playwright @ S=375×812):
- Open `/`, click hamburger, drawer opens.
- Read computed `padding-top` of first nav row (`[data-testid="nav-home"]`) — assert ≥12px (was 8 = 0.5rem).
- Read icon `<svg>` width/height — assert =22 (was 18).
- Tap any nav row — drawer closes via `onNavClick`, navigation works (existing behavior preserved).
- Persistent sidebar at L=1440×900 unchanged: row icon size still 18, padding still 0.5rem 0.75rem.

### Subtask C — color invert at AppShell

**Edits:**
- `AppShell.tsx`:
  - Root flex container gains `background: "var(--sp-bg-2)"` (was relying on body bg).
  - Content card div: `background: persistent ? "var(--sp-bg)" : "transparent"` (swap from bg-2).
  - Mobile content sheet wrapper: `background: (!persistent && !isChatRoute) ? "var(--sp-bg)" : "transparent"` (swap from bg-2).
  - Topbar header gradient: `linear-gradient(180deg, var(--sp-bg-2) 0%, var(--sp-bg-2) 55%, var(--sp-bg) 100%)`.
  - Sticky fade strip below topbar: `linear-gradient(180deg, var(--sp-bg) 0%, transparent 100%)` and bg color matches the dark sheet so the merge is invisible.
  - Drawer panel wrapper bg: `var(--sp-bg-2)` (was `var(--sp-bg-1)`).

**Gate C** (Playwright):
- @ L=1440×900: outer flex container computed `background-color === rgb(28, 28, 30)` (--sp-bg-2). Content card computed `background-color === rgb(15, 15, 16)` (--sp-bg). Sidebar reads against the lighter outer (visual: take screenshot, eyeball the contrast vs prev screenshot).
- @ S=375×812: outer + content sheet both visually merge into a single tone — content sheet computed bg = `rgb(15, 15, 16)`. Outer (where topbar lives) = bg-2 strip at top. No visible cut between them (gradient bridges).
- Open drawer @ S — drawer panel bg = `rgb(28, 28, 30)` (matches outer light frame).
- Reload x3 — no flash of wrong color (the inversion is a static style, not a state).

### Subtask D — TypeScript + screenshots

- `npx tsc --noEmit` in `frontend/` → 0 errors.
- Final L=1440×900 + S=375×812 screenshots saved to `.playwright-mcp/` (per memory: never to repo root).

## Verification gates summary

- **GL-a** L=1440×900: outer light frame + dark card visible, sidebar transparent reads against light, no regression on Recent Characters page.
- **GL-b** L=1440×900: open `/character/new/edit` — form inputs still read with `--sp-bg-inset` (untouched), `data-form="stack"` 16px font, no auto-zoom-on-focus needed at this bp but font is bigger.
- **GS-a** S=375×812: viewport blocks pinch (compare two screenshots before/after attempted pinch — same dimensions).
- **GS-b** S=375×812: tap input, screenshot, viewport scale still 1.0 (no zoom-in).
- **GS-c** S=375×812: drawer rows visibly bigger (icon 22, padding 0.75rem 1rem).
- **GS-d** S=375×812: content sheet single tone — no visible color cut between topbar and content (gradient now `bg-2 → bg`).
- **GR-a** Reload×3: no flash, no regression in console (only pre-existing warnings).
- **GR-b** Active states (NavLink active, settings active stripe) still readable on the inverted bgs — adjust if not (active fill `--sp-bg-3` is lighter than dark inner card, should still pop).

## Risks

1. **Input chrome contrast.** `[data-form="stack"]` inputs use `--sp-bg-inset` (`#0A0A0B`, even darker than `--sp-bg`). Inside the new dark inner card (`--sp-bg`), the input bg-inset is barely separable. Mitigation: visual check; if it disappears, swap the rule to `--sp-bg-2` for inputs (one-line index.html change). Defer the actual decision to live screenshot.
2. **Active sidebar nav fill.** The active fill is `--sp-bg-3` (`#252527`) on a now-`--sp-bg-2` outer. That's a 9-luma-unit gap, smaller than before (`--sp-bg-3` on `--sp-bg` was 22 units). May read as too subtle. Mitigation: if so, bump active fill to `--sp-border-soft` (`#3F3F46`) — single-token swap.
3. **Pinch-zoom loss = a11y regression.** Documented above. Creator accepted it explicitly; if a future reviewer flags it, the meta is one line away from being reverted (`maximum-scale=5.0`).
4. **Topbar gradient direction.** The fade is now `light → dark` going down. If it looks weird against the chat header color, defer chat shell to a follow-up — explicitly out of scope here.

## Open questions

None — all decisions captured above.

## Verification

### Gate outcomes

L=1440×900 (Playwright):
- **GL-a** body fontSize = 16px, outer flex bg = `rgb(28,28,30)` (`--sp-bg-2` light frame), content card bg = `rgb(15,15,16)` (`--sp-bg` dark inner). ✓
- **GL-b** Sidebar bg = `rgba(0,0,0,0)` transparent (reads against the new outer light frame). ✓
- **GL-c** Sidebar collapse chevron post code-review F1 = `rgb(37,37,39)` (`--sp-bg-3`) — visible against the new `--sp-bg-2` outer where it had previously been invisible (same-color blend). ✓
- **GL-d** Desktop chat: header bg transparent + 1px border-bottom `--sp-border-soft`, content card transparent (inherits dark AppShell card). ✓
- **GL-e** Settings + Characters routes: AppShell card stays dark, inner sub-cards `--sp-bg-2` lift correctly. ✓

S=375×812 (Playwright):
- **GS-a** Outer flex + content sheet + topbar all `rgb(15,15,16)` (`--sp-bg`) — single-tone end-to-end (post creator iteration "que en mobile solo este el oscuro"). ✓
- **GS-b** Topbar gradient + sticky fade strip removed entirely; topbar reads as solid sheet color (post iteration "mejor eso del gradiente en el top no"). ✓
- **GS-c** Drawer panel bg = `rgb(28,28,30)` — slightly elevated above the dark mobile bg so the slide-in surface reads as a layered panel. ✓
- **GS-d** Drawer nav row icon size = 22 (was 18), padding 12px 16px (was 8px 12px), fontSize ~16.8px — bigger touch targets. ✓
- **GS-e** Profile inputs (`data-form="stack"`) all 16px; Characters search input 16px. ✓
- **GS-f** Mobile chat: header + feed-wrapper + composer footer all `rgb(15,15,16)` uniform (post creator iteration "creo que es el chat el que le hace falta"). ✓
- **GS-g** Composer placeholder = `"Type a message…"` (was `"Type a message. Enter to send, Shift+Enter for newline."` — irrelevant on mobile). ✓
- **GS-h** Outer flex `height: 100dvh` resolves to actual viewport height (812 px in Playwright). On iOS this tracks URL bar collapse + keyboard so header/composer stay visually pinned. ✓
- **GS-i** Feed `overscrollBehavior: contain` (rubber-band scroll trapped inside feed; shell stays put). ✓

Reload×3:
- **GR-a** No flash, no console errors net-new. Two pre-existing React Router v7 future-flag warnings persist. ✓

Viewport:
- **GR-b** `<meta name="viewport">` content = `"width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"`. iOS Safari auto-zoom-on-focus killed (16 px input font-size also defends in depth); pinch + double-tap zoom disabled site-wide per creator decision. ✓

tsc: 0 errors.

### Code-review findings

- **F1 conf 85 IMPORTANT** — `controlStyle` collapse/close button background was `--sp-bg-2` (now equal to the outer frame after the polarity flip), making the chevron invisible against the new outer. **APPLIED**: `Sidebar.tsx` controlStyle bg → `--sp-bg-3` (one step lighter, matches the active-nav-fill contrast policy already in the chrome). Verified live: `rgb(37,37,39)` against `rgb(28,28,30)` outer.
- **F2 conf 80 IMPORTANT** — `MessageBubble.tsx` lines 133/143 still hardcode `fontSize: 15`. **REJECTED with rationale**: bubble text is a deliberate kit-faithful reading-size override (slightly tighter than body), not a focusable input — iOS auto-zoom does not fire from non-input text, and `user-scalable=no` already blocks zoom defense-in-depth. Bumping to 16 would balloon every chat bubble and disrupt the chat reading rhythm. Plan scope explicitly listed inputs/textareas/selects only.

### Code-simplifier deltas

0 applied / 3 rejected:
- **Collapse `itemStyle` drawer ternaries into a single spread** — REJECTED. `padding` is tri-state (collapsed / drawer / default), not binary, can't compress without re-introducing a nested conditional. Side-by-side ternaries make future tweaks one-line diffs and keep both branches visually adjacent.
- **Inline `navIconSize`** — REJECTED. Used at 2 call sites; named const documents the icon-size policy in one place alongside the comment block.
- **Inline `isDrawer`** — REJECTED. 3 usages; inlining `props.mode === "drawer"` thrice is strictly worse.

### Creator-iteration trail (post initial-ship)

- **Iteration 1**: After GL/GS gates passed, creator reviewed mobile screenshot and asked for full single-tone (the topbar still had `--sp-bg-2` and faded into `--sp-bg`, leaving a visible strip). Edits: AppShell outer flex bg → `var(--sp-bg)` on `!persistent`, topbar bg → solid `var(--sp-bg)`, removed the sticky fade strip.
- **Iteration 2**: Creator surfaced that chat (`/chat/*`) wasn't getting the invert because ChatShell owns its own bg. Edits: ChatShell mobile header gradient → solid `var(--sp-bg)`, mobile feed-wrapper bg `--sp-bg-2 → --sp-bg`, removed the chat fade strip. Desktop unchanged (already inherited the AppShell card via `transparent`).
- **Iteration 3**: Creator asked for chat header + composer to feel pinned ("fixed for app feel") and to drop "Shift+Enter for newline" in the placeholder (irrelevant on mobile). Edits: AppShell `height: 100vh → 100dvh` (dynamic viewport, tracks iOS URL bar + keyboard), `MessageFeed` adds `overscrollBehavior: contain` (rubber-band trapped to the feed), Composer placeholder → `"Type a message…"`.

### Files modified (final)

- `frontend/index.html`
- `frontend/src/styles/tokens.css`
- `frontend/src/features/shell/AppShell.tsx`
- `frontend/src/features/shell/Sidebar.tsx`
- `frontend/src/features/chat/ChatShell.tsx`
- `frontend/src/features/chat/Composer.tsx`
- `frontend/src/features/chat/MessageFeed.tsx`
- `frontend/src/routes/Characters.tsx`

### Screenshots

`.playwright-mcp/cycle-0108-L-{home-final,settings-invert,characters-invert,chat-uniform}.png`
`.playwright-mcp/cycle-0108-S-{home-uniform,characters,profile-inputs,drawer-invert,character-new,chat-uniform,chat-fixed-final}.png`

### Non-negotiables

All 11 from `creator-vision.md §8` intact — pure visual chrome cycle, zero backend / schema / wire-protocol touched.
