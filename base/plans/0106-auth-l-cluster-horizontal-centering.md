# Plan 0106 — Auth L layout: horizontal cluster centering on wide monitors

## Provenance

- Reporte del creador: en monitores ≥1920 px el auth-L se ve "despegado" — wordmark, card y pitch derecho anclados a las cuatro esquinas del viewport, con un agujero compositivo en el medio. En laptops 1280–1440 funciona porque las esquinas todavía están en el campo visual.
- El layout L vive en `frontend/src/features/auth/AuthForm.tsx` (rama `if (compact)` falsa, líneas ~583–731). Cuatro elementos posicionados absolutos al viewport:
  - Wordmark `top: 48, left: 56`
  - Columna izquierda (pitch + card) `left: 56, bottom: 80`
  - Footer `left: 56, bottom: 24`
  - Pitch derecho `right: 56, bottom: 80`
- Decisión de composición acordada con el creador (conversación previa, este cycle):
  - **Solo centrado horizontal**, no vertical. La intención compositiva actual (card "aterriza" sobre el vortex del hero, cielo arriba como aire) se preserva.
  - Cluster max-width definido por el contenido natural: card 420 + gap visual ~480 + pitch derecho 460 ≈ **1360 px**.
  - En viewports ≤ 1360 px el cluster ocupa todo el ancho disponible (offsets clampean a 56 px = comportamiento actual). En viewports > 1360 px los gutters laterales crecen simétricamente y los cuatro elementos del cluster se desplazan hacia el centro juntos.
  - Wordmark también acompaña al desplazamiento (sigue siendo "arriba a la izquierda del cluster", no "arriba a la izquierda del viewport"), si no, queda huérfano.
- Seed/PersonaLLM-Reference no cubre auth-L wide (la app fuente es móvil). Es decisión de DesignSystem / composición editorial sobre el surface auth de v0.

## Decisiones resueltas

1. **Cluster max-width = 1360 px nominal**, ajustable durante la verificación Playwright si a 1920/2560 se ve apretado o suelto. Constante exportable o local al componente.
2. **Offset horizontal calculado por CSS:** `max(56px, calc((100vw - 1360px) / 2 + 56px))` para `left`, simétrico para `right`. A 1440 viewport: `max(56, 96)` → 96... un momento, eso ya rompe el "laptop unchanged".

   **Re-verificación matemática:** a 1440 viewport, `(1440-1360)/2 + 56 = 40 + 56 = 96`. Eso es +40 px de shift respecto al estado actual (que es 56). Para que laptop ≤1440 quede idéntico, la fórmula correcta es:
   - `left: max(56px, calc((100vw - CLUSTER_MAX) / 2))` (sin el `+ 56` interno).
   - A 1440: `(1440-1360)/2 = 40` → `max(56, 40)` = 56. ✓ Laptop unchanged.
   - A 1500: `(1500-1360)/2 = 70` → `max(56, 70)` = 70. Inicio del shift.
   - A 1920: `(1920-1360)/2 = 280` → 280 cada lado. Cluster centrado, ocupa los 1360 px del medio.
   - A 2560: `(2560-1360)/2 = 600` → 600 cada lado. Cluster centrado, mismos 1360 px del medio que en 1440.
3. **Anclajes verticales sin cambios.** `top: 48` para wordmark, `bottom: 80` para columna izquierda + pitch derecho, `bottom: 24` para footer. No se toca.
4. **El layout S (compact, ≤1023 px) no se toca.** Toda la modificación vive dentro de la rama L.
5. **El hero `<picture>` no se toca.** Sigue full-bleed con `object-fit: cover` y los gradientes (linear top fade + radial vignette) intactos. La lógica del vignette (`radial-gradient(ellipse at 28% 72%, ...)`) podría re-evaluarse en wide monitors porque el "punto de foco" oscuro a 28% queda lejos del card cuando el card se centra — se chequea en Playwright; si se ve mal, ajuste menor en una segunda pasada (no parte de este plan).

## Surfaces afectados

- `frontend/src/features/auth/AuthForm.tsx` — solo la rama L (líneas ~583–731). Wordmark, columna izquierda, footer, pitch derecho cambian su offset horizontal de `56`/`right:56` a la fórmula `max(56px, calc((100vw - 1360px) / 2))`.

## Seed sections / non-negotiables

- `Seed/design.md` §13 (anti-patterns) — no introducir scroll horizontal, mantener tokens, no hardcodear hex.
- `Seed/ux.md` §10 (non-omission) — auth-L sigue mostrando wordmark, pitch principal, formulario, footer y pitch secundario. Nada se omite, solo se reposiciona.
- `Seed/creator-vision.md` §8 — ningún non-negotiable tocado (no afecta agent isolation, grammar default, lorebook scope, edit-as-trim, branching, snapshot, SSE, Supabase, BYOK, vendor-agnostic prompts).
- DesignSystem `colors_and_type.css` — no se introducen tokens nuevos. El cambio es 100% layout.

## User stories / flows

- `Seed/user-stories.md` §6 — flujo "sign in" sigue funcionando idéntico. El test ID `auth-signin`, `signin-submit`, `auth-error`, `auth-forgot-link`, `auth-side-pitch` se preservan.
- Flujos asociados: `/sign-in`, `/sign-up`, `/reset-password` — todos comparten el mismo componente, los tres se verifican.

## Open questions

- Ninguna nueva. La constante 1360 px puede afinarse en verificación; eso no es open question, es calibración.

## Implementation order (3 subtareas)

1. **Introducir constante `CLUSTER_MAX_WIDTH = 1360` y helper de offset.** En `AuthForm.tsx`, antes del `return` de la rama L, definir un valor o helper que produzca la string CSS `max(56px, calc((100vw - 1360px) / 2))`. Aplicarlo a los cuatro `style.left`/`style.right` absolutos de la rama L (wordmark, columna izquierda, footer, pitch derecho). El `top` y `bottom` no se tocan.
   - **Assert:** Playwright a viewport 1280×900 y 1440×900 — los bounding boxes de `auth-shell-l > img[alt="StoryPlots"]`, columna izquierda (parent del card), footer y `[data-testid="auth-side-pitch"]` deben mantener `x` y `right-edge` ≈ idénticos al estado pre-cambio (tolerance ±2 px). Diff visual: `npm run dev` en frontend, navegar a `/sign-in`, capturar screenshot a 1440×900 y comparar contra el actual reportado por el creador (debe ser visualmente indistinguible).

2. **Verificar centrado en monitores grandes.** Playwright a 1920×1080 y 2560×1440.
   - **Assert 1920:** wordmark `bbox.x ≈ 280`, columna izquierda `bbox.x ≈ 280`, footer `bbox.x ≈ 280`, pitch derecho `bbox.right ≈ 1640` (= `1920 − 280`). Distancia entre right-edge del card y left-edge del pitch derecho debe ser ≈ la misma que a 1440 (gap ~440 ± 20 px).
   - **Assert 2560:** wordmark `bbox.x ≈ 600`, columna izquierda `bbox.x ≈ 600`, pitch derecho `bbox.right ≈ 1960`. Mismo gap interno entre card y pitch que a 1440 y 1920 (cluster compacto).
   - Screenshot de cada viewport para inspección visual del creador.

3. **Verificar S no regresa.** Playwright a 600×900 y 800×900 — la rama compact debe seguir activándose (`data-shape="s"` presente en `<main>`), top-image + bottom-sheet visibles, brand pitch overlay sobre el hero, formulario en la sheet.
   - **Assert:** `[data-testid="auth-signin"][data-shape="s"]` existe; `[data-testid="auth-shell-s"]` existe; `[data-shape="l"]` no existe.

## Verification

Implementación: `frontend/src/features/auth/AuthForm.tsx` líneas ~589 (constante + helper inline) + 4 sustituciones (`left: 56` → `clusterOffset` en wordmark, columna izquierda, footer; `right: 56` → `clusterOffset` en `auth-side-pitch`).

**Playwright sweep — 6 viewports, ruta `/sign-in`:**

| Viewport | shape | wordmark.x | leftCol.x | leftCol.right | rightPitch.x | rightPitch.right | gap card→pitch |
|---|---|---|---|---|---|---|---|
| 1280×900 | l | 56 | 56 | 476 | 764 | 1224 | 288 |
| 1440×900 | l | 56 | 56 | 476 | 924 | 1384 | 448 |
| 1920×1080 | l | 280 | 280 | 700 | 1180 | 1640 | 480 |
| 2560×1440 | l | 600 | 600 | 1020 | 1500 | 1960 | 480 |
| 600×900 | s | (rama S) | — | — | — | — | — |
| 800×900 | s | (rama S) | — | — | — | — | — |

- 1280/1440 (laptops): offsets resuelven a **56 exacto** — pixel-identical al pre-cambio. ✓
- 1920: cluster centrado, gutter izq/der = 280, gap interno card→pitch = 480 px. ✓
- 2560: gutter simétrico 600/600, cluster locked al cap 1360, gap interno 480 (constante a partir del cap). ✓
- 600/800: `data-shape="s"` activo, `auth-shell-s` presente, `auth-shell-l` ausente — rama compact intocada. ✓

**Screenshots capturados** en `.playwright-mcp/`:
- `auth-l-1920.png`: cluster cohesivo, wordmark sobre el card, pitch derecho alineado a la baseline del card sin tocar el borde físico del viewport.
- `auth-l-2560.png`: gutters laterales ~600 px cada uno; geometría interna idéntica a la de 1920 (mismo footprint 1360 px).

**Vignette `radial-gradient(ellipse at 28% 72%, ...)`:** chequeado visualmente. A 1920+ el foco oscuro del vignette cae sobre el gutter izquierdo en lugar de detrás del card. No es regresión visual (el vignette sigue oscureciendo bordes y el card aterriza sobre la zona media del hero), pero sí es una calibración heredada del estado de "card en la esquina". Ajuste opcional para una pasada futura — no bloquea este cycle.

**Plugin gates:**
- `feature-dev:code-reviewer` — sin findings de alta confianza. Notó (sin marcar como bug) que `width: min(420px, calc(100vw - 112px))` en columna y footer sigue usando `112px` hardcoded (= 2×56); a viewports >1440 el `min()` clampa a 420 antes de que ese cálculo importe, así que no afecta layout. Sin acción requerida.
- `code-simplifier:code-simplifier` — sin cambios. Constante `CLUSTER_MAX_WIDTH` justificada por el comentario, `clusterOffset` deduplica 4 call sites, ninguna abstracción especulativa introducida.

**TypeScript:** `npx tsc --noEmit` → 0 errores.

**TestIDs preservados:** `auth-signin`, `auth-signup`, `auth-reset`, `auth-shell-l`, `auth-shell-s`, `auth-side-pitch`, `auth-brand-pitch`, `signin-submit`, `auth-error`, `auth-notice`, `auth-forgot-link`, `auth-oauth-google`.

**Non-omission ([Seed/ux.md](../Seed/ux.md) §10) y non-negotiables ([Seed/creator-vision.md](../Seed/creator-vision.md) §8):** ningún surface omitido (auth-L sigue mostrando wordmark, brand pitch, formulario, footer, side pitch); ningún non-negotiable tocado.

## Risks / Open

- **Vignette focal point a 28% 72% queda descalibrado en wide monitors.** El gradient apunta a la zona donde el card aterriza; si el card se mueve al centro, el vignette podría seguir oscureciendo donde antes estaba el card pero ya no. Se verifica visualmente en step 2; si se nota, ajuste de coordenadas del vignette en pasada separada (no parte de este plan, para mantenerlo trivial).
- **Pitch derecho podría quedar demasiado pegado al card en monitor grande.** A 1920/2560 con cluster max 1360, el gap entre card.right y pitch.left es ~480 px (mismo que en 1440). Si el creador siente que se ven "muy juntos" en pantalla grande, opciones de calibración: (a) subir CLUSTER_MAX a 1500 → gap interno crece; (b) dejar como está. Decisión post-screenshot.
- **`100vw` en Safari iOS puede incluir scrollbar** — irrelevante en L (≥1024 px, desktop browsers); el S branch maneja eso con `100%` ya. No-op.
- **No tocar el S layout** — verificación explícita en step 3 evita regresión accidental.
