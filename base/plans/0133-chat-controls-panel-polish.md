# Plan 0133 — Chat Controls panel polish

## Objetivo

Audit del creator sobre el drawer Chat Controls + sus 4 sub-paneles
(`ChatControlsPanel`, `AuthorsNoteEditor`, `LorebookPanel`,
`GenerationOverridePanel`). Hallazgos a corregir, en un solo cycle:

1. **Iconografía emoji** — el root usa 📝📕📚🖼️🎬🔊🛠️, el close es `×`, el
   chevron `›`, los steppers de Author's Notes `−`/`+`. El resto de la app
   migró a Lucide en el cycle 0074; estos quedaron afuera (backlog
   "Iconography sweep").
2. **"Inputs muy altos"** — `GenerationOverridePanel` y `AuthorsNoteEditor`
   tienen `data-form="stack"` (reset global que asume `<label display:block>`
   con `margin-top`) PERO además ponen `display:grid`/`gap` en el panel y/o en
   los labels. Los dos sistemas de espaciado se suman → gaps triplicados.
3. **Bug del scope chip** (`AuthorsNoteEditor`) — `scopeChipStyle` usa
   `alignSelf:flex-start`, pero el panel es `display:grid` donde eso controla
   el eje vertical → el chip "This Conversation" se estira a todo el ancho.
4. **Empty state de Lorebook** — un `<p>` pelado flotando; debería usar el
   patrón dashed-card que ya existe en Home ("Add Character") y Gallery.
5. **Comprensión** — ni Lorebook ni Author's Notes comunican qué hacen / cuándo
   se inyectan al prompt. Decisión del creator: **una línea clara + tooltip**
   (sutil, sin ocupar espacio).
6. **Botones** — `+New`/`Save`/`Use defaults`/`← Back` mezclan estilos; en
   `GenerationOverridePanel` la fila `Use defaults`/`Save` queda apretada.
7. **Filas disabled del root** — Autopilot/Auto TTS/Debug se ven casi tan
   pesadas como las activas (solo el emoji tiene opacity 0.6).

## Provenance

- Feedback directo del creator (sesión 2026-05-14) con screenshots de los 4
  paneles.
- Homóloga: [Seed/PersonaLLM-Reference/04-screens/chat-controls.md] — define el
  panel, sus secciones y que Autopilot/Auto TTS/Debug se "keep". Este cycle
  **no agrega** superficies (eso quedó diferido por el creator) — solo pule las
  existentes.
- DesignSystem (autoridad visual): tokens-only, íconos Lucide vía `lib/Icon.tsx`
  (strokeWidth 1.75), pill buttons. `storyplots-design` skill no disponible en
  la sesión → fallback manual leyendo `DesignSystem/` directo (igual que cycle
  0075). frontend-design skill invocado.
- Memorias aplicables: [[feedback_text_legibility]] (--sp-fg-4 solo
  placeholders/disabled), [[feedback_spacing_breathing]] (ritmo del kit),
  [[feedback_grid_overflow_pattern]], [[feedback_visual_approval_before_commit]]
  (sign-off del creator antes del commit).

## Non-negotiables / domain

Ninguno en juego — cycle puramente visual del shell del chat. Sin schema, sin
prompt-assembly, sin SSE. Las testids existentes (`controls-*`, `lorebook-*`,
`notes-*`, `gen-override-*`, `memory-*`) se preservan.

## Cambios

`frontend/src/features/chat/ChatControlsPanel.tsx`:
- `Row` y `Disabled` pasan a recibir `icon: LucideIcon` (no `string` emoji) +
  render vía `<Icon>`. Mapeo alineado con `Settings.tsx` (cycle 0074): Author's
  Notes → `NotebookPen`, Lorebook → `BookMarked`, Memory → `Brain`, Generation
  overrides → `ImageIcon`, Autopilot → `Clapperboard`, Auto TTS → `Volume2`,
  Debug → `Bug`.
- Close `×` → `<Icon icon={X}>`. Chevron `›` → `<Icon icon={ChevronRight}>`.
- `Disabled`: bajar el peso visual de toda la fila (texto + borde + bg más
  apagados), no solo el emoji — que se lea claramente como "todavía no".

`frontend/src/features/chat/AuthorsNoteEditor.tsx`:
- Steppers `−`/`+` → `<Icon icon={Minus/Plus}>`.
- `scopeChipStyle`: `alignSelf` → `justifySelf: "flex-start"` (o envolver el
  chip) para que no se estire en el grid.
- Racionalizar el espaciado: que el ritmo venga de UNA fuente — o el
  `data-form="stack"` global o el grid del panel, no los dos sumados.
- Una línea de copy clara + `title` tooltip explicando qué es una Author's Note
  y cuándo entra al prompt.

`frontend/src/features/chat/LorebookPanel.tsx`:
- Empty state → dashed-card (mismo patrón que `Home`/`Gallery`: `1.5px dashed
  --sp-border-strong` + `--sp-bg-2` + `--sp-radius-lg` + `--sp-fg-3`).
- Una línea de copy + `title` tooltip: las entradas se inyectan cuando sus
  keywords aparecen en mensajes recientes.

`frontend/src/features/chat/GenerationOverridePanel.tsx`:
- Quitar el `display:grid; gap` redundante de los `<label>` y/o del panel —
  dejar que el reset global `data-form="stack"` provea el ritmo (una sola
  fuente de espaciado). Verificar con Playwright que el gap label↔select y
  entre grupos baja a un valor del kit.
- Fila `Use defaults` / `Save` — darle aire / alinear como las otras filas de
  acción de los paneles.

`frontend/src/features/chat/panelStyles.ts` (si hace falta):
- Si surge un patrón de botón repetido al unificar, extraerlo acá. No forzar.

## Implementation order (4 subtareas)

1. **Iconografía Lucide** — `ChatControlsPanel` Row/Disabled + close + chevron;
   `AuthorsNoteEditor` steppers. Disabled rows con peso visual reducido.
   *Verify (Playwright S=375 + L=1440)*: root renderiza 7 filas con SVG (no
   emoji), close + chevron son SVG; las 3 filas disabled claramente apagadas.

2. **Fix spacing stack/grid + scope chip** — `GenerationOverridePanel` (gaps de
   select), `AuthorsNoteEditor` (scope chip + ritmo).
   *Verify (Playwright)*: en GenOverride el gap label↔select y entre grupos
   medido baja a ≤ ~0.5rem; el chip "This Conversation" no se estira (width <
   panel width).

3. **Empty states + copy explicativa** — Lorebook empty dashed-card; línea +
   tooltip en Lorebook y Author's Notes.
   *Verify (Playwright)*: Lorebook vacío muestra la dashed-card; el `title`
   está presente en ambos paneles.

4. **Botones + regresión + close-out** — unificar la fila de acción de
   GenOverride; barrido final de tokens (cero hex nuevos). `code-review` +
   `code-simplifier`. tsc 0, 0 console errors. Screenshots S+L de los 4 paneles
   + sign-off visual del creator antes del commit. Testids preservados.

## Verification

**Subtarea 1 (iconografía)**: Playwright S=390 + L=1440 — root renderiza las 7
filas con SVG Lucide en tiles de 28×28 (no emoji), close + chevron son SVG; las
3 filas disabled con `opacity: 0.5` en toda la fila. AuthorsNoteEditor steppers
con `Minus`/`Plus`.

**Subtarea 2 (spacing + scope chip)**: GenerationOverridePanel — quité
`data-form="stack"` (conflicto con los labels `display:grid`), los selects +
input custom usan `panelFieldStyle`, agregué `alignContent:start`. AuthorsNote —
scope chip `justifySelf:start` + `alignSelf:start` (era grid item estirándose
en ambos ejes), `alignContent:start` en el panel. **Bug nuevo descubierto en
verificación**: la causa de los gaps gigantes no era solo el stack/grid de los
labels — el panel grid con `height:100%` y `align-content` default estiraba las
filas; `alignContent:start` aplicado a los 4 sub-paneles + Memory.

**Subtarea 3 (empty states + copy)**: LorebookPanel empty → dashed-card
(BookMarked + "No entries yet" + helper), content-sized tras el
`alignContent:start`. Línea de copy + `title` tooltip en Lorebook y Author's
Notes.

**Bug pre-existente arreglado en verificación**: `AuthorsNoteEditor` y
`LorebookPanel` no tenían `position:relative` en su `panelStyle` → el backdrop
absoluto del modal pintaba encima e interceptaba todos los clicks en modo
modal (mobile). El root + GenOverride + Memory ya lo tenían. Agregado a los dos.

**Subtarea 4 (botones + close-out)**: `actionRowStyle` extraído en GenOverride
(footer right-aligned con aire). `code-review` 3 findings — **F1 (Memory width
420 vs 360) NO aplicado**: es una decisión deliberada pre-existente (documentada
en `panelStyles.ts` desde 0071), fuera del scope de este cycle y del feedback
del creator; se le menciona. **F2 (root panelStyle sin position:relative)
RECHAZADO** — falso positivo, el root `panelStyle` SÍ tiene `position:relative`
(línea 187). **F3 (AuthorsNote conserva data-form="stack")** — decisión
deliberada (el textarea necesita el chrome de focus/placeholder del reset
global); se agregó un comentario explicando por qué los labels llevan
`marginTop:0`. `code-simplifier` — 1 cambio aplicado (corrigió el comentario de
`panelFieldStyle`), confirmó `IconTile` como extracción legítima (5 usos), y que
el patrón `alignContent`/`position` repetido se deja per-panel (consistente con
la decisión documentada de NO compartir `panelStyle`). tsc 0 errores, 0 console
errors. Testids preservados (`controls-*`, `lorebook-*`, `notes-*`,
`gen-override-*`, `memory-*`). Verificado L=1440 (inline) + S=390 (modal). Visual
sign-off del creator antes del commit (screenshots `cycle-0133-*`).
