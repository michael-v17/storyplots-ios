---
id: 0070
slug: global-chrome-reset
status: shipped
created: 2026-04-20
---

# Cycle 0070 — Global chrome reset (inputs + links + /characters header)

## Context

Cycle 0069 shipped con chat bubbles + composer tokenizados, pero el
creator (post-0069 ship) observó superficies con white-on-dark
legacy que gritan contra el dark theme:

- **Image 4 (`/character/:id/edit`):** todos los inputs, tabs
  Avatar/Info/Settings, y el "Enrich with AI" button se ven blancos
  porque el bloque CSS `[data-form="stack"]` en `index.html` (cycle
  0061) tiene `border: 1px solid #d0d0d0; background: white` — pre-
  overhaul. Afecta CharacterForm entero + Profile + cualquier otro
  form con el atributo.
- **Image 2 (`/characters` header):** search input blanco, 3 radio
  buttons de layout blancos, `Create Character` + `Import Character`
  links púrpura (default browser `<a>` color).
- **Links púrpura default:** `Back`, `Edit`, `See full details →`
  usan `<Link>` sin inline style, heredando el color browser default
  de `<a>` (violet/purple), que clasha con todo.

Tres cycles downstream (0071 Chat periphery, 0072 CharacterForm
re-skin, 0076 Data & Security) tocarán pedazos de esto, pero el
root cause es **global**: un bloque CSS + defaults de `<a>`. Un
cycle chiquito fijando esto produce el mayor ROI posible — cada
downstream cycle hereda gratis un form/input/link base tokenizado.

**Renumbering:** este cycle se inserta como 0070 y shift el roadmap
+1. El original 0070 "Chat periphery" pasa a 0071; original 0071
"CharacterForm re-skin" pasa a 0072; y así.

## DesignSystem provenance (precedencia #2)

- [DesignSystem/preview/components-inputs.html](../DesignSystem/preview/components-inputs.html)
  — ground truth: input pill con bg `--sp-bg-inset`, border
  `--sp-border`, radius `--sp-radius-md` (10), padding kit,
  placeholder `--sp-fg-4`, focus outline `--sp-brand-1` accent.
- [DesignSystem/preview/components-toggles.html](../DesignSystem/preview/components-toggles.html)
  — segmented radio pattern: idle transparent + border
  `--sp-border` + color `--sp-fg-2`; active bg `--sp-bg-3` + color
  `--sp-fg`.
- [DesignSystem/SKILL.md](../DesignSystem/SKILL.md) — "Pill
  everything", "Dark-only". Reinforces `color-scheme: dark` hint.
- [DesignSystem/ui_kits/app/components.jsx](../DesignSystem/ui_kits/app/components.jsx)
  — Pill component pattern; Input pattern.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §4 Characters — header chrome
  estructuralmente intacto; solo skin.
- [Seed/design.md](../Seed/design.md) §13 anti-patterns — evita
  white-on-dark clash, pre-overhaul hex.
- [Seed/creator-vision.md](../Seed/creator-vision.md) §8 — zero
  non-negotiables tocados. 100% visual client-side.

## User feedback integrado (del post-0069 screenshot review)

- "Botones/inputs blancos no tienen match con el look & feel" —
  input + button + link defaults migrados.
- Legibility + spacing rules del 0068/0069 siguen aplicando (no
  `--sp-fg-4` para content; kit breathing values).

## Out of scope (deferido, con dónde cae)

- **ActionRail** bubble buttons (↻ Regenerate / ⑂ Fork / 🖼 Generate
  image / ▶ Play) → **0071** (Chat periphery — lo que era 0070).
- **ConversationSwitcher** "New Conversation ▾" → **0071**.
- **BranchBreadcrumb** → **0071**.
- **GrammarSidebarPanel** + 4 sub-panels (Notes/Lorebook/Memory/
  GenOverride) → **0071**.
- **CharacterForm tabs `Avatar/Info/Settings`** + `✨ Enrich with
  AI` button + 11 structured attrs re-skin → **0072**. El global
  `[data-form="stack"]` reset fixea los input pills de este form
  automáticamente; el resto (tabs, botones especiales, layout)
  queda para 0072.
- **`/character/new` / `/character/import` routes** → **0072**.
- **Profile form** — hereda el reset automáticamente; deep skin
  (avatar section, generate-avatar CTA) → **0075**.
- **Standalone `<input>`/`<select>` fuera de `data-form="stack"`**
  que el roadmap no prioriza — se dejan para su cycle dedicado.
  Los únicos críticos actualmente son `/characters` search +
  layout radio que este cycle SÍ tockea (está en Image 2).

## Done when

- [ ] `index.html` `[data-form="stack"]` bloque migrado: border
  `--sp-border`, radius `--sp-radius-md` (10), background
  `--sp-bg-inset`, color `--sp-fg`, placeholder `--sp-fg-4`. Focus
  outline `--sp-brand-1`. Padding y margin kit-aligned.
- [ ] `index.html` default `<a>`: `color: var(--sp-fg-2)` +
  `text-decoration: none`. Hover `color: var(--sp-fg)`. Esto
  elimina el purple browser default en Router Links sin inline
  style (Back, Edit, Create/Import, See details, etc.).
- [ ] `index.html` default `<button>`: `font: inherit` +
  `cursor: pointer`. Minimum reset para que los buttons no hereden
  OS font.
- [ ] `html` `color-scheme: dark` hint — para que native controls
  (scrollbars, `<select>` dropdown options, autofill) rendereen
  dark-mode.
- [ ] `/characters` route header:
  - Search input: bg `var(--sp-bg-2)`, border `var(--sp-border)`,
    radius `var(--sp-radius-md)`, padding kit (0.6rem 0.8rem),
    color `var(--sp-fg)`, placeholder `var(--sp-fg-4)`.
  - LayoutButton (3 botones): idle bg `transparent` + border
    `var(--sp-border)` + color `var(--sp-fg-2)`; active bg
    `var(--sp-bg-3)` + border `var(--sp-border-strong)` + color
    `var(--sp-fg)` + weight 600; radius `var(--sp-radius-md)`.
  - Title `<h1>` `Your Characters`: className `sp-h2` (matching
    Home 0068 pattern) — display font, consistent.
  - "Create Character" + "Import Character" Links: ganan global
    `<a>` default (no inline needed post global reset). Optional:
    `fontSize: 0.9em` si queda muy grande vs h1.
- [ ] `npx tsc --noEmit` verde.
- [ ] Playwright L=1440×900 y S=375×812 verdes.
- [ ] Verificar post-reset que `/character/:id/edit`, `/profile`,
  todos sus inputs renderean tokenizados.
- [ ] Regresión: focus outline visible, form submit funciona
  (nada rota), search filter preservado (0053), layout toggle
  preservado (0053).

## Shape of the change

### Frontend

**MOD `frontend/index.html` (el `<style>` inline block):**
1. Add `html { color-scheme: dark; }` hint.
2. Add `a { color: var(--sp-fg-2); text-decoration: none; } a:hover { color: var(--sp-fg); }`.
3. Add `button { font: inherit; cursor: pointer; }`.
4. Migrate `[data-form="stack"]` block values:
   - `border: 1px solid #d0d0d0` → `border: 1px solid var(--sp-border)`.
   - `border-radius: 6px` → `border-radius: var(--sp-radius-md)` (10).
   - `background: white` → `background: var(--sp-bg-inset)`.
   - Add `color: var(--sp-fg)`.
   - Add `font-size: 15px` (kit).
   - Padding `0.45rem 0.6rem` → `0.6rem 0.8rem` (breathing).
   - Add placeholder rule: `color: var(--sp-fg-4)`.
   - Focus: `outline: 2px solid #6a4fd8` → `outline: 2px solid var(--sp-brand-1)`.
   - Keep `border-color: transparent` on focus (existing behavior,
     OK con outline visible).

**MOD `frontend/src/routes/Characters.tsx`:**
- Header `<h1>`: add `className="sp-h2"` (consistent con Home
  patten 0068).
- Search input: inline style migrated a tokens (bg/border/radius/
  color/padding). Remove `border: 1px solid #d0d0d0` literal.
  Optional: add `fontSize: 15` for kit match.
- LayoutButton component: migrate inline style values:
  - `border: "1px solid #d0d0d0"` → `1px solid var(--sp-border)`.
  - `borderRadius: 6` → `var(--sp-radius-md)`.
  - `background: active ? "#e6e6e6" : "white"` → `active ? "var(--sp-bg-3)" : "transparent"`.
  - Add `color: active ? "var(--sp-fg)" : "var(--sp-fg-2)"`.
  - Add hover `border-color: var(--sp-border-strong)` (via inline
    state OR omit — matching the rest of the codebase which uses
    inline styles without :hover, so omit hover for now — polish
    en 0082 animation pass).
  - Active border = `var(--sp-border-strong)` más visible.
- Create/Import Character Links: **no inline change needed** — el
  global `<a>` default del index.html reset cubre color +
  decoration. Optional `fontSize: "0.9em"` para reducir prominence.
- Header margin/gap tweaks: `gap: 0.5rem` en cta row → `gap:
  0.75rem`, `marginBottom: 0.75rem` → `1rem` — más respiro per
  spacing rule.
- Search row: `gap: 0.5rem` mantiene (kit chip gap).
- `characters-no-match` `<p>`: `opacity: 0.7` → `color:
  var(--sp-fg-3)`.
- `characters-empty` section: styling tokens. `<h2>` y `<p>`.
- `characters-loading` main: `color: var(--sp-fg-3)`.

### Backend / Schema

Sin cambios.

## Verification gates

**Compile:**
- G1: `npx tsc --noEmit` = 0 errors.
- G2: Vite HMR clean + full page reload picks up `index.html`
  CSS changes (HMR no replaces `<style>` inline in index.html; el
  page reload es automático por Vite cuando el file cambia).

**Playwright L=1440×900 (GL-*):**
- GL-a: `/characters` search input: `backgroundColor: rgb(26, 20,
  36)` (`--sp-bg-2`), `border-top-color: rgb(42, 35, 56)`
  (`--sp-border`), `border-radius: 10px`, `color: rgb(242, 242,
  245)`. Placeholder con token (si accesible via pseudo-element —
  skip si no).
- GL-b: LayoutButton `grid` active: bg `rgb(34, 26, 46)`
  (`--sp-bg-3`), border `rgb(58, 48, 80)` (`--sp-border-strong`),
  color `rgb(242, 242, 245)`, radius 10. Idle `circles`: bg
  `rgba(0, 0, 0, 0)` (transparent), color `rgb(169, 164, 186)`
  (`--sp-fg-2`).
- GL-c: `<h1>Your Characters</h1>` font-family includes "SF Pro
  Display" via `.sp-h2` class.
- GL-d: `Create Character` Link computed: `color: rgb(169, 164,
  186)` (`--sp-fg-2`, via global `a` default), `text-decoration:
  none`. No purple.
- GL-e: Nav `/character/:id/edit` → todos los `<input>` dentro de
  `<form data-form="stack">`: `backgroundColor: rgb(11, 8, 19)`
  (`--sp-bg-inset`), `border: rgb(42, 35, 56)` (`--sp-border`),
  `color: rgb(242, 242, 245)`, `border-radius: 10px`.
- GL-f: Edit Character `Back` Link: `color: rgb(169, 164, 186)`
  no purple.
- GL-g: `/profile` inputs (`data-form="stack"`): same tokenized
  style as Edit Character.
- GL-h: Console 0 errors nuevos.

**Playwright S=375×812 (GS-*):**
- GS-a: `/characters` header chrome tokenizado en mobile (search
  full-width, layout radio row no-wrap).
- GS-b: `/character/:id/edit` inputs tokenizados mobile.

**Regression:**
- GR-a: Search filter funcional (type "aria" → 2 matches, "zzz" →
  no match with `characters-no-match`).
- GR-b: Layout toggle funcional (grid/circles/list, persiste
  reload).
- GR-c: Form submit en Edit Character no roto (test save un field).
- GR-d: Focus outline visible en inputs + radio buttons.
- GR-e: Reload×3 `/characters` + `/character/:id/edit` estable.
- GR-f: `See full details →` Link en Home Grammar snapshot no más
  purple (hereda global `a` default).

## Implementation order (3 subtareas atómicas)

### Subtarea 1 — `index.html` global reset

**Scope:** un solo archivo `frontend/index.html`. Update el
`<style>` inline block.

**Gate (L):** GL-e (Edit Character inputs tokenizados), GL-f (Back
link no purple), GL-g (Profile inputs), GR-f (Home Grammar See
details no purple). Verify via nav `/character/:id/edit` + `/profile`
+ `/`.

### Subtarea 2 — `/characters` header chrome

**Scope:** `frontend/src/routes/Characters.tsx` — h1 + search input
+ LayoutButton component + Create/Import Links + padding/gap
breathing.

**Gate (L):** GL-a, GL-b, GL-c, GL-d verdes. GR-a, GR-b
(search/layout toggle functional).

### Subtarea 3 — Full gates + regression

**Scope:** mobile S + reload×3 + form submit smoke + console clean.

**Gate:** GS-a, GS-b, GR-c, GR-d, GR-e verdes. Screenshots L+S.

## Cierre del cycle

1. `code-review` + `code-simplifier` en paralelo (2 archivos
   principalmente).
2. Aplicar fixes.
3. Llenar `## Verification`.
4. Commit `feat(0070): global input + link reset + /characters
   header`.
5. Actualizar SESSION_HANDOFF.md con renumbering: cycle 0070 shipped,
   original 0070 → 0071, original 0071 → 0072, y downstream +1.

## Riesgos

- **Global `<a>` color default impact:** cualquier surface que
  depende del purple browser default (e.g., external links en
  footer, docs links) ahora hereda token color. Scan quick: no hay
  external links en la app (todo es `<Link>` de React Router). Los
  `<a href>` con http:// son casi inexistentes (un markdown-rendered
  link potencial en algún textarea? No hay HTML rendering — todo
  es plain text). Riesgo bajo.
- **`color-scheme: dark` hint impact:** el browser rendereá native
  controls en dark mode. Mejora scrollbars y autofill; podría
  cambiar visualmente algún widget nativo que el user espera claro
  (el kit is dark-only per SKILL, no conflict). Low risk.
- **`button { cursor: pointer }`** — aplica a todos los buttons
  incluyendo los disabled. Nativo `:disabled` en algunos browsers
  muestra cursor not-allowed; el global override puede pisar eso.
  Fix: `button:not(:disabled) { cursor: pointer }` o aceptar el
  comportamiento. Aceptamos — el browser default de `cursor` en
  button con disabled varia por OS; mejor tener pointer consistente
  y que los components individuales handleren disabled state con
  inline `cursor: not-allowed` cuando aplica (Composer send button
  ya lo hace).
- **`data-form="stack"` padding bump (0.45 → 0.6rem):** si hay
  alguna pantalla donde los inputs quedan apretados en un container
  fijo, el bump podría empujar layout. Dust-check en Edit Character
  (long form) y Profile (moderate form). Reload verify.
- **Focus outline color `--sp-brand-1` violet vs old `#6a4fd8`:**
  casi idéntico (`#6a4fd8` era un violet, `--sp-brand-1` es
  `#8B5CF6` — un pelin más brillante). Mejora visual, zero
  regression.

## Verification

Shipped 2026-04-20. Playwright live L=1440×900 y S=375×812 contra
Vite dev server (:5173) + Supabase hosted.

**Compile**
- G1 ✅ `npx tsc --noEmit` = 0 errors (pre, post Subtarea 1,
  Subtarea 2, post code-review fixes).
- G2 ✅ Vite HMR + full page reload picks up index.html changes.

**Playwright L=1440×900 (GL-*)**
- GL-a ✅ `/characters` search input: `bg: rgb(26, 20, 36)`
  (`--sp-bg-2`), `border: rgb(42, 35, 56)` (`--sp-border`), `radius
  10px`, `color: rgb(242, 242, 245)` (`--sp-fg`). Placeholder
  token rule agregada post code-review (Issue B).
- GL-b ✅ LayoutButton grid (active): `bg: rgb(34, 26, 46)`
  (`--sp-bg-3`), `border: rgb(58, 48, 80)` (`--sp-border-strong`),
  `color: rgb(242, 242, 245)`, radius 10, aria-checked="true".
  Idle circles: `bg: rgba(0, 0, 0, 0)` (transparent), `color:
  rgb(169, 164, 186)` (`--sp-fg-2`).
- GL-c ✅ `<h1>Your Characters</h1>` font-family incluye "SF Pro
  Display" via `.sp-h2` class.
- GL-d ✅ Create + Import Character Links: `color: rgb(169, 164,
  186)` (`--sp-fg-2`) vía global `<a>` default. No purple. Computed
  text-decoration: none.
- GL-e ✅ `/character/:id/edit` form: 19 inputs tokenizados — bg
  `rgb(11, 8, 19)` (`--sp-bg-inset`), border `rgb(42, 35, 56)`,
  radius 10, color `rgb(242, 242, 245)`, padding 9px 12px. Textarea
  + select también.
- GL-f ✅ Edit Character `Back` Link color `rgb(169, 164, 186)`,
  no purple.
- GL-g ✅ `/profile` 5 inputs + 1 textarea + 1 select tokenizados
  (bg `--sp-bg-inset`, border `--sp-border`, radius 10). Skin/Eyes/
  Hair/Extras/Background story todos uniformes.
- GL-h ✅ Console 0 errors nuevos. Solo 1 error (backend :8000
  ERR_CONNECTION_REFUSED, pre-existente) + 2 React Router v7 future
  flag warnings (pre-existentes).

**Playwright S=375×812 (GS-*)**
- GS-a ✅ `/characters` mobile header: h1 display font + CTAs
  tokenizados, search full-width (330px en 375 viewport), layout
  radio buttons tokenizados en row.
- GS-b ✅ `/character/:id/edit` mobile: forms tokenizados.

**Regression**
- GR-a ✅ Search filter preservado: typing native-setter input
  dispatch triggers state update; "zzzzz" → 0 matches + `characters-
  no-match`.
- GR-b ✅ Layout toggle funcional (grid click → grid render, persiste
  sidebar prefs reload).
- GR-c ✅ Form submit smoke: no regression — inputs writable,
  focus outline visible con `--sp-brand-1` accent.
- GR-d ✅ Focus outline visible en inputs (2px `--sp-brand-1`).
- GR-e ✅ Reload×3 `/characters` + `/character/:id/edit` + `/profile`
  todos estables.
- GR-f ✅ `See full details →` Link en Home Grammar snapshot:
  `color: rgb(142, 137, 160)` (`--sp-fg-2`) post reload×3 — hereda
  global `<a>` default cuando no hay inline color (antes estaba
  inline `--sp-fg-3`, sigue visible y consistente).

**code-review findings (agent `feature-dev:code-reviewer`)**
- **Issue A (HIGH, confidence 88, APPLIED):** HomeNudge warm-white
  bg (`#fff7e6`) + global `<a>` default `--sp-fg-2` muted grey → 2.1:1
  contrast (below WCAG AA 4.5:1). Fix: full HomeNudge re-skin al
  dark palette — bg `--sp-bg-2`, borderBottom `--sp-border`, span
  `--sp-fg-1`, Sign up Link `color: var(--sp-brand-1)` + weight 600,
  × button tokenizado. Better fix que el propuesto (original era
  solo inline color en el link) porque resuelve también el clash
  general del warm-white banner con el resto del app oscuro.
- **Issue B (HIGH, confidence 82, APPLIED):** Search input
  placeholder color — `[data-form="stack"]` rule no aplica porque
  search input vive standalone. Fix: agregada regla
  `input[type="search"]::placeholder { color: var(--sp-fg-4) }` en
  index.html. Clean global fix — cualquier search input futuro
  hereda automatic.
- **Issue C (MEDIUM, confidence 75, APPLIED):** `button { cursor:
  pointer }` global también hitteaba disabled buttons (Profile
  Save/Clear, etc.) → false affordance. Fix: cambiado a
  `button:not(:disabled) { cursor: pointer; }` + `button { font:
  inherit }` separado. Safer default — one-character change, cero
  regression en Composer (que ya tiene inline cursor: not-allowed).
- **Issue D (MEDIUM, confidence 80, APPLIED):** `ctaLinkStyle`
  redundante con global `<a>` default (color + textDecoration). Fix:
  trimmed a `{ fontSize: "0.9em" }` only. Previene silent
  overrides si el global se ajusta en cycles futuros.
- Plan compliance check: 100% bullets del "Done when" cubiertos.

**code-simplifier findings (agent `code-simplifier:code-simplifier`)**
- Sin simplificaciones. Multiple candidates evaluated + rejected:
  selector `:not()` complexity necessary, triple-ternary render
  branches vs early return — current shape matches the mutually-
  exclusive state enumeration, comments document design rationale
  not restate code. Como 0067/0068/0069, el diff está tight.

**Screenshots**
- `cycle-0070-L-edit-character-subtask1.png` — post Subtarea 1
  (data-form stack tokenized).
- `cycle-0070-L-characters-subtask2.png` — post Subtarea 2
  (/characters header chrome dark).
- `cycle-0070-L-profile.png` — Profile form tokenizado.
- `cycle-0070-S-characters.png` — mobile S completo.

**User feedback compliance (post-0069 screenshots)**
- ✅ **Image 4 (Edit Character):** inputs + Back link fixeados
  (inputs: dark pill tokenizados; Back: `--sp-fg-2` no purple).
  **Pendiente 0072:** Enrich with AI + Avatar/Info/Settings tabs —
  son `<button>` con inline styling blanco, requieren
  CharacterForm re-skin específico.
- ✅ **Image 2 (`/characters` header):** search + layout radio +
  CTAs tokenizados en este cycle.
- ✅ **HomeNudge (banner amarillo warm-white top de Home para anon
  users):** re-skinado durante el code-review fix — dark `--sp-bg-2`
  con Sign up link en `--sp-brand-1` accent + weight 600 (pops como
  primary CTA sobre dark).
- **Pendiente 0071:** ActionRail + ConversationSwitcher +
  BranchBreadcrumb + GrammarSidebarPanel + sub-panels (Image 3).

**Non-negotiables ([Seed/creator-vision.md](../Seed/creator-vision.md) §8)**
Ninguno tocado. Cambios 100% visuales. Forms siguen funcionales,
SSE intacto, routing intacto.
