# Plan 0107 — Auth L: cluster as one centered group (vertical + horizontal)

## Provenance

- Fix-forward sobre 0106. El 0106 acertó solo en lo horizontal: corrió los 4 elementos absolutos del L hacia un cap de 1360 px. En el monitor real del creador (ultrawide 34", ≈3440×1440) sigue habiendo un void compositivo grande **vertical** entre el wordmark (anclado a `top: 48`) y el bottom-group (pitch + card a `bottom: 80`). El creator aclaró: lo que pidió desde el principio era **cluster centrado, no separado** — wordmark cerca del pitch, no en la esquina del viewport.
- El error de lectura del 0106 fue interpretar "que en laptop quede como está" como "no toques anclajes verticales". El creator se refería a "no rompas el flujo del desktop normal", no a preservar literalmente la composición esquina-anclada que ya no se sostenía en monitores grandes. La aclaración llegó al ver el screenshot real.

## Decisión de composición (acordada en este turno)

El cluster es **una unidad cohesiva** centrada vertical y horizontalmente:

- **Columna izquierda** (vertical, gap ~24): wordmark → brand pitch (chip + H1 + sub) → glass card.
- **Columna derecha**: side pitch ("Every character has a heartbeat"), `align-self: end` para que su baseline coincida con el bottom del card (preserva la intención existente de "side pitch alineado a card baseline").
- **Footer queda fuera del cluster**, anclado al bottom del viewport (es page furniture: copyright + términos). Esto preserva el patrón web estándar y simplifica el caso de overflow vertical (errores en form, signup más alto, etc.).
- El cluster total **no debe pegar contra los bordes verticales** — `padding: 24px 0` o equivalente en el wrapper para respiración.
- Wordmark queda **dentro del cluster, no en la esquina del viewport.** Pierde el rol de "ancla flotante de marca" y gana cohesión.

## Surfaces afectados

- `frontend/src/features/auth/AuthForm.tsx` rama L (líneas ~589–731). Refactor estructural — los 4 elementos antes absolutos pasan a un grid de 2 columnas centrado verticalmente. Footer absoluto al bottom del viewport (single element).

## Seed sections / non-negotiables

- `Seed/design.md` §13 (anti-patterns) — sin scroll horizontal, tokens, no hex hardcoded.
- `Seed/ux.md` §10 (non-omission) — auth-L sigue mostrando wordmark, brand pitch, formulario, footer y side pitch. Reposiciona, no elimina.
- `Seed/creator-vision.md` §8 — ningún non-negotiable tocado.
- DesignSystem `colors_and_type.css` — sin tokens nuevos. Cambio 100% layout.

## Detalle técnico

```jsx
<main data-shape="l" style={{ minHeight: "100vh", position: "relative", overflow: "hidden", ... }}>
  <HeroPicture />
  <div className="vignette-overlay" style={{ position: "absolute", inset: 0, ... }} />

  {/* Cluster wrapper — flex column, full viewport height, centered */}
  <div style={{
    position: "relative",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    zIndex: 2,
    padding: "24px 0",
    boxSizing: "border-box",
  }}>
    {/* Centered cluster */}
    <div style={{
      flex: "1 1 auto",
      display: "grid",
      gridTemplateColumns: "auto 1fr auto",
      alignItems: "center",        // vertical centering
      justifyContent: "center",
      width: "min(100% - 112px, 1360px)",
      margin: "0 auto",
      columnGap: 80,
    }}>
      {/* Left column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24, width: 420, maxWidth: "100%" }}>
        <img src="/logos/logo.png" alt="StoryPlots" style={{ height: 60, width: "auto", alignSelf: "flex-start", filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.55))" }} />
        {brandPitch("l")}
        <section style={{ /* card styling */ }}>{formBlock}</section>
      </div>
      {/* Spacer */}
      <div />
      {/* Right side pitch — align to card bottom */}
      <div data-testid="auth-side-pitch" style={{ alignSelf: "end", maxWidth: 460, textAlign: "right", ... }}>
        <h2>Every character has a heartbeat.</h2>
        <p>Build a cast...</p>
      </div>
    </div>

    {/* Footer — at bottom of wrapper, aligned to left column */}
    <div style={{
      flex: "0 0 auto",
      width: "min(100% - 112px, 1360px)",
      margin: "0 auto",
      paddingTop: 24,
    }}>
      <div style={{ width: 420, maxWidth: "100%" }}>{footer("l")}</div>
    </div>
  </div>
</main>
```

**Notas:**
1. `align-items: center` en el grid centra verticalmente las dos columnas dentro del `flex: 1 1 auto`. Por el `align-items` por defecto del grid combinado con `align-self: end` en la columna derecha, el side pitch se "ancla" a la línea baseline más baja de la fila — que es el bottom del card (último item de la columna izquierda). ✓ Preserva la intención del 0099 original.
2. La fórmula `clusterOffset` del 0106 se elimina — ya no se necesita porque el grid se autocentra con `margin: 0 auto` + `width: min(...)`.
3. Footer en una segunda fila del flex column, alineado a la izquierda dentro del mismo cap de 1360 px. No pega al borde del viewport en monitores grandes; respeta el cluster.
4. `S branch (compact)` no se toca. Toda la modificación vive dentro del `if (compact)` falso.
5. Hero `<picture>` y vignette overlay no se tocan.

## User stories / flows

- `Seed/user-stories.md` §6 — sign in / sign up / reset siguen funcionando idénticos (mismo `formBlock`, mismos test IDs).

## Open questions

- Ninguna nueva.

## Implementation order (3 subtareas)

1. **Refactor estructural del L branch.** Reemplazar las 4 absolute-positioned regions del L por el wrapper flex + grid descrito arriba. Eliminar `clusterOffset` (ya no necesario).
   - **Assert (Playwright):** `data-shape="l"` presente; el `<img alt="StoryPlots">`, `[data-testid="auth-side-pitch"]`, el `<section>` del card y el footer están todos presentes en el DOM con sus testIDs (auth-side-pitch) y selectores (`section[style*="backdrop-filter"]`) intactos. tsc 0 errors.

2. **Playwright verify visual a 1440×900, 1920×1080, 2560×1440, 3440×1440 + S a 600/800.**
   - **Assert L (todas las 4 viewports):** la distancia vertical entre `cluster.top` (≈ wordmark.top) y `cluster.bottom` (≈ card.bottom o footer.bottom-of-cluster, no del viewport) debe ser **menor a la altura del viewport** (no overflow). El cluster debe estar visualmente centrado: `cluster.top - viewport_top` ≈ `viewport_bottom - cluster.bottom`. side pitch.bottom ≈ card.bottom (alineación preservada).
   - **Assert S:** `data-shape="s"`, `auth-shell-s` presente, `auth-shell-l` ausente (rama compact intocada).
   - Captura screenshots de las 4 L viewports en `.playwright-mcp/auth-l-{1440,1920,2560,3440}-cycle0107.png`.

3. **Mostrar screenshots al creator y esperar OK explícito antes de commit.** Esto es **gate de proceso** — el código queda en working tree (no committed) hasta que el creator confirme visual a su monitor real (3440 ultrawide). Si el creator pide ajustes (gap, paddings, max widths), iterar antes de commit. **Sólo commit después del OK.**

## Verification

Implementación final: `frontend/src/features/auth/AuthForm.tsx`. Refactor estructural completo del L branch + ajustes iterativos guiados por feedback visual del creator.

**Cambios consolidados:**

1. **Estructura del L:** flex wrapper centrado horizontal+vertical (`min-height: 100vh, display: flex, align-items: center, justify-content: center, padding: 24px 0`) que contiene un grid de 3 cols × 2 rows. Row 1: left flex column (wordmark + brand pitch + card) | spacer track | side pitch (`align-self: end`). Row 2: footer en col 1.
2. **Wordmark inside cluster:** `marginBottom: 24` además del flex `gap: 24` (= 48 px total) para respiración hacia el pitch.
3. **Footer inside cluster:** `paddingTop: 16` debajo del card. Texto variant-aware: L usa `--sp-fg-2` + dual-layer text-shadow; S sigue con `--sp-fg-3` sin shadow.
4. **Hero overlay con tinte uniforme:** capa `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35))` agregada como **primer layer** del background del `auth-shell-l` overlay (encima del top fade + radial vignette). Drop de luminancia uniforme — el flame del vortex deja de quemar y el footer text reads sin necesidad de chip/backplate.
5. **Defensive overflow on `<main>`:** `overflow: hidden` → `overflowX: hidden, overflowY: auto`. Edge case del code-reviewer: en viewports cortos + signup mode (650 px alto, 1024+ ancho), el cluster (~752 px contenido) crece más que 100vh — ahora el documento scrollea naturalmente en lugar de clip-ear.
6. **Simplificaciones del simplifier plugin:** removida la constante `CLUSTER_MAX_WIDTH` (era usada una sola vez, inlined a `1360` en el `min()`); trimmed comentarios verbosos del cluster grid; removidos comentarios "Row N, Col M" que repetían los `gridRow`/`gridColumn` props.

**Playwright sweep — 4 viewports L + S verificación:**

| Viewport | shape | wm_top | card_bottom | footer_bottom | space_above | space_below | sidePitch_aligned |
|---|---|---|---|---|---|---|---|
| 1440×900 | l | 98 | 747 | 802 | 98 | 98 | 0 |
| 1920×1080 | l | (centered) | (centered) | (centered) | (sym) | (sym) | 0 |
| 2560×1440 | l | (centered) | (centered) | (centered) | (sym) | (sym) | 0 |
| 3440×1440 | l | 368 | 1017 | 1072 | 368 | 368 | 0 |
| 600×900 | s | (S branch — auth-shell-s presente, auth-shell-l ausente) | | | | | |
| 800×900 | s | (idem) | | | | | |
| 1280×650 (signup) | l | (no overflow) — main scrollHeight 752, body scrollea | | | | | |

- Cluster centrado vertical y horizontal en 1440/1920/2560/3440. Simetría perfecta arriba/abajo. Side pitch aligned to card.bottom **exacto**.
- S layout intocado.
- Edge case signup en 650 px alto: no clipping, scroll natural.
- TestIDs preservados: `auth-signin`, `auth-signup`, `auth-reset`, `auth-shell-l`, `auth-shell-s`, `auth-side-pitch`, `auth-brand-pitch`, `signin-submit`, `signup-submit`, `auth-error`, `auth-notice`, `auth-forgot-link`, `auth-oauth-google`.

**Iteraciones visuales con creator (in-session):**

- v1 (cluster grid centrado horizontal solo): footer todavía pegado al viewport bottom — creator pidió cluster como UN bloque.
- v2 (cluster grid centrado h+v, footer en flex row separado): footer aún se sentía despegado.
- v3 (footer dentro del grid + wordmark con marginBottom 24): position OK; creator notó que el texto del footer no se leía sobre el flame del vortex.
- v4 (intento backplate glass chip en footer): creator descartó — "no me gusta con esa sombra como si fuera un boton, decia overlay a todo el bg".
- v5 (final: overlay uniforme `rgba(0,0,0,0.35)` al hero, sin chip): creator OK — "dejémoslo así de momento".

**Plugin gates:**

- `feature-dev:code-reviewer` — sin findings críticos. Tres notas:
  1. `<section>` del card no tiene `data-testid` propio — no es regresión (no lo tenía antes).
  2. Wordmark `<img>` con `alt="StoryPlots"` marginalmente redundante con `<h1>` — aceptable.
  3. **Real edge case:** signup mode + viewport 650 px alto + 1024+ ancho podría clip-ear. **Fix aplicado** (overflow-y: auto en main).
- `code-simplifier:code-simplifier` — removió `CLUSTER_MAX_WIDTH` y trimmed comentarios. Sin abstracciones especulativas.
- `npx tsc --noEmit` → 0 errores.

**Screenshots capturados (en `.playwright-mcp/`):**

- `auth-l-3440-cycle0107-v6-overlay.png` — final, monitor del creador.
- `auth-l-2560-cycle0107-v6-overlay.png`, `auth-l-1920-cycle0107-v6-overlay.png`, `auth-l-1440-cycle0107-v6-overlay.png` — final en otras viewports.
- `auth-s-600-cycle0107.png` — S layout sin cambios.

**Non-omission ([Seed/ux.md](../Seed/ux.md) §10) y non-negotiables ([Seed/creator-vision.md](../Seed/creator-vision.md) §8):** ningún surface omitido, ningún non-negotiable tocado.

**Carry-forward para futuro (no bloqueante):** el vignette `radial-gradient(ellipse at 28% 72%, ...)` heredado del 0099+0106 sigue calibrado para un punto de foco que ya no está donde estaba el card en monitores grandes. Con el overlay uniforme nuevo, el efecto del vignette es menos visible — sigue dando edge fall-off pero con menos peso. Recalibrar si en algún cycle futuro se nota off.

## Risks / Open

- **Cambio de look en laptop.** El wordmark se mueve de `y=48` a algo cercano a `y≈186` en 1440×900 (centrado vertical del cluster). Esto es **intencional** — el cluster ahora es UN bloque centrado. El creator confirmó que la lectura literal "no tocar nada vertical en laptop" del 0106 fue mal-interpretada por el agente, y lo correcto es centrar.
- **Overflow vertical en signup con errores.** El cluster puede crecer si la card tiene ~3 errores apilados + signup mode (más fields). Mitigación: `padding: 24px 0` en el wrapper + `flex: 1 1 auto` permiten que el cluster ocupe la altura disponible y, en caso extremo, se mantenga visible (no overflow al footer porque footer está en flex-row separado). Si en algún caso límite se overflow, el `<main minHeight: 100vh>` permite scroll vertical natural — comportamiento aceptable para un screen de auth (ya hoy tiene `overflow: hidden`, lo cambiamos a `overflow-y: auto` si es necesario).
- **Vignette focal point a 28% 72%.** Heredado del 0106. A 3440×1440, el foco oscuro cae en (963, 1037) — ahora con el cluster centrado, queda relativamente cerca del card (que estará alrededor de y=720, x=1040 aprox). Mejor calibración que el estado pre-0106 (donde el foco caía sobre el vacío). No se toca; se reevalúa visualmente con el screenshot al creator.
- **S layout intocado** — verificación explícita en step 2.
- **Footer alignment con left column.** El footer queda alineado a la izquierda del cap 1360, **igual** que el bottom del cluster. Si visualmente queda raro porque el cluster está centrado pero el footer está a la izquierda, alternativa: footer también dentro del grid del cluster, en row 2 col 1. Decisión post-screenshot.
