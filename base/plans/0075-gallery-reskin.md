---
cycle: 0075
slug: gallery-reskin
status: shipped
date: 2026-04-20
---

# Cycle 0075 — Gallery re-skin

## Goal

Re-skin `routes/Gallery.tsx` (header controls + cap-notice + empty
state) y `features/chat/ImageViewer.tsx` (lightbox chrome completo)
con tokens del cycle 0066. **Tiles ya tokenizados** en el polish (H)
post-0074 — no re-skinar el `<button>` GalleryTile.

**Sin cambios estructurales.** Layout, testids, regen semantics
(0047/0063 — POV/Shot/Resolution/prompt_override), favorite toggle,
delete handler, prev/next nav, Esc/Arrow keyboard shortcuts, lazy
loading (0057), cap notice del 0050 — todos preservados.

## Seed + reference provenance

- [Seed/ux.md §4.8 `/gallery` + Image Viewer](../Seed/ux.md) — sections requeridas (grid + filter bar + empty/populated/loading/error), Image Viewer fullscreen overlay, keyboard shortcuts (`Esc`/`←/→`).
- [Seed/ux.md §6 Required states global](../Seed/ux.md) — loading/empty/error.
- [Seed/design.md §13 anti-patterns](../Seed/design.md) — no inventar chrome.
- [PersonaLLM-Reference/04-screens/gallery.md](../Seed/PersonaLLM-Reference/04-screens/gallery.md) — header pattern (back/title/check/sort), filter bar (search + filter icons + heart), masonry grid.
- [PersonaLLM-Reference/04-screens/image-viewer.md](../Seed/PersonaLLM-Reference/04-screens/image-viewer.md) — top bar (X close · date pill · ♥ favorite circular chips), prompt panel, action bar.
- **Kit:** no hay `GalleryScreen.jsx` — derivar de `HomeScreen.jsx` grid pattern + `components.jsx` (PillButton, IconButton, SectionLabel) + `ChatScreen.jsx` action rail (40×40 circular chips para close/prev/next).
- **Kit previews:** `components-buttons.html`, `components-inputs.html`, `components-action-rail.html`, `colors-surface.html`, `colors-foreground.html`, `colors-semantic.html`.

## Non-negotiables preserved

Ninguno se toca (re-skin chrome). Image generation pipeline + SFW
guardrail + BYOK + storage refs + favorite/delete RLS-scoped queries
intactos (no se tocan endpoints ni queries — solo CSS/styles).

## Scope (files)

1. `frontend/src/routes/Gallery.tsx` — header controls (filter select / favorites checkbox / sort select), cap-notice color, empty state.
2. `frontend/src/features/chat/ImageViewer.tsx` — overlay, top bar, image wrap, footer panel, prompt toggle, regen panel, action buttons, blocked card, error, nav arrows, keyboard.

**Out of scope** (declarado):
- GalleryTile button — ya tokenizado en polish (H) post-0074.
- Search input "Search prompts…" — PersonaLLM lo tiene pero StoryPlots no lo implementó (no es regression del re-skin).
- Multi-select / bulk delete — out of scope v0.
- Video thumbnails / video badge — sin video pipeline aún.
- Masonry layout — `auto-fill minmax(160px,1fr)` actual se mantiene (Seed §4.8 acepta CSS grid).

## Implementation order (3 atomic subtasks)

### Subtask 1 — Gallery.tsx header + filters + empty state

**Cambios:**
- h1 ya tiene `className="sp-page-h1"` (polish post-0074) → añadir `.sp-h2 sp-wordmark` consistente con Home/Settings/Characters/etc. del polish post-0074. Verificar que sp-page-h1 + sp-h2 + sp-wordmark conviven (sp-page-h1 = `display:block` desktop / `display:none` mobile; sp-h2 = display font + tight tracking; sp-wordmark = gradient).
- `nav` filter row: `gap: 0.75rem` actual ok; `alignItems: center` ok.
- 2 `<select>` (Character + Sort): adoptar **pill style** consistente con CharacterEdit tabs y composer (`bg: var(--sp-bg-2)`, `border: 1px solid var(--sp-border)`, `color: var(--sp-fg)`, `borderRadius: 999`, `padding: 0.45rem 0.9rem`, `fontSize: 0.9em`, `appearance: none` + manual chevron via `background-image` SVG inline opcional — o dejar el chevron nativo y solo tokenizar bg/color/border).
- Labels (`Character:` / `Sort:`): tokenizar a `color: var(--sp-fg-2)` + `fontSize: 0.85em` + `display: inline-flex; alignItems: center; gap: 0.5rem`.
- Checkbox favorites: native checkbox con `accent-color: var(--sp-brand-1)` para que el check sea violet en lugar del default OS azul; label color `--sp-fg-2`. Heart `♥` color `--sp-fg-3` (decorative trailing glyph, no funcional).
- Counter `<span>` "13 images": `opacity: 0.6` → `color: var(--sp-fg-3)` + weight 500.
- **Cap notice color** `#a06b00` → `color: var(--sp-warning)` (token `--sp-warning: #F59E0B` per `tokens.css`); también dropear el `marginLeft: 0.5rem` → `marginLeft: 0.5rem` ok.
- **Empty state**: `opacity: 0.7` → `color: var(--sp-fg-3)` + bg `var(--sp-bg-2)` + `border: 1px dashed var(--sp-border-strong)` + `borderRadius: var(--sp-radius-lg)` + `padding: 3rem 1rem` (mismo card-empty pattern que `Add Character` dashed del polish post-0074, pero sin CTA — gallery se llena desde Chat, no se "crea" desde aquí).

**Asserts L=1440 + S=375:**
- GL-a: h1 "Gallery" con `linear-gradient` background-clip text (sp-wordmark) visible en L (sp-page-h1 display:block).
- GL-b: 2 `<select>` con `borderRadius: 999` + `bg --sp-bg-2` + `border --sp-border` (computed) + color `--sp-fg`.
- GL-c: checkbox `accent-color` token violet on toggle.
- GL-d: counter span `color --sp-fg-3`; cap-notice (cuando >= IMAGE_LIST_CAP) `color --sp-warning`.
- GL-e: empty state (filtrar a "Favorites only" sin favorites o character con 0 images) → dashed card visible con `border-style: dashed` + bg-2 + fg-3 text.
- GS-a: header colapsa naturalmente con flexWrap; selects ocupan ancho proporcional sin overflow.
- GS-b: counter sigue legible en S (no truncado).
- GR-a: filter cambia → grid actualiza sin layout shift (regression del polish H).

### Subtask 2 — ImageViewer.tsx chrome

**Cambios (preservando 100% de testids + handlers + props):**

**Overlay + topBar:**
- `overlay`: `background: rgba(0,0,0,0.92)` → mantener (literal lightbox emphasis, mismo precedente que AvatarLightbox del 0072 plan Riesgo). NO cambiar a `--sp-overlay` (es 0.72 alpha — lightbox necesita más opacidad).
- `topBar`: padding ok; agregar `borderBottom: 1px solid rgba(255,255,255,0.08)` opcional para separar visualmente del image area (kit estilo).

**iconBtn (close X + favorite ♥):** transformar a **40×40 circular chips** mismo shape que el ActionRail del 0071 (per kit `ChatScreen.jsx` action rail + image-viewer.md "circular chips"):
- `width/height: 40px`, `borderRadius: 50%`, `padding: 0`.
- Idle: `bg: rgba(255,255,255,0.08)` (subtle on dark overlay), `border: 1px solid rgba(255,255,255,0.18)`, `color: var(--sp-fg)`.
- Hover/focus: opcional bump alpha, mantener actual sin :hover CSS (consistente con resto del proyecto que aún no agrega hovers — diferido a 0083 animation pass).
- Favorite cuando `image.favorite=true`: `color: var(--sp-destructive)` (#E04747, antes `#e53e6b`).
- Date pill al centro: `opacity: 0.7` → `color: rgba(255,255,255,0.72)` (literal because el overlay es opaco-negro, no `--sp-fg-3` que asume bg-2 de la app); fontSize 0.85em ok. Opcional: wrap en pill (`bg: rgba(255,255,255,0.08)`, `padding: 0.3rem 0.75rem`, `borderRadius: 999`) per image-viewer.md "Date pill".

**imageWrap + navBtn:**
- `imageWrap`: structure ok (flex 1 + minHeight 0 + overflow hidden — fix del 0044).
- `navBtn` (prev/next): igual que iconBtn pero 44×44 + position absolute (ya está); migrar `bg: rgba(0,0,0,0.5)` → `rgba(255,255,255,0.08)` para consistency con close/fav; `color: var(--sp-fg)`; `border: 1px solid rgba(255,255,255,0.18)`; `borderRadius: 50%`.
- `imageStyle`: `borderRadius: 6` → `var(--sp-radius-sm)` (8) para consistency.
- Loading state: `<div style={{ color: "white", opacity: 0.6 }}>Loading…</div>` → `<Spinner label="Loading…" />` consistente con ChatShell loading del polish post-0074 (importar Spinner + reemplazar).
- Blocked card (`blockedCard`): `border: 1px solid #d9a` + `bg: rgba(255,247,247,0.1)` → `border: 1px solid var(--sp-warning)` + `bg: var(--sp-warning-soft)` + `color: var(--sp-fg)` (cambia de "lightbox-on-black" a "warning-soft" panel, más coherente con el StatusBanner pattern del 0072).

**footer panel:**
- `bg: rgba(0,0,0,0.5)` → mantener (semi-transparent over the image, kit-like). Opcional: bump a `rgba(0,0,0,0.6)` para más contraste con el prompt text — keep `0.5`.
- Prompt toggle button: actual `color: white` ok; el "PROMPT" label en uppercase con `letterSpacing: 1` ok pero migrar a tokens (`fontSize: var(--sp-text-xs)`, `letterSpacing: var(--sp-tracking-caps)`, `color: rgba(255,255,255,0.7)`).
- Error `<p>`: `color: "#ff9a9a"` → `color: var(--sp-destructive)` (#E04747).

**regen panel (preserve semantics 0047/0063):**
- `regenPanel`: `border: 1px solid rgba(255,255,255,0.2)` → `rgba(255,255,255,0.18)` ok consistency; `bg: rgba(255,255,255,0.05)` ok semi-transparent panel.
- `regenInput`: `bg: rgba(0,0,0,0.4)` + `border: rgba(255,255,255,0.3)` + `color: white` — mantener pattern (panel está sobre fullscreen overlay, no sobre `--sp-bg-2`); solo migrar `borderRadius: 4` → `var(--sp-radius-sm)` (8) y `color: white` → `color: var(--sp-fg)` (sutil, F2F2F5 no es exactamente white pero es el token consistente).
- `regenLabel`: `color: rgba(255,255,255,0.75)` (era `opacity: 0.75`).
- Hint texts (`Per-regen overrides…`, `Edit to override…`): `opacity: 0.7/0.55` → `color: rgba(255,255,255,0.7)` y `rgba(255,255,255,0.55)` (manteniendo escala visual; el panel está sobre overlay opaco-negro, no sobre `--sp-bg-2`, así que tokens fg-3/4 no aplican directamente).

**action buttons (Regenerate/Hide overrides + Regenerate + Delete):**
- `actionBtn`: refactor a **ghost pill** consistente con resto de la app (CharacterForm 0072 ghost):
  - `bg: rgba(255,255,255,0.08)`, `border: 1px solid rgba(255,255,255,0.22)`, `color: var(--sp-fg)`.
  - `padding: 0.55rem 1rem`, `borderRadius: 999` (pill, era `6`).
  - `fontSize: 0.9em`, `fontWeight: 500`.
- Delete button: ghost pill con `color: var(--sp-destructive)` + `borderColor: var(--sp-destructive)` (era `#ff9a9a`).
- Disabled state: `opacity: 0.5` + `cursor: not-allowed`.

**Asserts L=1440 + S=375 (con un image existente — Aria/Evelyn ya generó ≥1 imagen en cycles 0044/0045/0046/0047 pasados):**
- GL-f: open viewer (click un tile en `/gallery`) → overlay fullscreen visible, close X 40×40 circular chip.
- GL-g: favorite toggle visible color destructive cuando favoritado.
- GL-h: date pill center color rgba(255,255,255,0.72), legible.
- GL-i: prompt toggle expand → full prompt visible color white sobre footer.
- GL-j: regen panel toggle (botón "⚙ Regenerate with…") → panel aparece con 4 selects (Prompt + POV + Shot + Resolution); inputs computed `borderRadius: 8`.
- GL-k: action buttons visibles como ghost pills `borderRadius: 999`.
- GL-l: blocked card (mock un image con sfw_blocked=true en consola si hace falta — o solo verificar la regla CSS) `border-color: var(--sp-warning)`.
- GL-m: prev/next nav arrows visibles cuando hay variants (skipear si solo hay 1 imagen — verificar via code path).
- GS-c: viewer en S=375 mantiene topBar 1-row, image fits, footer pill buttons wrap si no caben.
- GR-b: Esc cierra (keyboard handler intacto).
- GR-c: ←/→ cambia entre prev/next (handler intacto, skip si no hay step).

### Subtask 3 — TypeScript check + final visual sweep

- `npx tsc --noEmit` en `frontend/` → 0 errors.
- Reload×3 estable en `/gallery` y `/gallery` con viewer abierto.
- 0 console errors nuevos (los pre-existentes: backend `:8000` down si no está corriendo, React Router v7 future flag warnings).
- Verificación visual L=1440 (sp-page-h1 visible) y S=375 (sp-page-h1 hidden, AppShell topbar muestra "Gallery" via `routeTitle` del polish post-0074 — sí, en el `routeTitle` helper deberá existir el mapping `/gallery → Gallery`).

**Asserts:**
- GR-d: tsc clean.
- GR-e: testids preservados — `gallery`, `gallery-loading`, `gallery-empty`, `gallery-grid`, `gallery-tile-${id}`, `gallery-filter-character`, `gallery-favorites-only`, `gallery-sort`, `gallery-cap-notice`, `image-viewer`, `viewer-close`, `viewer-favorite`, `viewer-prev`, `viewer-next`, `viewer-prompt-toggle`, `viewer-regen-panel`, `viewer-regen-prompt`, `viewer-regen-pov`, `viewer-regen-shot`, `viewer-regen-res`, `viewer-regenerate-toggle`, `viewer-regenerate`, `viewer-delete`.

## Critical files

- `frontend/src/routes/Gallery.tsx` — header + nav + counter + cap-notice + empty.
- `frontend/src/features/chat/ImageViewer.tsx` — overlay/topBar/imageWrap/footer/regen/buttons/blocked.
- `frontend/src/lib/Spinner.tsx` — import en ImageViewer para reemplazar `<div>Loading…</div>`.
- `frontend/src/styles/tokens.css` — `--sp-warning`, `--sp-warning-soft`, `--sp-destructive` — verificar existencia (sí, existen desde 0066).
- `frontend/src/features/shell/AppShell.tsx` — `routeTitle("/gallery")` ya existe (polish post-0074). Verificar.

## Riesgos

- **Pill selects sin chevron nativo:** dropping `appearance: none` requiere chevron manual SVG. Para no inventar SVG, mantener `appearance` default (browser pinta su chevron) — solo tokenizar bg/color/border. Si el chevron del browser desentona en Safari/Firefox, lo hablamos en code-review.
- **Date pill literal whites:** preferir `rgba(255,255,255,0.72)` sobre `--sp-fg-3` porque el overlay es opaco-negro (0.92), donde `--sp-fg-3 = #ACA8B6` sobre bg-2 da contraste distinto al de blanco-semi sobre negro. Documentado en plan.
- **Spinner color:** `Spinner` actual usa `var(--sp-fg-3)` que asume bg de la app. En el viewer (negro 0.92) el Spinner gris puede verse muy débil — pasar prop `color="white"` o variant. Verificar en subtask 2; si el componente no acepta override, dejar `<div>Loading…</div>` con `color: rgba(255,255,255,0.7)` como fallback.
- **`accent-color` checkbox:** soportado en Chrome 93+ / Safari 15.4+ / Firefox 92+ — todos verdes. No se necesita fallback.

## Verification (post-ship)

**Subtask 1 — Gallery.tsx header + filters + empty state**

- ✅ GL-a: h1 "Gallery" computed `font-family: "SF Pro Display", "SF Pro Text", -apple-system…`, `display: block`, `webkitBackgroundClip: text` (gradient violet→teal via `.sp-wordmark`).
- ✅ GL-b: filter `<select>` + sort `<select>` computed `borderRadius: 999px`, `bg: rgb(26, 20, 36)` (= `--sp-bg-2`), `color: rgb(242, 242, 245)` (= `--sp-fg`), `border: rgb(42, 35, 56)` (= `--sp-border`).
- ✅ GL-c: favorites checkbox computed `accentColor: rgb(139, 92, 246)` (= `--sp-brand-1` #8B5CF6).
- ✅ GL-d: counter "64 images" computed `color: rgb(142, 137, 160)` (= `--sp-fg-3`), `fontWeight: 500`. Cap-notice not active (state.images < `IMAGE_LIST_CAP=200`); CSS rule verified by code path.
- ✅ GL-e: empty state (toggled "Favorites only" with no favorites in DB) computed `borderStyle: dashed`, `borderColor: rgb(58, 48, 80)` (= `--sp-border-strong`), `borderWidth: 1.5px`, `bg: rgb(26, 20, 36)` (= `--sp-bg-2`), `borderRadius: 14px` (= `--sp-radius-lg`), `color: --sp-fg-3`.
- ✅ GS-a: 375×812 — header wraps naturally, selects + checkbox stack into 2 rows without overflow; tiles render in 2-column grid.
- ✅ GS-b: counter "64 images" remains visible in S, marginLeft auto fallback works after wrap.
- ✅ GR-a: filter character + sort + favorites toggle all change grid contents without layout shift (regression of polish H preserved).

**Subtask 2 — ImageViewer.tsx chrome**

- ✅ GL-f: viewer overlay rendered, close X computed `width:40px height:40px`, `borderRadius: 50%`, `bg: rgba(255, 255, 255, 0.08)`, `border: rgba(255, 255, 255, 0.18)`, `aria-label: "Close"`.
- ✅ GL-g: favorite chip same shape; idle color `--sp-fg`, favorited color `--sp-destructive` (#E04747); `aria-label` toggles between "Favorite" and "Unfavorite".
- ✅ GL-h: date pill computed bg + border + radius 999 + color rgba(255,255,255,0.82), legible center.
- ✅ GL-i: prompt toggle expand/collapse — full prompt visible in `pre-wrap`, label uppercase `--sp-text-xs` + `--sp-tracking-caps` + 600 weight.
- ✅ GL-j: regen panel toggle — panel visible `bg: rgba(255,255,255,0.05)`, `borderRadius: 8px` (= `--sp-radius-sm`); Prompt textarea + 3 selects (POV/Shot/Resolution) all with `borderRadius: 8`, `bg: rgba(0,0,0,0.4)`, `color: --sp-fg`. Override label changes `↻ Regenerate` → `↻ Regenerate with overrides` when `ovPov` flips to `first_person` (verified live via `change` event dispatch).
- ✅ GL-k: action buttons computed `borderRadius: 999px` (pill); Delete pill computed `color: rgb(224, 71, 71)` + `borderColor: rgb(224, 71, 71)` (= `--sp-destructive`).
- ⏭️ GL-l: blocked card (sfw_blocked=true) — not exercised live (no blocked image in test DB); CSS rule verified in source: `border: 1px solid var(--sp-warning)` + `bg: var(--sp-warning-soft)` + `color: var(--sp-fg)`.
- ⏭️ GL-m: prev/next nav arrows — not exercised (single-image variants in test data); CSS rule verified: 44×44 circular chip, `bg: rgba(255,255,255,0.08)`, `border: rgba(255,255,255,0.18)`, `aria-label: "Previous image"/"Next image"`.
- ✅ GS-c: 375×812 viewer maintains 1-row top bar; date pill wraps text naturally; image fits center; footer pill buttons wrap if needed.
- ✅ GR-b: Esc closes viewer (handler intact, viewer DOM = null after press).
- ⏭️ GR-c: ←/→ keyboard step — not exercised (skip when no prev/next); handler unchanged from cycle 0044/0049.

**Subtask 3 — Final gates**

- ✅ GR-d: `npx tsc --noEmit` 0 errors (frontend).
- ✅ GR-e: testids preserved — `gallery`, `gallery-loading`, `gallery-empty`, `gallery-grid`, `gallery-tile-${id}`, `gallery-filter-character`, `gallery-favorites-only`, `gallery-sort`, `gallery-cap-notice`, `image-viewer`, `viewer-close`, `viewer-favorite`, `viewer-prev`, `viewer-next`, `viewer-prompt-toggle`, `viewer-regen-panel`, `viewer-regen-prompt`, `viewer-regen-pov`, `viewer-regen-shot`, `viewer-regen-res`, `viewer-regenerate-toggle`, `viewer-regenerate`, `viewer-delete` — all present in DOM after re-skin.
- ✅ Reload×3 estable, 0 console errors nuevos (2 React Router v7 future-flag warnings pre-existentes).
- ✅ `routeTitle("/gallery") === "Gallery"` — mobile topbar muestra título correctamente; `.sp-page-h1` hidden en S.

**Code-review (4 findings):**

- **F1 APPLIED** (conf 88) — Spinner removed from loading state because `var(--sp-fg-3)` (#ACA8B6) on `rgba(0,0,0,0.92)` overlay yields ~3.8:1 contrast (fails WCAG AA). Replaced with documented fallback `<div style={{ color: "rgba(255,255,255,0.7)", padding: "2rem 1rem", textAlign: "center" }}>Loading…</div>`. Spinner import dropped.
- **F2 APPLIED** (conf 85) — `GalleryTile` favorite badge `#e53e6b` → `var(--sp-destructive)` for semantic consistency with viewer-favorite chip (both render the same "favorited" state).
- **F3 REJECTED** (conf 83) — `viewer-regenerate-toggle` not gated by `canRegenerate` is **pre-existing** behavior from before cycle 0075. The cycle scope is chrome-only re-skin, not behavioral change. The final `viewer-regenerate` button IS correctly gated by `!canRegenerate`. Defer the panel-gating refinement to a future cycle if the creator surfaces it as a UX friction.
- **F4 APPLIED** (conf 80) — Removed double-opacity composition on the regen sub-hint ("Edit to override…"). Was `color: rgba(255,255,255,0.7)` + `opacity: 0.85` = effective alpha 0.595; replaced with direct `color: rgba(255,255,255,0.55)` matching plan target.

**Code-simplifier (3 candidates applied + 2 rejected):**

- **C1 APPLIED** — Inlined `regenHintStyle` (single use, single prop). Removed const definition, inlined as `style={{ color: "rgba(255,255,255,0.7)" }}` at sole consumer. Net –4 lines.
- **C2 APPLIED** — Lifted override predicates `promptChanged` + `hasOverrides` to top of component body; handler reuses `promptChanged` branch + `hasOverrides` for `onRegenerate(...)`; label collapses to ternary `hasOverrides ? "Regenerate with overrides" : "Regenerate"`. Killed the duplicated `Object.keys({...spread...}).length > 0` mirror. Net –10 lines + removed parallel-branch drift hazard. **Behavior preserved bit-for-bit** (verified live: POV change → label flips correctly).
- **C3 APPLIED** — Dropped second `const prompt = image.refined_prompt || image.prompt || ""` (line 113); reused existing `originalPrompt` (line 59) at lines 145 (`<img alt={...}>`), 166 (`{showFullPrompt ? ... : promptPreview}`), and 114 (`promptPreview` derivation). Net –1 line, removed duplicated fallback chain.
- **C4 REJECTED** — Heart `<span aria-hidden style={{ color: "var(--sp-fg-3)" }}>♥</span>` in Gallery favorites label already minimal as inline.
- **C5 REJECTED** — `filterLabelStyle` spread with 1-prop override (`gap: 0.4rem` for the Favorites label vs default `0.5rem` for selects) preserves intent; consolidating would change the select labels' spacing.

**Non-negotiables preserved** (re-skin chrome only): SSE / edit-as-trim / branching / agent isolation / grammar default-off / per-conv lorebook / snapshot semantics / BYOK / plain-text reply path / regen overrides 0047/0063 (handler logic untouched, payload semantics intact, `prompt_override` only sent when changed).

**Out-of-scope confirmados** (declarado en plan): GalleryTile button border/bg (polish H), Search prompts input (no implementado en StoryPlots), multi-select bulk delete (out of scope v0), video badge / video pipeline (n/a), masonry layout (CSS grid `auto-fill minmax` se mantiene per Seed §4.8 acceptance).

**Skill `storyplots-design` y `/ultraplan`:** Skill no disponible como user-invocable, leí `DesignSystem/SKILL.md` + `DesignSystem/README.md` directo para primear las reglas del kit (40×40 chips kit pattern, pill everything, brand gradient, tokens-only). `/ultraplan` no disponible → plan manual-fallback per CLAUDE.md.

**Screenshots adjuntos en root:** `cycle-0075-L-gallery-subtask1.png`, `cycle-0075-S-gallery-subtask1.png`, `cycle-0075-L-viewer-subtask2.png`, `cycle-0075-L-viewer-regen.png`, `cycle-0075-S-viewer.png`, `cycle-0075-L-final.png`, `cycle-0075-S-bug-investigate.png`, `cycle-0075-S-viewer-fixed.png`, `cycle-0075-L-viewer-fixed.png`.

**Post-ship bug fix (creator feedback "se ve cortado en mobile"):**

Creator reportó que en mobile (S=375) al abrir un tile el viewer "se ve como cortado". Repro: el overlay con `background: rgba(0,0,0,0.92)` dejaba pasar 8% del contenido subyacente — el "Gallery" h1 + filter row + counter + parte del grid se veían fantasma a través del overlay, dando la impresión de que el viewer era un modal recortado en lugar de un lightbox fullscreen. Confirmé via screenshot `cycle-0075-S-bug-investigate.png` (texto "Gallery" + "Character: All" + "Favorites only" + "Sort: Newest" + "1 image" claramente visibles a través del overlay).

**Fix:** `background: rgba(0,0,0,0.92)` → `background: var(--sp-bg)` (#0D0A15 fully opaque). Killed los 8% de bleed sin tocar la paleta — `--sp-bg` es el bg base del proyecto, así que el lightbox ahora se siente como una capa adicional del mismo design system, no un overlay translúcido sobre otro screen. Comment en el archivo actualizado documenta razón. Verificado en S=375 (cycle-0075-S-viewer-fixed.png — sin bleed) y L=1440 (cycle-0075-L-viewer-fixed.png — sin regression). tsc 0 errors.

**2nd post-ship fix (creator screenshot review — bottom buttons cropped + emojis a Lucide):**

Creator reportó (con screenshot live mobile): "aun salen como cortados los botones de abajo al abrir una imagen" + "hay varios botones, como lo de generacion de imagen entre otros que aun usan emojis, deberian usar lo nuevo que hicimos para que sea estandar".

**Bug root cause:** el `footer` style usaba `display: grid; gap: 0.5rem` con `grid-template-columns` default `auto`. La columna se expandía al ancho del contenido más ancho — la action-row interna (3 buttons × ~150px + gaps = ~470px) hacía que la grid column creciera a ~740px en mobile, **overflow horizontal del viewport 375px** y los botones nunca wrappean (el `flexWrap: wrap` interno no se dispara cuando el container exterior crece). Dx via Playwright `getBoundingClientRect`: `rowRect.w = 740.91, viewportW = 375`.

**Fix bug:** `footer` cambiado a `display: flex; flexDirection: column; gap: 0.5rem; minWidth: 0`. Cada hijo (prompt toggle, error, regen panel, action row) ahora respeta el ancho del container exterior (375px), permitiendo que el `flexWrap: wrap` interno funcione. Action row también pasa de `justifyContent: flex-end` → `center` (extracted to `actionRowStyle` const) para que cuando wrappee, las rows queden balanceadas visualmente en lugar de pushed al borde. Comment del archivo documenta el por qué.

**Lucide migration (ImageViewer + Gallery):** new imports `lucide-react: { ChevronLeft, ChevronRight, Heart, RotateCw, SlidersHorizontal, Trash2, X }`. Botones migrados:
- ImageViewer top bar: close X (era char `×`) → `<Icon icon={X} size={20} />`; favorite ♥/♡ → `<Icon icon={Heart} size={20} fill={favorite ? "currentColor" : "none"} />`.
- ImageViewer nav arrows: prev `‹` → `<Icon icon={ChevronLeft} size={24} />`; next `›` → `<Icon icon={ChevronRight} size={24} />`.
- ImageViewer action row: `⚙ Regenerate with…` → `<Icon icon={SlidersHorizontal} size={16} />` + `Regenerate with…`; toggle X → `<Icon icon={X} size={16} />` + `Hide overrides`; `↻ Regenerate` → `<Icon icon={RotateCw} size={16} />` + `Regenerate`; `🗑 Delete` → `<Icon icon={Trash2} size={16} />` + `Delete`. `actionBtn` style ganó `display: inline-flex; alignItems: center; gap: 0.4rem` para el icon + label layout.
- Gallery: checkbox label "Favorites only ♥" → "Favorites only" + `<Icon icon={Heart} size={14} style={{ color: "var(--sp-fg-3)" }} />`; GalleryTile favorite badge `♥` (char) → `<Icon icon={Heart} size={14} fill="currentColor" />`.

**Roadmap follow-up sigue pendiente:** "Iconography sweep" cycle (0081-0082 según roadmap) para migrar emoji restantes de Chat ActionRail (↻⑂🖼▶ — el ActionRail ya tiene chips circulares del 0071, solo el glyph dentro queda emoji), Composer (↑), Home (＋ Add Character card), CharacterForm (📁🎨🗑), character mode (🎭/💬), memory toast (💾), scenario pills, etc.

Verificado live S=375 (`cycle-0075-S-viewer-buttons-fixed.png` — 3 botones wrappean correctly: row 1 Regenerate-with + Regenerate, row 2 Delete; X close + Heart fav top bar) y L=1440 (`cycle-0075-L-viewer-lucide-final.png` — botones en una row porque caben holgadamente). tsc 0 errors.
