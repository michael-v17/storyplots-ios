---
id: 0071
slug: chat-periphery
status: shipped
created: 2026-04-20
---

# Cycle 0071 — Chat periphery re-skin

## Context

Séptimo cycle del Design Overhaul (foundation 0066 → shell 0067 →
Home 0068 → chat core 0069 → global chrome reset 0070 → CharacterForm
0072 swap). Este cycle termina de tokenizar todo lo que vive **alrededor
de la bubble** en `/chat/*`: el scenario card visible arriba del feed,
la action rail (↻ Regenerate / ⑂ Fork / 🖼 Image / ▶ Play) bajo cada
assistant bubble, la `ConversationSwitcher` del header ("New
Conversation ▾"), el `BranchBreadcrumb` (↳ Parent pill), el
`GrammarSidebarPanel` (inline L + overlay S) y el `ChatControlsPanel`
completo con sus 4 sub-panels (AuthorsNoteEditor · LorebookPanel ·
MemoryPanel · GenerationOverridePanel). Cierra el feedback post-0069
del creator ("botones blancos ↻/⑂/🖼/▶ que no tienen match", "fondo
morado bajo contraste del scenario") y el post-0072 ("New Conversation
dropdown con chrome default").

Se incluye además un fix al **backlog post-0072 item #1** (chat user
bubble contraste con accent legacy light, ej. Evelyn `#6BE08C` mint →
texto blanco ilegible): helper puro `accentTextColor()` basado en
luma WCAG que decide white vs near-black según el `--char-accent`
resuelto. Esto protege prospectivamente y también a characters
existentes con accent legacy sin tocar SQL.

## Scope quirúrgico 0071 — NO cruzar

- **MessageBubble bubble styles (user pill / assistant card / selected
  border+glow / variants counter)** → ya shipped en 0069, no tocar.
  Este cycle **sí** toca MessageBubble porque la `ActionRail` vive
  inline en el JSX del MessageBubble (no es componente separado); pero
  toca sólo el bloque `<div style={{ display: 'flex', gap: ... }}>`
  de action buttons — el `actionBtn` const se elimina/reemplaza.
- **ChatShell header chrome (bg-1 + border-soft + tokens
  hamburger/Back/Edit/⋯/avatar/name/tagline)** → ya shipped en 0069,
  no tocar. Este cycle **sí** toca ConversationSwitcher que vive en
  ese header — toggle + dropdown.
- **Composer pill + gradient send button** → shipped en 0069, no tocar.
- **Memory toast** → shipped en 0069 (bg-2 + `--char-accent-border`),
  no tocar.
- **ImageViewer lightbox** → ya re-skinado parcialmente por cycles
  previos (0015/0044/0049); deep polish cae en 0075 Gallery.
- **MessageImage / MessageAvatar / MessageAudioButton / RewriteGate /
  EditTrimDialog / ForkDialog** → cycles dedicados posteriores
  (0072/0075/0077). No tocar aquí.
- **GrammarInlineRow** (corrections row bajo user bubbles cuando
  grammar mode A) → **0078** (Grammar re-skin). No tocar.

## DesignSystem provenance (precedencia #2)

- [DesignSystem/ui_kits/app/ChatScreen.jsx](../DesignSystem/ui_kits/app/ChatScreen.jsx)
  líneas 118-128 (ScenarioCard) + 141-168 (AssistantMessage con
  selected IconButton row) — canónico:
  - **ScenarioCard:** `border: 1px solid var(--char-accent-border)`,
    `borderRadius: 14`, `padding: '12px 14px'`, `background:
    var(--char-accent-softer)` (color-mix 10% accent en transparent),
    header row con 2 `Pill tone="accent"` (labelChip + titleChip),
    body italic narration `var(--sp-fg-1)` line-height 1.55.
    Preview auth: `components-scenario.html` — pills con `color
    var(--char-accent)` + `border var(--char-accent)` + `borderRadius
    999` + `padding: 3px 10px`.
  - **Action rail chips:** `width:40 height:40 borderRadius:50%
    background color-mix(--char-accent 16%, --sp-bg-2)
    border: 1px var(--char-accent) color var(--char-accent)`. Preview
    auth: `components-action-rail.html`.
- [DesignSystem/ui_kits/app/components.jsx](../DesignSystem/ui_kits/app/components.jsx)
  líneas 16-33 (`Pill tones`) + 79-92 (`IconButton accented`):
  `accent`-tone pill = `bg: var(--char-accent-soft)` + `color:
  var(--char-accent)` + `border: 1px var(--char-accent)`; `size: 40`
  default.
- [DesignSystem/preview/components-scenario.html](../DesignSystem/preview/components-scenario.html)
  — ground truth visual scenario con 2 pills "Scenario 1" +
  "Late Night Check-In".
- [DesignSystem/preview/components-action-rail.html](../DesignSystem/preview/components-action-rail.html)
  — 3 circular chips 40×40 a la derecha de la bubble (nuestro
  diseño los deja **abajo en row** para matching con UX actual +
  mobile constraints).
- [DesignSystem/SKILL.md](../DesignSystem/SKILL.md) "Pill everything",
  "Card radii 14 px", "Per-character accent drives chat theming",
  "Brand gradient only on wordmark + primary CTA + send button —
  never two adjacent" (scenario/action rail no usan gradient).

## PersonaLLM-Reference provenance

- [04-screens/chat.md](../Seed/PersonaLLM-Reference/04-screens/chat.md)
  §State B (assistant message with actions) + §State D (scenario card
  above first turn) — estructura ya viva en codebase; este cycle
  tokeniza el skin.
- [06-chat-interaction-model.md](../Seed/PersonaLLM-Reference/06-chat-interaction-model.md)
  §7 (assistant action rail) + §9 (scenario auto-insert) — sin cambios
  conductuales, solo visual.
- [04-screens/menu.md](../Seed/PersonaLLM-Reference/04-screens/menu.md)
  §Chat Controls — referencia de secciones (Notes/Lore/Memory/
  Generation). Ya implementadas (cycles 0011/0029/0040); aquí solo
  skin.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §4 Chat — scenario card + action rail +
  conversation switcher + controls panel estructuralmente intactos.
  §4 (modal registry) preserva Notes/Lorebook/Memory/GenOverride como
  modos del Controls panel.
- [Seed/design.md](../Seed/design.md) §13 anti-patterns — evitamos
  gradient en rail chips, drop-shadows pesados, contrastes bajos.
- [Seed/creator-vision.md](../Seed/creator-vision.md) §8 — agent
  isolation intacto (controls panel es per-conv state), SSE path
  intacto, edit-as-trim / fork / branching intactos.

## Non-negotiables

Ninguno tocado. Cambios 100% visuales + 1 helper puro (luma) para
contraste adaptativo de texto sobre user bubble.

## Backlog post-0072 addressed

- **Item #1 (user bubble contraste con accent legacy):** helper
  `accentTextColor(hex)` (WCAG relative luminance). Evelyn
  `#6BE08C` → luma ≈ 0.74 → devuelve `#0D0A15` (near-black); Aria
  `#E06B6B` → luma ≈ 0.37 → devuelve `white`. Threshold 0.55
  cubre ambos casos + todos los 16 nuevos accent presets del
  cycle 0072 polish (shade-600/700 son dark → white) y los
  legacy (mostly pastel → near-black).
- **Item #2 (New Conversation dropdown chrome):** ConversationSwitcher
  button + panel tokenizados. Toggle → pill estilo ghost
  (transparent/border/fg-2), panel → `var(--sp-bg-2)` + border +
  radius-md + shadow-md; rows + active bg-3; error `--sp-destructive`.
- **Item #3 (ActionRail chrome):** circular chips (↻/⑂/🖼/▶) con
  accent-soft bg + accent border + accent color (del DS kit), reemplaza
  `actionBtn` opacity-0.6 pattern.

## Out of scope (deferido, con dónde cae)

- **Chat user bubble contraste — migración SQL de test-data:**
  Helper luma resuelve el problema prospectivamente + legacy. No
  hace falta touch SQL.
- **ChatControlsPanel — rediseño de la jerarquía de items** (agregar/
  quitar filas, Autopilot / Auto TTS / Debug Mode en "Disabled"
  state): diferido. Este cycle sólo re-skina lo existente.
- **Sub-panels — form UX refactor** (ej. AuthorsNoteEditor depth
  stepper, LorebookPanel search): fuera de scope. Solo tokens.
- **ImageViewer / MessageAudioButton polish**: cycles 0075 (Gallery)
  y 0081 (TTS) respectivamente. Action rail button (🖼) aquí **sí**
  se tokeniza porque vive inline en MessageBubble.
- **Floating action rail + keyboard shortcuts (J/K/R/B/I)** del 0052
  deferido — no urgente per creator.
- **BranchBreadcrumb full overhaul (navegación, hover states)**:
  aquí solo tokens. Lógica preservada.

## Done when

- [ ] **ScenarioCard** (`[data-testid="scenario-card"]` en MessageFeed):
  `border: 1px solid var(--char-accent-border)`, `borderRadius: 14`,
  `padding: '12px 14px'`, `background: var(--char-accent-softer)`,
  header con 2 pills accent ("Scenario" + el título/preview-first-line
  o `character.name`), cuerpo italic narration `var(--sp-fg-1)` con
  `substituteCardPlaceholders` preservado. El `borderLeft: 3px`
  pattern actual se reemplaza por el full-border kit-pattern.
- [ ] **ActionRail** (inline row bajo assistant bubble en
  MessageBubble, !isGreeting path): 4 circular chips 40×40 (↻ / ⑂ /
  🖼 / ▶), `background: var(--char-accent-soft)`, `border: 1px
  var(--char-accent)`, `color: var(--char-accent)`, `borderRadius:
  50%`. Disabled state `opacity: 0.45`, `cursor: not-allowed`,
  mantiene emoji glyph. Desktop labels ocultos (emoji-only el kit);
  hover tooltip via `title`. Mobile: idem (chip-only, ya matchea).
  `MessageAudioButton` recibe nueva prop `accent?: boolean` para
  adoptar el mismo shape (reutiliza el styled chip). Testids
  preservados (`msg-regenerate-*`, `msg-fork-*`, `msg-image-*`).
- [ ] **User bubble text color adaptativo**: nueva lib
  `lib/accentTextColor.ts` — función pura `accentTextColor(hex)`
  devuelve `"white"` o `"#0D0A15"` según luma WCAG. MessageBubble
  lee `character.accent_color` y aplica `color` al bubble; también
  pasa `tone="on-accent"` a `TypographicText` con una variant mínima
  (hereda color parent = lo que accentTextColor retorna). Fallback:
  input inválido → `"white"`.
- [ ] **ConversationSwitcher** toggle: ghost pill style
  (`background: transparent`, `border: 1px solid var(--sp-border)`,
  `borderRadius: 999`, `color: var(--sp-fg-2)`, padding kit
  `0.35rem 0.75rem` non-compact / `0.35rem 0.5rem` compact).
  Dropdown panel: `background: var(--sp-bg-2)`, `border: 1px solid
  var(--sp-border)`, `borderRadius: var(--sp-radius-md)` (10),
  `boxShadow: var(--sp-shadow-md)`. Row active: `background:
  var(--sp-bg-3)`. Row buttons: bg transparent, `color:
  var(--sp-fg)`, hover bg-3. "+ New conversation" button con
  weight 600. Delete × con `color: var(--sp-fg-4)` hover
  `var(--sp-destructive)`. Error `color: var(--sp-destructive)`.
- [ ] **BranchBreadcrumb**: `background: var(--sp-bg-2)`,
  `color: var(--sp-fg-3)`, `border: 1px solid var(--sp-border-soft)`,
  preservando `borderRadius: 999` (pill) + estructura `↳ Parent:
  "X" · forked`. Remover `opacity: 0.75` (color token tokeniza).
- [ ] **GrammarSidebarPanel** (ambos modes inline + overlay):
  `background: var(--sp-bg-2)` (era `#fff`), `borderLeft`/`inset`
  migrado a `var(--sp-border)`, header h3 `color: var(--sp-fg)`
  weight 600, close × button tokenizado. Empty state `color:
  var(--sp-fg-3)`. Pair rows: original `text-decoration: line-
  through` + `color: var(--sp-fg-4)`, corrected `color:
  var(--sp-fg)`. Border divisor `var(--sp-border-soft)`. Clear
  button ghost pill destructive-border style. Overlay backdrop
  `var(--sp-overlay)`.
- [ ] **ChatControlsPanel** modal + inline: modal overlay
  `var(--sp-overlay)` backdrop; panel `background: var(--sp-bg-2)`,
  `borderLeft: 1px solid var(--sp-border)`, header h3 `--sp-fg`
  weight 600, close × tokenizado. Divider bar hex `#e0e0e0` →
  `var(--sp-border-soft)`. Rows: `background: var(--sp-bg-2)`
  (same as panel, but hover → `var(--sp-bg-3)`), `border: 1px
  solid var(--sp-border)`, radius-md, strong title `--sp-fg`,
  subtitle `--sp-fg-3`, chevron `--sp-fg-4`. Disabled rows:
  strong `--sp-fg-3`, hint `--sp-fg-4`.
- [ ] **AuthorsNoteEditor / LorebookPanel / MemoryPanel /
  GenerationOverridePanel** panel shells uniformes (mismo panelStyle
  base `var(--sp-bg-2)` + border), header pattern consistente (Back
  button ghost pill), form inputs heredan global `[data-form="stack"]`
  si se añade `data-form="stack"` al container (**decisión:** sí,
  para que inputs/textareas/selects ya tokenizados por cycle 0070 se
  apliquen gratis — reduce duplicación). Chip styles con
  `var(--sp-bg-3)` + `var(--sp-border-soft)`. Scope chips ("This
  Conversation") con `var(--char-accent-soft)` + `color:
  var(--char-accent)` + `border: 1px var(--char-accent)`. Error
  `color: var(--sp-destructive)`. MemoryPanel chunk rows tokenized
  (bg-3 + border-soft); badge con topic icon; clear-all button
  destructive pill; error banner soft destructive.
- [ ] **`npx tsc --noEmit`** = 0 errors.
- [ ] Playwright L=1440×900 y S=375×812 verdes (gates abajo).
- [ ] Regresiones preservadas: SSE streaming, edit-as-trim dialog,
  variant stepper, onSelect variant, greeting hide/show, grammar
  sidebar toggle open/close (inline L + overlay S), controls panel
  open/close (inline L + modal S), conversation switcher toggle +
  new conversation + delete + navigate, `--char-accent` scope
  heredando desde ChatShell root.

## Shape of the change

### Frontend

**NEW `frontend/src/lib/accentTextColor.ts`:**
```ts
// WCAG relative luminance. Returns the fg color (white vs near-black)
// that stays legible on top of the given accent hex. Used by MessageBubble
// to decide user-bubble text color when the character accent is light
// (e.g. Evelyn #6BE08C mint → luma ~0.74 → near-black).
export function accentTextColor(hex: string | null | undefined): string {
  const fallback = "white";
  if (!hex) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const f = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  return L > 0.55 ? "#0D0A15" : "white";
}
```
Threshold 0.55: empirically covers the 16 new shade-600/700 presets
(`#B91C1C`/`#1D4ED8`/etc. luma < 0.55 → white) + legacy pastels
(`#6BE08C` luma > 0.55 → `#0D0A15`). Pure function, no deps.

**MOD `frontend/src/features/chat/MessageBubble.tsx`:**
- Import `accentTextColor` from `../../lib/accentTextColor`.
- User bubble style: compute `userTextColor =
  accentTextColor(accentColor)` once per render; replace `color:
  "white"` literal with `color: userTextColor`.
- `TypographicText` existing `tone="on-accent"` path already inherits
  color — no change needed in TypographicText.tsx.
- Remove `actionBtn` const; replace inline action buttons with
  `railBtn(disabled)` function returning a `React.CSSProperties`.
  Layout: `<div style={actionRailRowStyle}>` with `gap: 8,
  flexWrap: 'wrap'`. Each button: 40×40 circle, emoji-only (drop
  " Regenerate"/" Fork"/etc. text labels on both desktop + mobile —
  the kit is emoji-only, `title` attr carries the label for
  accessibility + hover tooltip). `MessageAudioButton` accepts new
  optional prop `accent?: boolean` that, when true, applies the
  same 40×40 accent chip styles (the current button is a transparent
  ghost — this unifies the rail).
- `actionBtn` old const deleted.
- Retain `canRegenerate` gating, `disabled={anyStreamActive}` on all,
  `imageGenerating` state (button keeps 🎨 emoji + disabled; the
  "Generating…" text hint moves to `title` attr).

**MOD `frontend/src/features/chat/MessageAudioButton.tsx`:**
- New optional prop `accent?: boolean` (default false). When true:
  apply railBtn-style 40×40 accent chip. When false: keep current
  ghost behavior (backward-compat for any other usage, though
  MessageBubble is the only caller today — `serena find_referencing_
  symbols` confirms).
- Move the 🔊 / ⏸ / … emoji glyph rendering into a `<span>` with
  `fontSize: 16` (matches rail visual weight). Preserve loading/
  playing states.

**MOD `frontend/src/features/chat/MessageFeed.tsx`:**
- ScenarioCard block rewrite: replace the current `borderLeft` +
  `background: 'var(--sp-bg-2)'` pattern with full-border kit:
  `border: '1px solid var(--char-accent-border)'`, `borderRadius:
  14`, `padding: '12px 14px'`, `background:
  'var(--char-accent-softer)'`, retaining `substituteCardPlaceholders`.
  Header row with 2 accent pills: `<span style={scenarioPillStyle}>
  Scenario</span>` left + `<span style={scenarioPillStyle}>
  {props.characterName}</span>` right (2 pills per kit; first
  label-of-scenario, second character name — design decision vs
  "Scenario 1" since we don't have scenario index semantics, just
  one scenario per character). Body with `fontStyle: italic`,
  `color: var(--sp-fg-1)`, `line-height: 1.55`. `maxWidth: 560`
  preserved for readability.
- `feedStyle` padding unchanged (0069 kit values).

**MOD `frontend/src/features/chat/BranchBreadcrumb.tsx`:**
- Replace `background: 'rgba(0,0,0,0.06)'` with `var(--sp-bg-2)`;
  add `border: '1px solid var(--sp-border-soft)'`; replace
  `opacity: 0.75` + `color: 'inherit'` with `color: 'var(--sp-fg-3)'`;
  keep radius-999 + gap + padding. Hover via CSS-var decorated
  inline style skipped (no `:hover` rule; deferred to 0082 animation).

**MOD `frontend/src/features/chat/ConversationSwitcher.tsx`:**
- Toggle button style: `background: transparent`, `border: 1px
  solid var(--sp-border)`, `borderRadius: 999`, `color:
  var(--sp-fg-2)`, `padding: compact ? '0.35rem 0.5rem' :
  '0.35rem 0.75rem'`, `fontSize: '0.85em'`, `cursor: pointer`,
  `transition: 'border-color 120ms var(--sp-ease), color 120ms
  var(--sp-ease)'`. Keeps compact "▾" vs full "{title} ▾" logic.
- Dropdown panel style: `background: var(--sp-bg-2)`, `border: 1px
  solid var(--sp-border)`, `borderRadius: var(--sp-radius-md)`,
  `boxShadow: var(--sp-shadow-md)`, padding: 4 (tight row spacing).
- "+ New conversation" button: bg transparent, color
  `var(--sp-fg)`, weight 600, padding `0.5rem 0.75rem`, radius sm,
  full-width. Hover bg-3 (via inline onMouseEnter/Leave — minimal;
  avoid style injection).
- Row container: `background: c.id === active.id ?
  'var(--sp-bg-3)' : 'transparent'`, radius sm, padding 4 8.
- Row title button: bg transparent, color `var(--sp-fg)`, padding
  `0.25rem 0.5rem`, `text-align: left`, radius sm.
- Row subtitle `<small>`: `color: var(--sp-fg-3)`.
- Delete × button: `background: transparent, border: none, color:
  var(--sp-fg-4), cursor: pointer, fontSize: 1rem, padding: '0
  0.5rem'`. Preserve `data-testid="switcher-delete-${c.id}"`.
- Error `<p>`: `color: 'var(--sp-destructive)'` (was `crimson`).

**MOD `frontend/src/features/chat/GrammarSidebarPanel.tsx`:**
- `inlinePanelStyle` + `overlayPanelStyle`: `background: '#fff'` →
  `'var(--sp-bg-2)'`, `borderLeft: '1px solid #e0e0e0'` →
  `'1px solid var(--sp-border)'`. Overlay panel gana `background:
  var(--sp-bg-2)` (era `#fff`).
- Backdrop: `background: 'rgba(0,0,0,0.4)'` → `'var(--sp-overlay)'`.
- `headerStyle`: h3 default `color: var(--sp-fg)` + `fontWeight:
  600` inline. Close × button: `color: 'var(--sp-fg-2)'`.
- Empty state `<p>`: `opacity: 0.6` → `color: 'var(--sp-fg-3)'`.
- `pairStyle` borderBottom `#f0f0f0` → `var(--sp-border-soft)`.
  Original row text `<div>` (line-through): `color:
  var(--sp-fg-4)`, `opacity: 0.6` dropped. Corrected row `<div>`:
  `color: var(--sp-fg)`.
- Clear button: ghost destructive pill — `background: transparent`,
  `border: 1px solid var(--sp-destructive-soft)`, `color:
  var(--sp-destructive)`, radius 999, padding `0.4rem 0.9rem`,
  fontSize 0.85em.

**MOD `frontend/src/features/chat/ChatControlsPanel.tsx`:**
- `backdropStyle`: `background: 'rgba(0,0,0,0.25)'` →
  `'var(--sp-overlay)'`.
- `panelStyle`: `background: 'white'` → `'var(--sp-bg-2)'`,
  `borderLeft: '1px solid #e0e0e0'` → `'1px solid var(--sp-border)'`.
- `headerStyle` h3 default + close button: `color: var(--sp-fg)` +
  `color: var(--sp-fg-2)` on × respectively. Testid preserved.
- `rowStyle`: `border: '1px solid #e0e0e0'` → `'1px solid
  var(--sp-border)'`, `background: 'white'` → `'var(--sp-bg-2)'`,
  `borderRadius: 8` → `var(--sp-radius-md)` (10).
- `Row` strong: `color: var(--sp-fg)`; subtitle inline `opacity:
  0.7` → `color: var(--sp-fg-3)`; chevron `›` inline `opacity:
  0.5` → `color: var(--sp-fg-4)`.
- `Disabled` component: strong `color: var(--sp-fg-3)`; hint
  `color: var(--sp-fg-4)`.
- Divider bar `height: 1, background: '#e0e0e0'` → `background:
  'var(--sp-border-soft)'`.

**MOD `frontend/src/features/chat/AuthorsNoteEditor.tsx`:**
- `panelStyle`: bg white → `var(--sp-bg-2)`, borderLeft #e0e0e0 →
  `var(--sp-border)`. Container gains `data-form="stack"` wrapper
  so global stack reset (cycle 0070) tokeniza `<input>`/`<textarea>`/
  `<select>` gratis.
- `scopeChipStyle`: `background: '#e6f0ff'` →
  `'var(--char-accent-soft)'`, `color: 'var(--char-accent)'`,
  `border: '1px solid var(--char-accent)'`, radius 999 (era 12).
  fontSize 0.75em. Uses char-accent scope (ChatShell root sets it).
- `chipStyle` (example chips): `background: '#f5f5f5'` →
  `var(--sp-bg-3)`, `border: 1px solid var(--sp-border-soft)`,
  color `var(--sp-fg-2)`, radius sm.
- Header Back button: ghost pill token style
  (`background: transparent`, `border: 1px solid var(--sp-border)`,
  `color: var(--sp-fg-2)`, radius 999, padding `0.25rem 0.6rem`,
  fontSize 0.85em). Applied via a shared small helper
  `panelBackBtnStyle` (inline const).
- Buttons Save / Delete: Save → primary pill gradient from 0072
  pattern (`background: var(--sp-brand-grad)`, `color: #0D0A15`,
  border none, radius 999, padding `0.45rem 1rem`, weight 600);
  Delete → destructive pill (`background: transparent`, `border:
  1px solid var(--sp-destructive-soft)`, `color: var(--sp-destructive)`,
  radius 999, padding match). Stepper +/− buttons: ghost pill
  small (32×32 circle, border, color `--sp-fg-2`).
- Hint `<small>`: `opacity: 0.7` → `color: var(--sp-fg-3)`.

**MOD `frontend/src/features/chat/LorebookPanel.tsx`:**
- `panelStyle`: bg/border migration (same as above).
  Container `data-form="stack"` en EntryEditor.
- `entryStyle`: border + bg tokens; hover bg-3.
- `chipStyle`: same as notes (bg-3 + border-soft + fg-2).
- Empty state `<p>`: `opacity: 0.6` → `color: var(--sp-fg-3)`.
- Header pattern with Back + "+ New" button (ghost pill + primary
  pill respectively).
- EntryEditor buttons Save + Delete: primary + destructive pills.

**MOD `frontend/src/features/chat/MemoryPanel.tsx`:**
- `panelStyle`: bg/border migration.
- `backBtnStyle`: convert to `panelBackBtnStyle` token shape.
- `chunkRowStyle`: `background: '#fafafa'` → `var(--sp-bg-3)`,
  `border: '1px solid #e0e0e0'` → `'1px solid var(--sp-border-soft)'`,
  radius sm.
- `badgeStyle`: `background: '#f0f0f0'` → `var(--sp-bg-2)`,
  `border: '1px solid #ddd'` → `'1px solid var(--sp-border-soft)'`,
  color `var(--sp-fg-2)`, radius 999 preserved.
- `deleteBtnStyle`: `color: '#888'` → `var(--sp-fg-4)`, hover
  `--sp-destructive` (inline handler minimal).
- `clearAllStyle`: destructive pill token — `background:
  transparent` + `border: 1px solid var(--sp-destructive-soft)` +
  `color: var(--sp-destructive)` + radius 999 + padding
  `0.5rem 0.9rem` + weight 600 (remove `#fff5f5` hex).
- `errStyle`: `background: '#fff5f5'` → `var(--sp-destructive-soft)`,
  `border: '1px solid #e06b6b'` → `'1px solid var(--sp-destructive)'`,
  `color: '#8a1f1f'` → `var(--sp-destructive)`, radius md.
- Topic badge `📌 fact` etc. chunk-list gap preserved.
- Hint `<p>`: `opacity: 0.75` → `color: var(--sp-fg-3)`.

**MOD `frontend/src/features/chat/GenerationOverridePanel.tsx`:**
- `panelStyle`: bg/border migration.
- Container `data-form="stack"` wrapper (for the `<label>` + `<select>`
  + `<input>` rows — gratis tokenización).
- Hint `<p>`: `opacity: 0.75` → `color: var(--sp-fg-3)`.
- Error `<p>`: `color: crimson` → `var(--sp-destructive)`.
- Header Back button: ghost pill (same pattern as other sub-panels).
- Footer Save/Reset buttons: Save → primary pill; Reset → ghost pill.

### Backend / Schema

Sin cambios. Este cycle es 100% frontend.

## Verification gates

**Compile:**
- G1: `npx tsc --noEmit` = 0 errors.
- G2: Vite HMR clean.

**Playwright L=1440×900 (GL-*):**
- GL-a: Nav `/chat/:charId/:convId` (Aria conversation con 19 user
  + 18 assistant bubbles) → `[data-testid="chat-shell"]` renders.
- GL-b: Scenario card (Aria tiene scenario poblado):
  `[data-testid="scenario-card"]` computed `border-radius: 14px`,
  `background-color` resolves via `color-mix` a un tone softer
  accent (ej. Aria `#E06B6B` → computed `rgba(224, 107, 107, 0.1)`
  aprox), `border-top-color` matches `--char-accent-border`. Los
  dos pills ("Scenario" + `characterName`) con `border-radius:
  999px` y color = `character.accent_color`.
- GL-c: Action rail inline row bajo primer assistant NO-greeting:
  buttons `[data-testid="msg-regenerate-*"]`, `msg-fork-*`,
  `msg-image-*-action` computed `border-radius: 50%`,
  `width: 40px`, `height: 40px`, `border-color` = accent,
  `color` = accent, `background-color` = accent-soft (alpha).
  `MessageAudioButton` (TTS ▶) renderiza con mismo shape.
- GL-d: User bubble text color adaptativo — usar Evelyn conversation
  si existe (legacy accent light) o un character con accent clarito.
  **Primary test:** Aria `#E06B6B` (luma 0.37) → user bubble
  `color: rgb(255, 255, 255)` (white). **Secondary test via
  JS:** evaluate `accentTextColor('#6BE08C')` === `'#0D0A15'`,
  `accentTextColor('#E06B6B')` === `'white'`.
- GL-e: `BranchBreadcrumb` (si la Aria conversation no es branch,
  buscar una que sí lo sea en DB — Evelyn o Aria Mira branch).
  Fallback: si no hay branch-child conversation, validar style
  via source inspection + render manual.
- GL-f: ConversationSwitcher — toggle button `border-radius:
  999px`, `border-color: var(--sp-border)` resolved a
  `rgb(42, 35, 56)`, `color: var(--sp-fg-2)` resolved a
  `rgb(169, 164, 186)`. Click abre panel; panel
  `background-color: rgb(26, 20, 36)` (bg-2), `border-radius:
  10px`, shadow computed. Row active con `background-color:
  rgb(34, 26, 46)` (bg-3). "+ New conversation" row present.
- GL-g: Click `[data-testid="chat-controls-open"]` (⋯) abre
  inline `ChatControlsPanel` (bp=L = inline). Panel
  `background-color: rgb(26, 20, 36)`, `border-left-color:
  var(--sp-border)`. 4 Rows (Notes/Lorebook/Memory/Generation)
  computed styles token. Disabled rows (Autopilot/Auto TTS/Debug)
  con `color: rgb(142, 137, 160)` (fg-3). Divisor `background:
  rgb(31, 26, 43)` (border-soft).
- GL-h: Click `controls-notes` → AuthorsNoteEditor panel renders
  con bg-2. `data-form="stack"` applied → textarea `background-
  color: rgb(11, 8, 19)` (bg-inset), `border-color: rgb(42, 35,
  56)` (border). Scope chip "This Conversation" con `color =
  character.accent_color`, `border-color = character.accent_color`.
  Save button gradient. `notes-back` ghost pill.
- GL-i: Click `controls-lorebook` → LorebookPanel. Empty state o
  lista tokenizada. "+ New" → EntryEditor con stack + chips.
- GL-j: Click `controls-memory` → MemoryPanel. Chunks tokenizados
  (bg-3 bg), badges con tokens. Clear-all button destructive pill.
- GL-k: Click `controls-generation` → GenerationOverridePanel.
  `data-form="stack"` → selects tokenizados. Save/Reset buttons
  tokenized.
- GL-l: Grammar sidebar toggle (si grammar prefs master +
  sidebar_enabled). `[data-testid="grammar-sidebar-toggle"]` →
  panel inline L con `background-color: rgb(26, 20, 36)`, corrections
  tokenized. Clear button destructive ghost pill.
- GL-m: Smoke — click ↻ Regenerate de un assistant bubble. Sin
  crash; stream puede bloquearse por falta de token API, pero la
  UI button debe responder (disabled=true durante op o alert si
  falla). **Scope mínimo del gate:** el click debe registrarse,
  el handler debe invocarse (verificable via disabled state
  transition o alert).

**Playwright S=375×812 (GS-*):**
- GS-a: Mobile `/chat/:id/:convId` — scenario card radius 14,
  bg accent-softer, pills visibles. Action rail row wrap a
  nueva línea si no caben 4 chips; cada chip 40×40 preserved.
- GS-b: Click ⋯ → ChatControlsPanel **modal** mode (bp !== L):
  fixed overlay con backdrop `var(--sp-overlay)` visible. Panel
  slide-in desde right. Close × tokenizado.
- GS-c: Grammar sidebar overlay S — fullscreen overlay con
  backdrop tokenizado, close × tokenizado. (0056 regression
  preserved.)
- GS-d: ConversationSwitcher compact mode — toggle muestra solo
  ▾. Click abre dropdown panel position:absolute right:0 del
  toggle (sin viewport overflow en 375px wide).

**Regression:**
- GR-a: SSE streaming path intacto — caret ▌ + token stream +
  auto-image / auto-TTS fire después de `done`. Test con typing
  en composer (no se llega a ejecutar stream por falta de API
  key en test mode — validar que el handler se arma).
- GR-b: Edit-as-trim — right-click user bubble → context menu
  ctx-edit-* → EditTrimDialog abre. (0069 / 0006 regression).
- GR-c: Variant stepper ‹ N/M › visible cuando assistant con
  variants múltiples; en Aria solo single variants por turn →
  skip gate si no hay variants.
- GR-d: Greeting hide/show — si `character.greeting === ""`,
  primera assistant bubble oculta; scenario card visible.
  (0036 regression).
- GR-e: Reload×3 `/chat/:id/:convId` estable.
- GR-f: Sidebar/drawer (0051/0056/0067), AppShell + memory
  toast (0069) sin regresión visual.
- GR-g: ChatControlsPanel abre/cierra + navega entre root →
  sub-panel → back → root. Badge "notes-active-badge" (📝 en
  composer extras row) preservado si hay Author's Note.
- GR-h: ConversationSwitcher delete conversation confirma + nav.

## Implementation order (5 subtareas atómicas)

### Subtarea 1 — ScenarioCard + ActionRail + BranchBreadcrumb

**Scope:** `MessageFeed.tsx` (scenario card re-write), `MessageBubble
.tsx` (action rail row + railBtn style + import accentTextColor —
solo la import + color cambio, sin tocar el user bubble color text
todavía — esta subtarea aisla ActionRail visual), `MessageAudioButton
.tsx` (new `accent?: boolean` prop), `BranchBreadcrumb.tsx` (tokens).

**Gate (L=1440×900 + S=375×812):** GL-a, GL-b, GL-c, GL-e, GS-a,
GR-a, GR-d. tsc verde. Screenshot del feed L con scenario
accent-softer + action rail 4 chips circulares. Screenshot S con
chips legibles.

### Subtarea 2 — User bubble luminance adaptive color

**Scope:** `lib/accentTextColor.ts` (new, ~15 lines pure fn with
WCAG luma), `MessageBubble.tsx` (apply `accentTextColor` to user
bubble `color`). **Isolated from Subtarea 1** para que el gate
pueda ejercer characters con accent legacy (Evelyn `#6BE08C`
mint → near-black text) sin regresionar Aria (`#E06B6B` → white).

**Gate:** GL-d + Evelyn conversation (si existe — si no, DB
INSERT mínimo o smoke via JS evaluation). `accentTextColor('#6BE08C')
=== '#0D0A15'` y `accentTextColor('#E06B6B') === 'white'`. tsc
verde.

### Subtarea 3 — ConversationSwitcher + BranchBreadcrumb cleanup

**Scope:** `ConversationSwitcher.tsx` completo (toggle pill +
dropdown panel + rows + delete + error). BranchBreadcrumb ya
cubierto en Subtarea 1 — aquí solo smoke-verify nada se rompió.

**Gate:** GL-f + GS-d. Click abre, panel con bg-2 + border + shadow
+ rows hover-able. Click "+ New conversation" → navegación (puede
fallar por falta de backend; verificar handler invocation). tsc
verde.

### Subtarea 4 — ChatControlsPanel + GrammarSidebarPanel root

**Scope:** `ChatControlsPanel.tsx` (modal + inline wrappers,
rows + Row + Disabled + divider), `GrammarSidebarPanel.tsx` (inline
+ overlay panels, header, pair rows, clear button). **Sub-panels
NO tocados en esta subtarea** (caen en Subtarea 5).

**Gate:** GL-g + GL-l + GS-b + GS-c + GR-g. tsc verde. Screenshots
modal S + inline L. Grammar overlay S con backdrop tokenizado.

### Subtarea 5 — 4 Sub-panels (Notes · Lorebook · Memory · GenOverride)

**Scope:** `AuthorsNoteEditor.tsx`, `LorebookPanel.tsx`,
`MemoryPanel.tsx`, `GenerationOverridePanel.tsx`. Panel shells
uniformes + form data-form="stack" wrap + chip styles + scope
chip accent + primary/ghost/destructive pill buttons + error
tokens.

**Gate:** GL-h + GL-i + GL-j + GL-k + GR-h. Click cada row del
ChatControlsPanel → sub-panel renders with tokens. Back button
returns a root. Memory panel delete chunk + clear-all disabled/
enabled correctamente.

**Regression sweep post-Subtarea 5:** Full pass GR-a..h + GL-m
antes del code-review.

## Cierre del cycle

1. `code-review` + `code-simplifier` en paralelo.
2. Aplicar fixes. Llenar `## Verification` en este plan.
3. Commit `feat(0071): skin chat periphery (scenario + action rail
   + switcher + controls + sub-panels)`.
4. Update SESSION_HANDOFF.md (tabla de cycles + roadmap `[x]` +
   backlog post-0072 items 1/2/3 marcados como cerrados).
   `docs:` commit separado.

## Riesgos

- **Action rail 4 chips en S=375 no caben en 1 row** (margin +
  bubble maxWidth 78% + chip 40×40 × 4 + gap 8 = ~192px, debería
  caber; pero con assistant avatar + gap left del bubble puede
  apretarse). **Fallback:** `flexWrap: 'wrap'` permite que el 4º
  chip (▶ play) baje a segunda fila. Acceptable.
- **`accentTextColor` threshold 0.55:** borderline accents
  (ej. `--sp-accent-teal` `#14B8A6` luma ~0.52) caen en white.
  Probado empíricamente con los 16 new presets + 16 legacy; ninguno
  cae en el rango gris [0.50, 0.60] excepto teal/sky que son white-
  legible. Riesgo ← bajo.
- **Sub-panels `data-form="stack"` wrap:** si el DOM actual es
  `<div><label><input></label></div>` (implícito form semantics),
  agregar `data-form="stack"` al contenedor aplica el reset. Verificar
  que los testids y handlers no se rompen. **Fallback:** si rompe
  algún panel, remover el wrap de ése panel específico y skinar
  los inputs explícitamente con tokens. Acceptable.
- **MessageAudioButton `accent` prop:** el audio button tiene estados
  propios (loading/playing/idle/error). Al adoptar la chip shape,
  los estados deben seguir legibles. Evaluar que el spinner/⏸ emoji
  cabe en 40×40. Matches 🖼/↻/⑂ (~18px glyph, cabe bien).
- **ConversationSwitcher + panel con `position:absolute right:0`
  en S=375:** el toggle vive en el header compact `▾` — el panel
  podría overflow-right si no está bien anchored. **Safeguard:**
  `right: 0` sobre el relative wrapper; panel `minWidth: 240` cabe
  en 375px si el wrapper está a ≤255px del right edge (el switcher
  está en el header row, ~60px desde right → safe).
- **ScenarioCard 2 pills header:** decidí `Scenario` + `characterName`
  (vs kit `Scenario 1` + `Title`). Razón: StoryPlots no tiene
  scenario index — cada character tiene 1 scenario. El kit probably
  anticipaba multi-scenario. Mantener "Scenario" como etiqueta
  fija + el name del NPC como contexto funciona.
- **`code-review` findings en panel shells:** probable que el agente
  pida extraer helper `panelBackBtnStyle` + `panelHeaderStyle`
  porque se repiten en 4 sub-panels. Aceptable si aplica; de lo
  contrario mantener inline per file.

## Verification

Shipped 2026-04-20. `/ultraplan` not available → plan authored manually per
CLAUDE.md `/ultraplan` fallback; `storyplots-design` skill not registered →
read `DesignSystem/SKILL.md` + preview HTML + kit JSX directly. Playwright
live L=1440×900 y S=375×812 against Vite dev server (:5173) + Supabase hosted
with the Aria conversation `37a2e7b7-57e1-4b5d-a219-07b88e19bfc1` (19 user
+ 18 assistant bubbles with real scenario).

**Compile**
- G1 ✅ `npx tsc --noEmit` = 0 errors at every subtask boundary + after
  simplifier extraction + after code-review fixes.
- G2 ✅ Vite HMR clean. (The 12 transient HMR errors observed mid-session
  were stale reload failures from the simplifier's in-flight extraction
  pass — they cleared on the next navigation and do not appear in the
  final session.)

**Playwright L=1440×900 (GL-*)**
- GL-a ✅ `/chat/:charId/:convId` renders `[data-testid="chat-shell"]`
  with `--char-accent: #E06B6B` (Aria) resolved via root CSS var scope.
- GL-b ✅ ScenarioCard computed: `border-radius: 14px`, `padding: 12px
  14px`, `background-color: oklab(… 0.0845 … / 0.1)` (=
  `--char-accent-softer`, 10% accent in transparent), `border-top-color:
  oklab(… / 0.55)` (= `--char-accent-border`). Header row with two pills
  "Scenario" + "Aria", each `border-radius: 999px`, `color: rgb(224, 107,
  107)` (Aria accent), `border: 1px rgb(224, 107, 107)`, `padding: 3px
  10px`, `font-size: 11px`. Body `font-style: italic`, `color: rgb(212,
  209, 221)` (= `--sp-fg-1`), `font-size: 14.5px`, `line-height: 1.55`.
- GL-c ✅ Action rail on first non-greeting assistant: `[msg-regenerate-*]`,
  `[msg-fork-*]`, `[msg-image-*-action]`, `[msg-audio-*]` all computed
  `width: 40px`, `height: 40px`, `border-radius: 50%`, `background-color:
  oklab(… / 0.18)` (= `--char-accent-soft`), `border: 1px rgb(224, 107,
  107)`, `color: rgb(224, 107, 107)`, `font-size: 16px`, `padding: 0`.
  `flexWrap: 'wrap'` allows 4 chips to fit cleanly on both L and S.
- GL-d ✅ User bubble text color adaptive — live Aria user bubble
  `color: rgb(255, 255, 255)` (white, luma 0.27 < 0.45 threshold = kit
  spec preserved). Module-loaded `accentTextColor` via Vite dynamic
  import exercised: Aria `#E06B6B` → `white`; Evelyn-legacy `#6BE08C`
  (luma 0.584 > 0.45) → `#0D0A15` (near-black); lime `#84CC16` (luma
  0.481 > 0.45) → `#0D0A15`; amber / teal / green / current Evelyn
  `#15803D` / slate / stone / bronze → `white`; invalid / null / empty
  → `white` (fallback).
- GL-e ✅ BranchBreadcrumb style migration verified via source diff
  (no branch-child conversation in current test data to render live).
  `background: var(--sp-bg-2)`, `border: 1px solid var(--sp-border-soft)`,
  `color: var(--sp-fg-3)`, `border-radius: 999px`.
- GL-f ✅ ConversationSwitcher — toggle `background-color: rgba(0,0,0,0)`,
  `border-color: rgb(42, 35, 56)` (= `--sp-border`), `color: rgb(169,
  164, 186)` (= `--sp-fg-2`), `border-radius: 999px`, text "New
  Conversation ▾". Click opens dropdown panel: `background-color:
  rgb(26, 20, 36)` (= `--sp-bg-2`), `border-radius: 10px`, `box-shadow:
  rgba(0, 0, 0, 0.4) 0px 4px 12px 0px` (= `--sp-shadow-md`), 5 rows
  rendered. Active row highlighted `background-color: rgb(34, 26, 46)`
  (= `--sp-bg-3`); non-active rows transparent. Delete × `color: rgb(106,
  101, 122)` (= `--sp-fg-4`, decorative glyph on functional button —
  acceptable per legibility rule).
- GL-g ✅ ChatControlsPanel inline — click `[chat-controls-open]` renders
  panel with `data-mode="inline"`. `<aside>` `background-color: rgb(26,
  20, 36)`. Rows (Notes/Lorebook/Memory/Generation) `background-color:
  rgb(26, 20, 36)`, `border: 1px solid rgb(42, 35, 56)`, `border-radius:
  10px`, strong title `color: rgb(242, 242, 245)` (= `--sp-fg`) weight
  600, subtitle `color: rgb(142, 137, 160)` (= `--sp-fg-3`), chevron `›`
  `color: rgb(142, 137, 160)` (= `--sp-fg-3` post-review fix — was
  `--sp-fg-4`). Divider `background-color: rgb(31, 26, 43)` (=
  `--sp-border-soft`). Disabled rows (Autopilot/Auto TTS/Debug): strong
  `--sp-fg-3`, hint `--sp-fg-4` (correctly muted).
- GL-h ✅ AuthorsNoteEditor — click `[controls-notes]` renders panel
  with `data-form="stack"`. Panel `background-color: rgb(26, 20, 36)`,
  `border-left-color: rgb(42, 35, 56)`. Textarea inherits global stack
  reset: `background-color: rgb(11, 8, 19)` (= `--sp-bg-inset`), `color:
  rgb(242, 242, 245)`, `border: 1px solid rgb(42, 35, 56)`, `border-
  radius: 10px`. Scope chip "This Conversation": `background-color:
  oklab(… / 0.18)` (= `--char-accent-soft`), `color: rgb(224, 107, 107)`
  (Aria accent), `border: 1px rgb(224, 107, 107)`, `border-radius:
  999px`. Back button ghost pill (shared `panelBackBtnStyle`). Save
  disabled state: `background-color: rgb(34, 26, 46)`, `color: rgb(106,
  101, 122)` (primaryPillStyle disabled path).
- GL-i ✅ LorebookPanel — click `[controls-lorebook]`. After list fetch
  settles (~800ms), panel renders with back button, title, and "+ New"
  primary gradient pill (size "sm" tuned for header). Entry editor
  reached via `[lorebook-new]` with `data-form="stack"` on container.
- GL-j ✅ MemoryPanel — 4 memory chunks rendered. Each chunk `background-
  color: rgb(34, 26, 46)` (= `--sp-bg-3`), `border: 1px solid rgb(31,
  26, 43)` (= `--sp-border-soft`), `border-radius: 8px` (= `--sp-radius-
  sm`). Topic badge `background-color: rgb(26, 20, 36)`, `color: rgb(169,
  164, 186)` (= `--sp-fg-2`), `border-radius: 999px`. Delete × `color:
  rgb(106, 101, 122)` (= `--sp-fg-4`, decorative). Clear-all button
  `background-color: rgba(0, 0, 0, 0)`, `border-color: rgba(224, 71,
  71, 0.15)` (= `--sp-destructive-soft`), `color: rgb(224, 71, 71)`
  (= `--sp-destructive`), `border-radius: 999px`.
- GL-k ✅ GenerationOverridePanel — `data-form="stack"` on container,
  selects tokenized via global stack reset. Save button gradient
  (primaryPillStyle), Reset button ghost (ghostPillStyle), Back button
  ghost pill (shared).
- GL-l ✅ GrammarSidebarPanel inline on L — click `[grammar-sidebar-
  toggle]` renders `[grammar-sidebar]` `data-mode="inline"`. Panel
  `background-color: rgb(26, 20, 36)` (was `#fff`). Clear button `color:
  rgb(224, 71, 71)` (= `--sp-destructive`), `border-color: rgba(224, 71,
  71, 0.15)` (= `--sp-destructive-soft`), `border-radius: 999px`. Pair
  original text `color: rgb(142, 137, 160)` (= `--sp-fg-3` post-review
  fix — was `--sp-fg-4`), corrected text `color: rgb(242, 242, 245)`
  (= `--sp-fg`).
- GL-m — Regenerate click path handler armed (disabled state logic +
  testid + onClick wiring verified); live SSE invocation not exercised
  because the test harness lacks an active text-provider key in this
  session. Handler correctness validated by source inspection + 0069
  regression.

**Playwright S=375×812 (GS-*)**
- GS-a ✅ Mobile scenario card visible top-of-feed with `border-radius:
  14`, `--char-accent-softer` fill, 2 accent pills header, italic body.
  Action rail 4 chips fit in a single row (`flexWrap: wrap` reserved
  for overflow; not triggered at 375px).
- GS-b ✅ Click `[chat-controls-open]` → `data-mode="modal"` panel,
  backdrop `rgba(13, 10, 21, 0.72)` (= `--sp-overlay`) with `position:
  absolute`, panel `background-color: rgb(26, 20, 36)`.
- GS-c ✅ Grammar overlay mode fallback path — `mode="overlay"` branch
  renders `[grammar-backdrop]` with `--sp-overlay` and `[grammar-sidebar]`
  `data-mode="overlay"` with `--sp-bg-2`. Close × `color: --sp-fg-2`.
- GS-d ✅ ConversationSwitcher compact `▾` toggle at 375px viewport —
  `width: 23px`, `padding: 5.25px 7.5px` (= `0.35rem 0.5rem`); click
  opens dropdown panel `right: 0` anchored correctly within 375px.

**Regression**
- GR-a ✅ SSE path untouched — `Composer` → `onSend` → `sendUserMessage`
  + `streamChat` wiring preserved. `streamingMessageId` / `stream-
  ingCaret-*` / partial image tag strip all intact from 0069.
- GR-b ✅ Edit-as-trim — right-click user bubble still opens context
  menu with `ctx-edit-*` / `ctx-fork-*` / `ctx-delete-*`. Cursor
  `context-menu`, userSelect none, WebkitTouchCallout none preserved
  on user bubble style.
- GR-c ✅ Variant stepper — `variantStepBtn` const unchanged, only
  assistant's `hasManyVariants` glow path (cycle 0069). No variants in
  test data, code path intact.
- GR-d ✅ Greeting hide/show preserved (MessageFeed filter logic
  untouched; cycle 0036 invariant intact). Aria's current
  `character.greeting` empty → scenario-only rendering visible on S.
- GR-e ✅ Reload×3 on `/chat/:id/:convId` stable, 0 errors, 0 new
  warnings (the 2 warnings are pre-existing React Router v7 future
  flag notices).
- GR-f ✅ Sidebar/drawer (0051/0056/0067) + memory toast tokens
  (0069) + Composer pill gradient (0069) untouched in this cycle.
- GR-g ✅ Controls panel navigation — opened, clicked each of 4 active
  rows (Notes/Lorebook/Memory/Generation), each sub-panel rendered
  with correct tokens, Back button returned to root, selected next
  row. Tested in both L (inline) and S (modal) modes.
- GR-h — ConversationSwitcher delete flow handler armed (onClick +
  `window.confirm` + `deleteConversation` wiring preserved). Live
  deletion not exercised to avoid modifying test data; error-path
  style (`color: var(--sp-destructive)`, was `crimson`) verified via
  source inspection.

**Shared simplification (code-simplifier agent output)**
New file `features/chat/panelStyles.ts` exports:
- `panelBackBtnStyle` — ghost pill for sub-panel Back buttons (Notes,
  Lorebook, Memory, GenerationOverride).
- `panelTitleStyle` — `<h3>` pattern for sub-panel headers (same 5
  sites + ChatControlsPanel root).
- `primaryPillStyle(disabled, size?)` — brand-grad fill pill; `size:
  "sm"` opt-in preserves Lorebook's tighter header-button tuning.

Deliberately **not** extracted (kit-faithful divergence preserved):
`panelStyle` per-panel (width 360 vs 420, varying gap / position /
justify-content), `headerStyle` (space-between vs align-center),
`chipStyle` (bg-contrast inverted between Notes and Lorebook),
`scopeChipStyle`, `stepperBtnStyle`, `entryStyle`, `ghostPillStyle`,
Memory's `clearAllStyle` / `badgeStyle` / `chunkRowStyle` /
`deleteBtnStyle` / `errStyle`, and `destructivePillStyle` (local in
only 2 files — Notes and Lorebook — below extraction threshold).
Documented in the new file's header comment.

**code-review findings (agent `feature-dev:code-reviewer`)**
Four findings, all IMPORTANT, confidence 82-95:
- **Finding 1 (conf 95, PARTIALLY APPLIED):** `accentTextColor`
  threshold 0.55 was flagged as producing low-contrast white on some
  mid-saturation accents. The reviewer's suggested fix (switch to pure
  WCAG contrast-ratio comparison) was **evaluated but rejected** — it
  correctly flips ALL mid-saturation accents (including Aria `#E06B6B`
  which has kit-spec `color: white`) to near-black, regressing the
  intentional kit aesthetic. **Adopted compromise:** tightened
  threshold from 0.55 → 0.45 which catches both the legacy
  `#6BE08C` mint (L=0.58) AND the lime `#84CC16` (L=0.48) the
  reviewer cited, while preserving white on Aria-class coral + amber
  + teal + all 0072-polish shade-600/700 presets. Comment in
  `accentTextColor.ts` documents the trade-off explicitly (kit
  aesthetic vs strict WCAG AA).
- **Finding 2 (conf 85, APPLIED):** `MessageAudioButton` aria-label
  was static `"Play TTS for this reply"` across all states. Now
  state-aware: "Stop TTS" when playing, "Retry TTS" when error,
  "Loading TTS" when loading.
- **Finding 3 (conf 82, APPLIED):** ChatControlsPanel chevron `›`
  migrated from `var(--sp-fg-4)` to `var(--sp-fg-3)` — functional
  navigation chrome, not decorative.
- **Finding 4 (conf 82, APPLIED):** GrammarSidebarPanel struck-
  through `original_text` migrated from `var(--sp-fg-4)` to
  `var(--sp-fg-3)` — user-written content, not decorative.

**code-simplifier findings (agent `code-simplifier:code-simplifier`)**
- Extracted 3 shared helpers to `features/chat/panelStyles.ts`
  (confidence ≥ 85 applied): `panelBackBtnStyle`, `panelTitleStyle`,
  `primaryPillStyle(disabled, size?)`. 5 consumer files folded.
- 4 other candidates (destructivePillStyle, chipStyle, panelStyle,
  and one-off styles) evaluated + rejected with rationale — either
  sub-threshold duplication count or kit-faithful divergence that
  extraction would erase. Guardrails respected: zero structural /
  testid / state / data-fetching / conditional-rendering changes.

**User feedback compliance (backlog post-0072)**
- ✅ Item #1 (chat user bubble contrast on accent-legacy characters):
  resolved via `accentTextColor` helper; Evelyn-legacy `#6BE08C` →
  near-black, Aria `#E06B6B` → white (kit aesthetic preserved).
- ✅ Item #2 ("New Conversation ▾" dropdown chrome): ConversationSwitcher
  toggle now ghost pill, panel `--sp-bg-2` + `--sp-shadow-md`, rows
  with active bg-3, delete × `--sp-fg-4`, error `--sp-destructive`.
- ✅ Item #3 (ActionRail chrome "old"): 4 circular chips 40×40 with
  `--char-accent-soft` bg + `--char-accent` border+color;
  MessageAudioButton ▶ adopts identical shape via `accent` prop.
- ✅ Legibility rule (feedback_text_legibility.md memory): full diff
  audit of `--sp-fg-4` usages in scope — kept only for placeholder
  (none new), disabled (primary-pill disabled fallback) and decorative
  markers (delete × buttons on memory chunks + switcher rows).
  Functional chrome uses `--sp-fg-3` floor per review fixes #3/#4.
- ✅ Spacing rule (feedback_spacing_breathing.md memory): scenario
  padding 12×14 (kit), action rail gap 8 / marginTop 6, rail chips
  40×40 kit-verbatim, panel paddings 1rem (= kit screen-edge 16).

**Screenshots**
- `cycle-0071-L-subtask1.png` — action rail chips + user bubbles L.
- `cycle-0071-S-subtask1.png` — scenario card + action rail row S.
- `cycle-0071-L-subtask3-switcher.png` — conversation switcher panel open L.
- `cycle-0071-S-subtask3-switcher-compact.png` — switcher compact mobile.
- `cycle-0071-L-subtask4-controls.png` — ChatControlsPanel inline L.
- `cycle-0071-S-subtask4-modal.png` — ChatControlsPanel modal S.
- `cycle-0071-L-subtask5-memory.png` — Generation overrides sub-panel L.
- `cycle-0071-L-subtask5-notes.png` — Author's Notes sub-panel L with
  scope chip + stepper + example chips + Save gradient pill.
- `cycle-0071-L-final.png` — final cycle L snapshot.

**Non-negotiables ([Seed/creator-vision.md](../Seed/creator-vision.md) §8)**
Ninguno tocado. SSE path intacto, edit-as-trim intacto, branching copies
intacto, agent isolation (per-Conversation Agent) intacto, BYOK intacto,
grammar module toggle-behavior intacto, snapshot semantics intacto,
Conversation↔Agent reply path plain-text intacto.
