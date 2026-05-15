---
id: 0072
slug: character-form-reskin
status: shipped
created: 2026-04-20
---

# Cycle 0072 — CharacterForm re-skin (tabs + buttons + avatar)

## Context

Cycle 0070 migró los inputs de CharacterForm vía el global `[data-
form="stack"]` reset — el body del form quedó tokenizado. Pero las
**superficies no-input** siguen pre-overhaul y el creator las
flaggeó post-0070:

- **Tabs Avatar/Info/Settings** — 3 botones rectangulares con
  `background: #eee` inactivo + `background: draft.accent_color`
  activo. Pattern feo.
- **Enrich with AI** — browser-default button, domina visualmente.
- **Avatar preview** — 96×96 small + `backgroundColor: "#f0f0f0"`
  hex + sin ring; desconectada visualmente del resto.
- **Choose File + Generate Avatar** — browser defaults.
- **Save / Delete / Cancel** bottom row — browser defaults.
- **Enrich + AvatarGen status banners** (success/no_engine/error) —
  pre-overhaul pastel (`#edf8ef` / `#fdf6e3` / `#fff5f5` backgrounds
  con dark text).
- **Import fallback banner** — hex borders.
- **AvatarLightbox** — funcional (cycle 0049) pero hex.

Swap prioritizado sobre 0071 (Chat periphery) porque el creator
estaba mirando este surface al dar feedback.

## DesignSystem provenance (precedencia #2)

- [DesignSystem/ui_kits/app/CharacterEdit.jsx](../DesignSystem/ui_kits/app/CharacterEdit.jsx)
  — 4-step wizard (Basic/Lore/Scenario/Engine). StoryPlots usa
  3-tab (Avatar/Info/Settings) per PersonaLLM-Reference §3; la
  estructura NO se reemplaza, pero sí se **lifta el pattern
  visual** del Mode toggle del kit (líneas 69-79): segmented pill
  con `background: var(--sp-bg-2)` container, `borderRadius: 999`,
  `padding: 4`, active tab `background: var(--sp-brand-1)` + `color:
  white` + `fontWeight: 600`; inactive `transparent` + `color:
  var(--sp-fg-2)`.
- PillButton patterns del kit (`components.jsx` — inferred from
  CharacterEdit `PillButton variant="ghost"/"primary"`) para Enrich
  + Generate Avatar + Save + Cancel.
- [DesignSystem/SKILL.md](../DesignSystem/SKILL.md):
  - "Pill everything" — tabs, buttons, CTAs.
  - Brand gradient solo en wordmark + primary CTA + send button →
    Enrich with AI es Primary CTA AI-driven, gradient OK. Generate
    Avatar es secondary, no gradient (ghost/outline pill).
  - Card radii 14px — alert banners usan `var(--sp-radius-lg)`.

## PersonaLLM-Reference provenance

- [04-screens/character-info.md](../Seed/PersonaLLM-Reference/04-screens/character-info.md)
  §3 "three-tab segmented control at the top: Avatar · Info ·
  Settings (purple pill indicates active tab)". Estructura
  confirmada. §3.a Avatar tab: "Three actions row: Upload ·
  Generate · Remove Image (red link below)" + "Avatar preview
  (large circle)". Current solo tiene Upload + Generate — Remove
  deferred (no está implementado y el plan no lo introduce nuevo).

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §4 Character — estructura intacta.
- [Seed/design.md](../Seed/design.md) §13 anti-patterns — evita
  browser-defaults white-on-dark clash, evita drop-shadows
  heavy, evita gradient fills en cards.
- [Seed/creator-vision.md](../Seed/creator-vision.md) §8 — zero
  non-negotiables tocados. SSE / edit-as-trim / agent isolation
  no aplican a este screen.

## Non-negotiables

Ninguno. Cambios 100% visuales.

## User feedback integrado (0068 + 0069)

- **Legibility:** `--sp-fg-4` solo placeholder/disabled/marker;
  content usa `--sp-fg-3` floor. Los `<small>` hint texts del form
  actualmente con `opacity: 0.6/0.7` → tokenized a `--sp-fg-3`.
- **Spacing:** kit gap/padding values; forms con `data-form="stack"`
  ya heredan breathing del 0070.

## Out of scope (deferido, con dónde cae)

- **AccentPicker component** (16 preset palette + custom picker,
  per reference §3.a) — diferido a 0073 (Character Info +
  Create/Edit/Import/New + AccentPicker). El current form tiene
  `draft.accent_color` sin picker UI — se queda.
- **Writing Styles picker deep integration** → 0080 Prompt Editor.
- **Info tab Deep Dives** (Personality/Goals/Worldbuilding
  accordion dropdown) — inputs ya tokenizados; la dropdown
  collapsible behavior se conserva.
- **Settings tab content deep** (Memory toggle + TTS voice map +
  delete confirm dialog) — inputs tokenizados; modal confirms
  usan `window.confirm` native.
- **Remove Image action** — reference lo menciona; este cycle no lo
  introduce (ni existe en el código actual).
- **AvatarLightbox (cycle 0049)** — funcional preservado; solo
  fix hex background si es crítico para el look.
- **Import fallback banner** — hex colors, fix ligero (no full
  reskin; deferido a 0073 si sigue ruido).

## Done when

- [ ] **Tabs Avatar/Info/Settings** como segmented pill: container
  `var(--sp-bg-2)` + `border: 1px solid var(--sp-border)` + radius
  999 + padding 4; active `var(--sp-brand-1)` + white + weight 600;
  inactive transparent + `var(--sp-fg-2)` hover `var(--sp-fg)`.
- [ ] **Enrich with AI button** primary pill: `var(--sp-brand-grad)`
  bg + `#0D0A15` color + pill radius + `✨` glyph preservado.
  Disabled state con `--sp-bg-3` + `--sp-fg-4`. "Refining…" state
  legible.
- [ ] **Enrich "Cancel" sub-button** (durante refining): ghost pill
  con `var(--sp-border)` + color `var(--sp-fg-2)`.
- [ ] **Enrich status banners** (success/no_engine/error):
  tokenizados con `--sp-success-soft`/`--sp-warning-soft`/
  `--sp-destructive-soft` bg + matching border color + `--sp-fg`
  text color.
- [ ] **Avatar preview**: bump 96→120px; border `--char-accent`
  ring (double-shadow pattern del 0067); bg `var(--sp-bg-3)` cuando
  no hay avatar (en vez de `--sp-bg-2` que se mezcla). Center-
  aligned con margin.
- [ ] **Choose File button** ("Avatar image" label): wrap native
  `<input type="file">` con `display: none` + custom `<label>`
  pill button (ghost) que triggerea el input. Label "Choose File"
  → "Upload image".
- [ ] **Generate Avatar button**: ghost pill con border `--sp-border`
  + color `--sp-fg` + 🎨 glyph preservado. Status sub-button + hint
  banner tokenizados como los de Enrich.
- [ ] **Save / Create button** (submit): primary pill gradient
  (matching Enrich pattern — Save es el commit primary CTA).
  Disabled state legible.
- [ ] **Delete button** (when editing): ghost pill con border
  `--sp-destructive-soft` + color `--sp-destructive` — signal
  destructive action.
- [ ] **Cancel Link** bottom: muted link color via global `<a>`
  default, optional fontSize `0.9em`.
- [ ] **Bottom row `<small>`** "Edits apply to new Conversations
  only": `opacity: 0.7` → `color: var(--sp-fg-3)`.
- [ ] **Avatar lightbox close button**: `border: 1px solid rgba
  (255,255,255,0.3)` → `var(--sp-border)` + `rgba(0,0,0,0.92)` bg
  → `var(--sp-overlay)`. `color: white` intacto (sobre dark overlay
  correcto).
- [ ] **Import fallback banner**: hex borders/bg → tokens.
- [ ] `npx tsc --noEmit` verde.
- [ ] Playwright L=1440×900 y S=375×812 verdes.
- [ ] Regresiones preservadas: tab switching, avatar lightbox
  Escape-close + click-backdrop, save form functional, Enrich +
  Generate avatar flows (state transitions), data-form="stack"
  inputs intactos del 0070.

## Shape of the change

### Frontend

**MOD `frontend/src/features/characters/CharacterForm.tsx`:**

1. **Header `<h1>` → `className="sp-h2"`** + margin adjust.

2. **Tabs segmented control** (líneas 411-425):
   ```
   <nav role="tablist" style={tabsContainerStyle}>
     {(["avatar", "info", "settings"] as Tab[]).map((t) => (
       <button ... style={tabStyle(tab === t)}>{t[0].toUpperCase()+t.slice(1)}</button>
     ))}
   </nav>
   ```
   - `tabsContainerStyle`: inline-flex, bg `--sp-bg-2`, border
     `1px var(--sp-border)`, radius 999, padding 4, gap 4.
   - `tabStyle(active)`: border none, radius 999, padding
     `0.5rem 1rem`, fontSize 13, fontWeight `active ? 600 : 500`,
     cursor pointer, transition kit, bg `active ? var(--sp-brand-1)
     : transparent`, color `active ? white : var(--sp-fg-2)`.

3. **Enrich with AI button** (líneas 1056-1063): primary pill.
   - `primaryPillStyle`: padding `0.6rem 1.25rem`, radius 999,
     border none, cursor pointer, fontWeight 600, fontSize 14,
     bg `var(--sp-brand-grad)`, color `#0D0A15`, transition kit.
   - Disabled (refining): bg `var(--sp-bg-3)`, color `var(--sp-fg-4)`,
     cursor not-allowed.

4. **Enrich Cancel** (línea 1065-1072): ghost pill.
   - `ghostPillStyle`: padding `0.4rem 0.9rem`, radius 999, border
     `1px var(--sp-border)`, bg transparent, color `var(--sp-fg-2)`,
     cursor pointer, fontSize 13.

5. **Enrich status banners** (success/no_engine/error, líneas
   1076-1139): un helper `<StatusBanner tone="success|warning|
   error" testid onDismiss>{children}</StatusBanner>`.
   - success: bg `var(--sp-success-soft)`, border `var(--sp-success)`,
     color `var(--sp-fg)`.
   - warning (no_engine): bg `var(--sp-warning-soft)`, border
     `var(--sp-warning)`, color `var(--sp-fg)`.
   - error: bg `var(--sp-destructive-soft)`, border
     `var(--sp-destructive)`, color `var(--sp-fg)`.
   - Radius `var(--sp-radius-md)`, padding `0.75rem 1rem`, flex
     row + × dismiss button tokenized (color `var(--sp-fg-2)`).
   - AvatarGenerate errors usan el mismo helper.

6. **Avatar preview** (líneas 430-446):
   - Width/height 120 (era 96).
   - `backgroundColor: avatarPreviewUrl ? "var(--sp-bg-3)" :
     draft.accent_color` (idle = accent pastel, ready = bg-3 con
     imagen).
   - Add `boxShadow: "0 0 0 3px var(--sp-bg), 0 0 0 5px " +
     draft.accent_color` (double-ring kit pattern).
   - Center via wrapper `<div style={{ display: "flex",
     justifyContent: "center" }}>`.

7. **Avatar image / Choose File** (líneas 447-457):
   - Hide native `<input type="file">` con `display: none` (or
     `visuallyHidden`).
   - Wrap trigger en `<label>` que actúa como button.
   - `<label style={ghostPillStyle} ...>📁 Upload image</label>`
     (cursor pointer intrínseco).
   - Preserve testid + onChange functionality.

8. **Generate Avatar button** (línea 1167-1174): ghost pill.
   - Style matches Choose File (ghost). 🎨 glyph preserved.
   - Disabled state: bg transparent, color `--sp-fg-4`, cursor
     not-allowed.
   - Cancel subvariant → same ghost style as Enrich Cancel.
   - Hint `<small>`: `opacity: 0.7` → `color: var(--sp-fg-3)`.

9. **Save / Delete / Cancel row** (líneas 879-889):
   - Save: `type="submit" style={primaryPillStyle}` (matches
     Enrich). Disabled renders `--sp-bg-3` + `--sp-fg-4`.
   - Delete: pill con `border: 1px var(--sp-destructive-soft)`,
     color `var(--sp-destructive)`, bg `transparent`.
   - Cancel Link: inherits global `<a>` default muted link.
   - `<small>` "Edits apply to new Conversations only":
     `opacity: 0.7` → `color: var(--sp-fg-3)`.

10. **AvatarLightbox** (líneas 904-959): close button border hex →
    tokens. Keep `background: rgba(0,0,0,0.92)` on the backdrop
    (slightly darker than `--sp-overlay` for lightbox emphasis; OK).

11. **ImportFallbackBanner** (separado, leer su source file) —
    hex → tokens. Si es trivial, fix; si es complejo, defer a 0073.

12. **Header h1 size + spacing** — `.sp-h2` class del 0068, header
    margin kit.

13. **Minor tweaks:**
    - Error `<p style={{ color: "crimson" }}>` (línea 877) → color
      `var(--sp-destructive)`.
    - `<small>` helpers con opacity → color tokens.
    - Uploading indicator "Uploading…" `opacity: 0.7` → `color:
      var(--sp-fg-3)`.

### Backend / Schema

Sin cambios.

## Verification gates

**Compile:**
- G1: `npx tsc --noEmit` = 0 errors.
- G2: Vite HMR clean.

**Playwright L=1440×900 (GL-*):**
- GL-a: Nav `/character/:id/edit` → `[data-testid="character-edit"]`
  renders sin crashes.
- GL-b: Tabs: primer tab `[data-testid="tab-avatar"]` aria-
  selected=true default (but state init es "info" actually — confirm
  tab state default). Active tab computed: bg `rgb(139, 92, 246)`
  (= `--sp-brand-1`), color white; inactive bg `rgba(0,0,0,0)` color
  `rgb(169, 164, 186)` (= `--sp-fg-2`).
- GL-c: Click Avatar tab → active state moves.
- GL-d: `[data-testid="enrich-ai"]`: bg con gradient (background-
  image linear-gradient), color `rgb(13, 10, 21)`, radius 999,
  padding kit. Disabled con text → refining state, bg `rgb(34, 26,
  46)` (`--sp-bg-3`).
- GL-e: Avatar tab active → `[data-testid="avatar-preview-open"]`:
  width 120, height 120, radius 50%, box-shadow ring tokens.
- GL-f: Choose File replaced con `<label>` pill: visible ghost
  styling, click → `<input type="file">` triggers.
- GL-g: `[data-testid="avatar-generate"]` (si hay image engine):
  ghost pill tokenizado.
- GL-h: Bottom `[data-testid="save"]`: primary pill con gradient,
  disabled state legible cuando `!canSave`.
- GL-i: `[data-testid="delete"]` (en edit): destructive ghost pill
  con color `var(--sp-destructive)` borde.
- GL-j: Console 0 errors nuevos.

**Playwright S=375×812 (GS-*):**
- GS-a: Mobile: tabs pill container caben (3 tabs 200px total vs
  375 viewport), no-wrap.
- GS-b: Avatar preview center + tokens intactos mobile.
- GS-c: Save/Delete/Cancel row wraps si necesita, todos pills
  tokenizados.

**Regression:**
- GR-a: Tab switching: click Avatar → content cambia; click Info/
  Settings same.
- GR-b: Avatar lightbox: click preview con avatar_url → opens;
  Escape/click-backdrop/X closes (cycle 0049).
- GR-c: Enrich flow state transitions: idle → refining → success/
  error/no_engine → idle. Dismiss button works.
- GR-d: Generate Avatar flow same (state machine).
- GR-e: Form inputs `data-form="stack"` siguen tokenizados (0070
  preserved).
- GR-f: Form submit: type name + system_prompt + click Save →
  persists + navigates (smoke).
- GR-g: Reload×3 estable.

## Implementation order (3 subtareas atómicas)

### Subtarea 1 — Tabs + Enrich with AI + Enrich banners

**Scope:** tabs segmented pill (411-425), EnrichControls block
(1043-1143 entero — button + cancel + 3 status banners).

**Gate (L):** GL-b, GL-c, GL-d verdes. tsc verde. Tab switch
functional; Enrich states render tokenized (manual inspection del
DOM vía evaluate; live trigger no puede gatillar sin clicks reales
pero las state banners se pueden fake via React state injection si
necesario — fallback: code inspection).

### Subtarea 2 — Avatar preview + Choose File + Generate Avatar

**Scope:** Avatar preview block (430-457), AvatarGenerateControls
(1151-1227), AvatarLightbox close button (904-959).

**Gate (L):** GL-e, GL-f, GL-g verdes + GR-b (lightbox). tsc
verde. Click preview abre lightbox; Esc/backdrop close.

### Subtarea 3 — Save/Delete/Cancel row + ImportFallbackBanner + fieldset cosmetic + full gates

**Scope:** bottom row (877-890), `<p role="alert">` error
(877), `<small>` hints, ImportFallbackBanner fix, fieldsets
cosmetic (border tokens).

**Gate:** GL-h, GL-i + GS-a..c + GR-a,c,d,e,f,g verdes.
Screenshots L+S. Console clean.

## Cierre del cycle

1. `code-review` + `code-simplifier` en paralelo (1 archivo
   principalmente — 1227 líneas, big file).
2. Apply fixes.
3. Llenar `## Verification`.
4. Commit `feat(0072): re-skin CharacterForm tabs + buttons +
   avatar`.
5. Actualizar SESSION_HANDOFF.md.

## Riesgos

- **Active tab color — `--sp-brand-1` violet vs `--char-accent`:**
  el kit usa `--sp-brand-1` para el Mode toggle, la reference dice
  "purple pill" (matches `--sp-brand-1` #8B5CF6). Per-character
  accent color driving the tab would feel inconsistent (tab =
  navigation, not character theme; character theme is for bubbles/
  scenario/rings). **Decisión:** `--sp-brand-1` fixed para tabs.
- **Save button = primary gradient vs `--sp-brand-1` flat:** kit
  CharacterEdit uses `PillButton variant="primary"` for save — I'll
  match Enrich button (gradient) for visual consistency between
  the two primary CTAs in the form. Both are "commit AI work"
  style actions.
- **Choose File `<label>` as button:** native `<input type="file">`
  requires the trigger to be a `<label>` element to work without
  JS (or a JS click on the hidden input). Using `<label>` preserves
  a11y + keyboard nav.
- **Delete destructive color:** `--sp-destructive-soft` is
  `rgba(224, 71, 71, 0.15)` — red-tinted ghost border. Color
  text is `--sp-destructive` `#E04747` solid. Signal is clear.
- **Status banner helper `<StatusBanner>` inline extraction:**
  extracting 3 variants + dismiss into a helper saves ~60 lines of
  repetition. Worth it — kit-aligned.
- **Import fallback banner** — si es complex, fix mínimo color-only
  y defer a 0073. No debería block cycle.
- **Lightbox overlay bg `rgba(0,0,0,0.92)` vs `--sp-overlay`:** el
  token es `rgba(13, 10, 21, 0.72)` — menos opaco. Lightbox quiere
  opacity alta para focus en la imagen. Keep literal `rgba(0,0,0,
  0.92)` (acceptable dark custom).

## Verification

Shipped 2026-04-20. Playwright live L=1440×900 y S=375×812 contra
Vite :5173 + Supabase hosted, Evelyn Hart character.

**Compile**
- G1 ✅ `npx tsc --noEmit` = 0 errors (pre, post Subtareas 1/2/3,
  post code-review fixes, post code-simplifier base extraction).
- G2 ✅ Vite HMR + reload estable.

**Playwright L=1440×900 (GL-*)**
- GL-a ✅ `/character/:id/edit` renders `[data-testid="character-
  edit"]`.
- GL-b ✅ Tab "Info" (default state `useState<Tab>("info")`):
  bg `rgb(139, 92, 246)` (= `--sp-brand-1` violet), color white,
  weight 600, aria-selected=true. Tab "Avatar" (inactive): bg
  transparent, color `rgb(169, 164, 186)` (= `--sp-fg-2`).
- GL-c ✅ Click `tab-avatar` switches active state.
- GL-d ✅ `enrich-ai` button: background-image gradient
  `linear-gradient(90deg, rgb(139, 92, 246) 0%, rgb(52, 211, 153)
  100%)` (= `--sp-brand-grad`), color `rgb(13, 10, 21)`, radius
  999px.
- GL-e ✅ Avatar preview en tab avatar: width/height 120px, radius
  50%, box-shadow double-ring `rgb(13, 10, 21) 0px 0px 0px 3px, rgb
  (74, 74, 74) 0px 0px 0px 5px` (inner = `--sp-bg` body, outer =
  Evelyn accent), bg `rgb(34, 26, 46)` (= `--sp-bg-3`).
- GL-f ✅ `avatar-upload-trigger` label: ghost pill bg transparent,
  border `rgb(42, 35, 56)` (= `--sp-border`), radius 999, text "📁
  Upload image". Native `<input type="file">` escondido
  `display: none`. Fix aplicado post code-review H1: `marginTop: 0`
  para overridear stack reset.
- GL-g ✅ `avatar-generate`: ghost pill tokenizado (visible cuando
  image engine activo).
- GL-h ✅ `save`: primary pill gradient, `disabled=false` cuando
  canSave.
- GL-i ✅ `delete`: destructive pill — color `rgb(224, 71, 71)`
  (= `--sp-destructive`), border `rgba(224, 71, 71, 0.15)`
  (= `--sp-destructive-soft`).
- GL-j ✅ Console 0 errors nuevos.

**Playwright S=375×812 (GS-*)**
- GS-a ✅ Mobile header + tabs + content legibles; tabs container
  inline-flex no-wrap.
- GS-b ✅ Avatar preview center + ghost pills stack OK en 375.
- GS-c ✅ Save/Delete/Cancel row wraps si necesario.

**Regression**
- GR-a ✅ Tab switching functional.
- GR-b ✅ Avatar lightbox: click preview (hasAvatar) → opens;
  ESC/backdrop/X closes.
- GR-c — Enrich flow state transitions diferido a live test (state
  machine no se dispara sin backend text engine; code inspection
  via review confirma StatusBanner states).
- GR-d — AvatarGenerate state machine same.
- GR-e ✅ Form inputs `data-form="stack"` tokenizados del 0070 sin
  regresión.
- GR-f — Form submit smoke diferido (no modifica test data); flow
  intacto per code inspection.
- GR-g ✅ Reload×3 estable.

**Fieldset global reset (index.html):**
- Fieldset "Physical attributes" (tab Avatar): border `rgb(31, 26,
  43)` (= `--sp-border-soft`), radius 10px. Legend "Physical
  attributes" color `rgb(169, 164, 186)` (= `--sp-fg-2`), weight
  500. Mismo comportamiento en "Accent color" + "TTS voice
  override" fieldsets.

**code-review findings aplicados (4):**
- **H1 (APPLIED):** `avatar-upload-trigger` label heredaba
  `margin-top: 0.5rem` del `[data-form="stack"] label` reset del
  0070. Fix: `marginTop: 0` en el spread del label style.
- **H2 (APPLIED):** `<small>` del system prompt counter usaba
  `color: "crimson"` literal cuando over-limit. Fix: `color:
  promptLen > 2000 ? "var(--sp-destructive)" : "var(--sp-fg-3)"`
  (también migra el under-limit color de `opacity: 0.6` a fg-3 —
  legibility rule compliance).
- **M1 (APPLIED):** 7 hint texts con `opacity: 0.6/0.7/0.75`
  migrados a `color: var(--sp-fg-3)` — Physical attributes
  description, seed value span, English style hint, Scenario/First
  Message captions, TTS voice hint. Compliance con legibility rule
  del post-0068 feedback.
- **M2 (APPLIED):** StatusBanner ganó prop opcional
  `dismissTestid`; ImportFallbackBanner pasa `"import-banner-
  dismiss"` para preservar el testid histórico del cycle 0027.

**code-simplifier findings aplicados (1):**
- Extracted `basePillStyle` shared const; `ghostPillStyle` +
  `destructivePillStyle` ahora spread la base + override solo
  border + color. 7 props repetidos eliminados. 20 lines → 20 lines
  net pero claridad mejora — matches "two variants of same pill
  shape" intent.

**Screenshots**
- `cycle-0072-L-subtask1.png` — post tabs + Enrich.
- `cycle-0072-L-subtask2-avatar.png` — post avatar section.
- `cycle-0072-L-avatar-tab.png` — avatar tab full.
- `cycle-0072-S-avatar.png` — mobile.
- `cycle-0072-L-final.png` — final L post reload×3.

**User feedback compliance**
- ✅ **Tabs feos:** resueltos completamente — segmented pill con
  active violet + weight.
- ✅ **Photo layout:** resuelto — 120px centered + double-ring
  accent.
- ✅ **Botones feos:** resueltos — Enrich + Save primary gradient,
  Upload image + Generate Avatar + Enrich Cancel ghost pills,
  Delete destructive pill, Cancel Link muted.
- ✅ **Inputs legibles:** preservados del 0070 + fieldsets ahora
  tokenizados.

**Non-negotiables ([Seed/creator-vision.md](../Seed/creator-vision.md) §8)**
Ninguno tocado. Edit-as-trim, agent isolation, SSE, BYOK intactos.
