# Plan 0134 — Edit Character top redesign (toolbar + avatar block)

## Objetivo

El "top" de `CharacterForm` (header + Enrich + tabs + tab Avatar) no tiene una
grilla de alineación: cada bloque se centró por su cuenta y `AvatarGenerateControls`
quedó alineado a la izquierda con su caption colgando al lado → un zig-zag
`center → center → center → IZQUIERDA → center`. `Enrich with AI` flota solo
centrado. Y siguen los emoji 📁🎨✨ (nunca barridos a Lucide).

Decisión del creator (AskUserQuestion, 2026-05-14): **Dirección C** — header
igual, una banda toolbar (tabs a la izquierda + Enrich a la derecha), y el tab
Avatar como tarjeta side-by-side (avatar 120px a la izquierda + las 3 acciones
apiladas a su derecha + caption debajo). **Emoji → Lucide en este mismo ciclo.**

Aplica a `CharacterForm` completo → afecta `/character/:id/edit` (editing) y
`/character/new/manual` (create). Los campos de los tabs Info/Settings **no se
tocan** — el creator dijo que esos están bien.

## Provenance

- Feedback directo del creator con screenshot del tab Avatar.
- DesignSystem (autoridad visual): tokens-only, íconos Lucide vía `lib/Icon.tsx`,
  pill buttons, ritmo del kit. `frontend-design` skill invocado; `storyplots-design`
  no disponible → fallback manual (igual que cycles 0075/0133).
- Cierra el backlog "Iconography sweep" para `CharacterForm` (📁🎨✨).
- Memorias: [[feedback_spacing_breathing]], [[feedback_grid_overflow_pattern]]
  (la columna de acciones necesita `minWidth:0` para no desbordar en mobile),
  [[feedback_visual_approval_before_commit]] (sign-off antes del commit).

## Non-negotiables / domain

Ninguno — cycle puramente visual de layout. Sin schema, prompt-assembly, SSE.
Testids preservados: `tab-avatar/info/settings`, `enrich-ai`, `enrich-cancel`,
`avatar-preview-open`, `avatar-upload-trigger`, `avatar-upload`,
`avatar-generate`, `avatar-generate-cancel`, `reference-view`,
`character-form-close`, `character-edit`/`character-create`, y los testids de
los StatusBanner (`enrich-success/no-engine/error`, `avatar-generate-no-engine/error`).

## Cambios — `frontend/src/features/characters/CharacterForm.tsx`

**(1) Banda toolbar.** Hoy: `<EnrichControls>` centrado + un `<div justifyContent:center>`
con las tabs. Nuevo: una fila flex única —
`<div toolbarRow>` = `<nav tablist>` (izquierda, mismo borde que el título) +
el botón Enrich (derecha) — con `borderBottom: 1px var(--sp-border-soft)` para
delimitar la banda. `flexWrap: wrap` para que en mobile el Enrich caiga debajo
de las tabs sin desbordar.
- `EnrichControls` se parte: el **botón** (+ Cancel cuando `refining`) va en la
  toolbar; los **3 StatusBanner** (success/no_engine/error) se renderizan en una
  zona de status debajo de la toolbar. Probable forma: `EnrichControls` queda
  como el botón, y un `EnrichStatus` nuevo (o los 3 banners inline en
  CharacterForm, que ya posee `enrichState`) para los banners. Forma exacta se
  decide en impl + pasada de code-simplifier.

**(2) Tab Avatar side-by-side.** Hoy: columna centrada con el avatar, luego
`AvatarGenerateControls` (izquierda), luego `View reference` (centrado). Nuevo:
`<div avatarBlock>` = flex row, `alignItems: flex-start`, gap —
- izquierda: el botón-avatar circular 120px (sin cambios de tamaño/ring).
- derecha: `<div avatarActions>` = flex column, gap, `minWidth: 0`, `flex: 1` —
  los 3 botones (`Upload image` / `Generate Avatar` / `View reference image`)
  como stack uniforme, mismo ancho (`width: 100%` dentro de la columna),
  `ghostPillStyle`.
- el caption "Uses the active image engine…" + los StatusBanner de avatar-gen
  (no_engine/error) + el indicador "Uploading…" van **debajo del bloque**, no al
  lado de un botón.
- `AvatarGenerateControls` se refactoriza: su botón Generate (+ Cancel cuando
  `generating`) entra en la columna; el caption + banners quedan en la zona de
  status. Sigue respetando `visible = editing && hasImageEngine` (en create
  mode la columna muestra solo Upload + View reference).
- En mobile el bloque puede `flexWrap` si 120px + columna no entran; verificar.

**(3) Emoji → Lucide.** 📁 Upload → `Upload` (o `FolderOpen`); 🎨 Generate
Avatar → `Wand2`; ✨ Enrich with AI → `Sparkles`. Vía `<Icon>` wrapper
(strokeWidth 1.75). Imports nuevos de `lucide-react`.

## Implementation order (4 subtareas)

1. **Toolbar row.** Tabs izquierda + Enrich botón derecha + borderBottom +
   `flexWrap`. Split de `EnrichControls` (botón vs status).
   *Verify (Playwright L=1440 + S=390)*: en L las tabs alineadas al borde
   izquierdo del título y el Enrich a la derecha en la misma línea; en S
   wrappean sin overflow; los status banners de enrich aparecen debajo de la
   toolbar (forzar `no_engine` state si hace falta inspección).

2. **Avatar tab side-by-side.** `avatarBlock` flex row, `avatarActions` columna
   con los 3 botones uniformes, caption + status debajo. Refactor de
   `AvatarGenerateControls`.
   *Verify (Playwright L+S)*: avatar a la izquierda, 3 botones apilados del
   mismo ancho a la derecha, caption debajo del bloque; cero zig-zag; en S no
   desborda (`minWidth:0`). Create mode (`/character/new/manual`) muestra solo
   Upload + View reference.

3. **Emoji → Lucide.** Los 3 swaps con `<Icon>`.
   *Verify (Playwright)*: los 3 botones renderizan SVG, no emoji.

4. **Close-out.** `code-review` + `code-simplifier`. tsc 0, 0 console errors.
   Testids preservados (grep). Screenshots L+S del tab Avatar + create mode +
   sign-off visual del creator antes del commit. SESSION_HANDOFF actualizado.

## Verification

**Subtarea 1 (toolbar)**: Playwright L=1440 + S=390. L: tabs alineadas al borde
izquierdo del título "Edit Character" y el pill `✨ Enrich with AI` a la derecha
en la misma banda, con borderBottom delimitando. S=390: `flexWrap` activa, las
tabs van en la primera línea y Enrich cae debajo (left-aligned cuando wrapeado).
StatusBanners de Enrich renderizan debajo de la toolbar via `EnrichStatusBanners`.

**Subtarea 2 (avatar block side-by-side)**: avatar 120px a la izquierda
(`flexShrink:0`), columna de acciones a la derecha (`flex:1; minWidth:0`) con
los 3 botones (Upload / Generate / View reference) en stack uniforme de ancho
completo. Caption "Generate Avatar uses the active image engine…" + status
banners debajo del bloque vía `AvatarGenerateStatus`. Cero zig-zag. Verificado:
- **Edit mode L+S**: los 3 botones visibles, alineados, side-by-side fits a
  390px (avatar 120 + columna restante con `minWidth:0`).
- **Create mode L** (`/character/new/manual`): "Generate Avatar" + caption
  correctamente ocultos (`visible = editing && hasImageEngine` = false en
  create), la columna muestra solo Upload + View reference. Cero regresión.

**Subtarea 3 (emoji → Lucide)**: 📁 → `Upload`, 🎨 → `Wand2`, ✨ → `Sparkles`
vía `<Icon>`. Verificado en screenshots — los 3 botones renderizan SVG.

**Subtarea 4 (close-out)**: `code-review` 3 findings —
**F1 (caption always-visible) confirmado intencional**: el comportamiento es el
mismo que antes (la caption vivía junto al botón Generate, ahora vive debajo
del bloque, ambos casos visibles cuando `editing && hasImageEngine`).
**F2 (tipos duplicados `EnrichState`/`AvatarGenState` locales vs
`EnrichUiState`/`AvatarGenUiState` module-level) APLICADO**: removidos los
tipos locales, `useState` usa los module-level. Una sola fuente.
**F3 (tablist a11y / keyboard nav arrow-key) RECHAZADO** — pre-existente, los
roles ARIA ya estaban antes de 0134; agregar el keydown handler es un cambio
de comportamiento aparte del scope visual. Nota para un ciclo futuro.
`code-simplifier` aplicó: extrajo `avatarActionPillStyle` (3 usos del mismo
shape de 5 propiedades en la columna), incidentalmente arregló un
`boxSizing:border-box` faltante en Generate Avatar.
**Polish post-review del creator (mismo commit)**: (a) la columna de acciones
del avatar block se estiraba a todo el ancho restante (~560px en L=1440); cap a
`maxWidth: 320` para que los 3 botones queden compactos a la izquierda con
espacio vacío a la derecha; (b) el pill `Enrich with AI` (con
`primaryPillStyle` 0.6rem/14px) era visiblemente más grande que el pill
segmentado de las tabs (0.5rem/13px) — overrideado en la toolbar a
`padding: 0.5rem 1rem; fontSize: 13` para que ambos toolbar-siblings sienten en
el mismo baseline visual; (c) la caption "Generate Avatar uses the active
image engine…" vivía debajo del bloque a todo el ancho (`AvatarGenerateStatus`)
— movida dentro de la columna de acciones, debajo del 3er botón, donde queda
con `maxWidth: 320` matcheando el ancho de los botones y se lee como footnote
del grupo. `AvatarGenerateStatus` queda solo como banners (no_engine/error).
**"View reference image button funcione" verificado**: el feature funciona
correctamente — abrí el lightbox con la imagen white-bg en Valeria Ruiz (que
tiene `reference_ref` populado por fal dual-gen). Hisako/Tomás/Inés son
characters legacy ComfyUI sin `reference_ref` → el botón aparece disabled por
diseño (cycle 0123, "discoverable but disabled" con tooltip explicativo). No es
un bug; para habilitar el feature en un character legacy hay que regenerar el
avatar con la fal.ai engine. tsc 0 errores, 0 console errors, testids preservados (verificación grep:
`enrich-ai`, `enrich-cancel`, `enrich-success/no-engine/error`,
`avatar-preview-open`, `avatar-upload-trigger`, `avatar-upload`,
`avatar-generate`, `avatar-generate-cancel`, `avatar-generate-no-engine/error`,
`reference-view`, `tab-avatar/info/settings`, `character-form-close`,
`character-edit/create`).
