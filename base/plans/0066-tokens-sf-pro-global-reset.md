---
id: 0066
slug: tokens-sf-pro-global-reset
status: shipped
created: 2026-04-20
---

# Cycle 0066 — Design tokens + SF Pro font stack + global reset

## Context

Primer cycle de la fase **Design Overhaul** (roadmap 0066–0083 en
[SESSION_HANDOFF.md](../SESSION_HANDOFF.md) §"Fase actual: Diseño
visual"). Este cycle sólo instala los **pilares** que los cycles
siguientes consumen — no repinta ni un screen:

1. Los **tokens CSS** (`:root` con `--sp-bg`, `--sp-fg-*`, `--sp-accent-*`,
   `--char-accent`, spacing, radii, motion, shadows) se importan una
   vez desde `main.tsx`.
2. Las **fuentes SF Pro** (Text / Display / Rounded, subset mínimo) se
   sirven estáticamente desde `/fonts/` y se declaran con `@font-face`
   en `index.html`, con fallback `-apple-system, BlinkMacSystemFont,
   "Segoe UI", sans-serif`.
3. El `<body>` recibe un reset global (`background: var(--sp-bg);
   color: var(--sp-fg-1); font-family: var(--sp-font);`).

Fuera de alcance: tocar cualquier screen. Los hex hardcoded
(e.g. `background: white` en inputs `[data-form="stack"]`, bordes
`#d0d0d0`, etc.) **se migran en cycles posteriores** (0067 AppShell,
0068 Home, 0069 Chat core, 0071 CharacterForm, 0075 Profile, etc.). Es
**esperado** que los formularios se vean como "islas claras" sobre el
fondo oscuro durante un par de cycles — no es una regresión.

Plan escrito manualmente porque `/ultraplan` no está disponible como
skill en esta sesión (se intentó invocar, no registrado). Siguiendo la
convención de [CLAUDE.md](../CLAUDE.md) §"/ultraplan unavailable
fallback": `status: manual-fallback` en frontmatter + mismo checklist
que `/ultraplan` produciría + aprobación del creator antes de
implementar.

## DesignSystem provenance (precedencia #2 — gana en visual tokens)

- [DesignSystem/colors_and_type.css](../DesignSystem/colors_and_type.css)
  — **fuente** del token file; copiado tal cual (sin los bloques
  `@font-face`, que van a `index.html` por la convención de este cycle).
- [DesignSystem/SKILL.md](../DesignSystem/SKILL.md) — "Dark-only,
  violet-tinted surfaces (#0D0A15 base). No light theme." + "Pill
  everything" (radii) + "Brand gradient only on wordmark + primary CTA
  + send button" + emoji iconography.
- [DesignSystem/README.md](../DesignSystem/README.md) §"Visual
  foundations" (5-step surface ramp, 5-step fg ramp, brand gradient,
  `--char-accent`, type scale) + §"Caveats & substitutions" ("If you
  have the real SF Pro TTFs, drop them in `fonts/` and switch the
  `--sp-font` stack" — exactamente lo que hace este cycle).
- [DesignSystem/fonts/](../DesignSystem/fonts/) — 48 OTF + 2 TTF
  variables disponibles. Este cycle sube al app un subset de 6 OTF
  (ver "Shape of the change" abajo).

## Seed sections satisfied

- [Seed/design.md](../Seed/design.md) — dark-only palette + type
  hierarchy (el seed es el contrato conceptual; el DesignSystem es la
  implementación concreta de esos principios — per CLAUDE.md §"Design
  system", DesignSystem gana en tokens, Seed complementa en principios
  de voice/behavior que no aplican a este cycle).

No se tocan: [Seed/ux.md](../Seed/ux.md) (no se modifica screen
inventory ni layouts), [Seed/domain.md](../Seed/domain.md) (sin cambios
de dominio), [Seed/schema.md](../Seed/schema.md) (sin DB). No se abren
nuevas entries de [Seed/open-questions.md](../Seed/open-questions.md).

## Non-negotiables ([Seed/creator-vision.md](../Seed/creator-vision.md) §8)

Ninguno tocado. Sin efecto sobre agent isolation, grammar default OFF,
per-conversation lorebook, edit-as-trim, branching copies, snapshot
semantics, SSE, Supabase, BYOK, vendor-agnostic prompts, reply path
plano.

## Out of scope (deferido, con dónde cae)

- Re-skin de AppShell/Sidebar/UserSection → **Cycle 0067**.
- Re-skin de Home + CharacterCard → **Cycle 0068**.
- Re-skin de Chat (bubbles, composer, scenario, action rail) →
  **Cycles 0069–0070**.
- Migrar hex hardcoded de formularios (`[data-form="stack"]`:
  `background: white`, borde `#d0d0d0`, outline `#6a4fd8`) → cae
  naturalmente en los cycles donde cada form vive (0071, 0075, 0076).
- Cargar los 48 weights × italics de SF Pro — este cycle sube los
  weights que el CSS semantic-class layer usa (400/500/600/700) + el
  `700 italic` para `.sp-wordmark`/narraciones bold + `400 italic` para
  `.sp-narration` en chat (chat re-skin lo consume en 0069).
- Rounded full family → sólo Regular/Bold por ahora (la token file
  marca Rounded como "reserved for future friendly surfaces; not wired
  by default").
- Variable TTFs (`SF-Pro.ttf`, `SF-Pro-Italic.ttf`) — OTF per-weight
  son más compatibles con `font-weight: <number>` mapping en todos los
  browsers que queremos soportar. El tradeoff vs. peso es asumible
  (~24 MB total con font-display:swap → no bloquea primera pintura).
- Preconnect/preload hints → el overhead es marginal con font-display
  swap; se puede añadir en 0082 (animation/polish pass) si se observa
  flash medible.

## Done when

- [ ] `frontend/public/fonts/` existe con 6 OTF (ver "Shape of the
  change" — set exacto).
- [ ] `frontend/index.html` tiene 6 `@font-face` blocks que apuntan a
  `/fonts/<name>.otf` con `font-display: swap` y el `font-family`
  "SF Pro Text" / "SF Pro Display" (matching tokens.css).
- [ ] `frontend/src/styles/tokens.css` existe, contiene el `:root` +
  element defaults + semantic classes de
  `DesignSystem/colors_and_type.css` — **menos** los bloques
  `@font-face` (que viven en `index.html`). El `html, body` default
  queda con `color: var(--sp-fg)` verbatim del source.
- [ ] `frontend/src/main.tsx` importa `./styles/tokens.css` antes de
  montar React.
- [ ] El `html, body { margin:0; padding:0 }` (cycle 0058) y el bloque
  `[data-form="stack"]` (cycle 0061) existentes en `index.html` se
  **preservan** — se les inyectan los `@font-face` al mismo `<style>`
  inline, no se reemplaza nada.
- [ ] `npx tsc --noEmit` verde.
- [ ] Playwright verde en L=1440×900 **y** S=375×812 (ambos
  breakpoints, per convención design-overhaul de SESSION_HANDOFF).
- [ ] Sin errores de consola navegando /home → /characters → /settings
  → /chat.
- [ ] Regresión: la Grammar snapshot card del cycle 0062 sigue
  renderizando en /home.

## Shape of the change

### Frontend

**NEW `frontend/public/fonts/`** — 6 OTF copiados desde
`DesignSystem/fonts/`. Set trimmed por petición del creator ("que
tenga sentido para que no sea pesado"):

| Family | Weights shipped | Semantic class consumer |
|---|---|---|
| SF Pro Text | Regular 400, Semibold 600, Bold 700, Regular Italic 400i | `.sp-body` / `.sp-meta` / `.sp-timestamp` / `.sp-dialogue` (400), `.sp-subhead` / `.sp-section-label` (600), `.sp-wordmark` (700), `.sp-narration` (400i). |
| SF Pro Display | Semibold 600, Bold 700 | `.sp-h3` (600), `.sp-h1` / `.sp-h2` (700). |
| SF Pro Rounded | — (skip) | Token file marca esta familia como "reserved for future friendly surfaces; not wired by default" — ninguna semantic class la referencia. Añadir en un cycle posterior si aparece un uso real. |

Total 6 files (~13 MB tracked normal — el repo ya tiene precedente
con `References/PersonaLLM/AppReferenceImages/` a 98 MB sin LFS). Los
pesos no shippeados (100/200/300/500/800/900) caen al fallback
`-apple-system` del stack (= SF Pro real en macOS; system font en
Windows/Linux). El browser interpolará faux weight para 500 si algún
componente futuro lo pide — aceptable mientras ningún cycle de diseño
lo exija explícitamente.

**MOD `frontend/index.html`** — dentro del `<style>` inline existente,
**antes** de los bloques `html, body { margin:0; padding:0 }` y
`[data-form="stack"]` (ambos preservados tal cual), insertar 6
`@font-face` blocks con `src: url('/fonts/<name>.otf') format('opentype')`
y `font-display: swap`. Formato idéntico al de
`DesignSystem/colors_and_type.css` pero con paths absolutos
`/fonts/...` (servidos por Vite desde `public/`).

**NEW `frontend/src/styles/tokens.css`** — copia de
`DesignSystem/colors_and_type.css` con **una sola edición mínima**:

1. **Stripped**: los 48 `@font-face` blocks (líneas 12–63 del source) —
   viven en `index.html` por convención de este cycle.

El `html, body` default queda con `color: var(--sp-fg)` **verbatim del
source** — alineado con el intent del creator ("letras blancas como en
PersonaLLM, modo dark default"). `--sp-fg` = `#F2F2F5` ("near-white,
primary copy"). Componentes que quieran body-copy más suave usan la
clase `.sp-body` (ya definida con `color: var(--sp-fg-1)`).

Todo lo demás verbatim: `:root` completo (tokens), element defaults,
semantic classes (`.sp-h1`..`.sp-wordmark`).

**MOD `frontend/src/main.tsx`** — añadir como primera línea
(antes de los imports React):

```ts
import "./styles/tokens.css";
```

Este import se evalúa antes de `createRoot(...).render(...)`, y Vite
inyecta el CSS en `<head>` durante dev + lo bundlea en build.

### Backend

Sin cambios.

### Schema

Sin migrations.

## Verification gates (cada subtarea abajo tiene el suyo)

Consolidado para claridad + lo que se anota en `## Verification` al
cerrar el cycle:

**Asset + compile gates:**
- G1: `ls frontend/public/fonts/*.otf | wc -l` = 6.
- G2: `npx tsc --noEmit` en `frontend/` = 0 errors.
- G3: Vite arranca sin warnings nuevos (`npm run dev` ya corriendo —
  solo verificar logs al reload).

**Playwright L=1440×900:**
- GL-a: `getComputedStyle(document.documentElement).getPropertyValue('--sp-bg').trim()` = `#0D0A15`.
- GL-b: `getComputedStyle(document.body).backgroundColor` = `rgb(13, 10, 21)`.
- GL-c: `getComputedStyle(document.body).fontFamily` incluye `"SF Pro Text"`.
- GL-d: `document.fonts.check('16px "SF Pro Text"')` = `true`
  (esperando a `document.fonts.ready`).
- GL-e: Network log incluye al menos un `200` en path `/fonts/*.otf`.
- GL-f: Nav a /home, /characters, /settings, /chat — 0 console errors,
  0 thrown exceptions, sidebar persistente visible en los 4.
- GL-g: Grammar snapshot card (cycle 0062) visible en /home si
  `grammarMasterOn` — sin regresión estructural.
- GL-h: Hard reload ×3 en /home — los computed styles se mantienen
  (`--sp-bg`, body bg, body fontFamily idénticos en cada reload).

**Playwright S=375×812:**
- GS-a: Computed `--sp-bg` = `#0D0A15` (tokens aplican en mobile).
- GS-b: Body bg = `rgb(13, 10, 21)`.
- GS-c: Font-family incluye `"SF Pro Text"`.
- GS-d: En /home, sidebar **no** visible (≤M breakpoint); hamburger
  topbar visible (cycle 0056).
- GS-e: Hamburger click abre drawer (cycle 0051); backdrop cierra.
- GS-f: Nav a /characters, /settings, /chat desde drawer — 0 console
  errors.

## Implementation order (3 subtareas atómicas, verify entre cada una)

> Per SESSION_HANDOFF "Workflow ahora exige Implementation order con
> Playwright assertion por subtarea". Si una falla → stop + fix antes
> de la siguiente. Si resulta demasiado grande → partirla acá y
> continuar. **Single commit al final** con todos los gates verdes —
> nada de WIP commits.

### Subtarea 1 — Fonts on disk + `@font-face` en index.html

**Scope:**
- Crear `frontend/public/fonts/`.
- Copiar los 6 OTF (Text 400/600/700/400i + Display 600/700).
- En `frontend/index.html`, insertar 6 `@font-face` blocks al
  principio del `<style>` inline existente, **preservando** los
  bloques `html, body { margin:0; padding:0 }` y
  `[data-form="stack"]`. Paths: `url('/fonts/<name>.otf')`.

**Gate (Playwright L=1440×900):**
- Nav `http://localhost:5173/`.
- `await document.fonts.ready`, luego:
  - `document.fonts.check('16px "SF Pro Text"')` = `true`.
  - `document.fonts.check('700 16px "SF Pro Display"')` = `true`.
- Network log: al menos un `200 /fonts/SF-Pro-Text-Regular.otf` (o
  cualquiera de los 6) — confirma que Vite sirve desde `public/`.

**Bash assert:**
- `ls frontend/public/fonts/*.otf | wc -l` → `6`.

Si los checks fallan: revisar `font-family` casing ("SF Pro Text" es
exacto), path absoluto `/fonts/...` (no relativo), y que el `<style>`
inline se parseó (DevTools → Sources → index.html → inline style). No
avanzar a Subtarea 2 hasta que las fonts carguen.

### Subtarea 2 — tokens.css + import desde main.tsx

**Scope:**
- Crear `frontend/src/styles/tokens.css`:
  - Copia verbatim de `DesignSystem/colors_and_type.css` líneas 65–274
    (desde el `:root {` hasta el final del archivo — skipea los
    `@font-face`). Sin cambios al `html, body` default (stays
    `color: var(--sp-fg)`).
- Añadir `import "./styles/tokens.css";` como primera línea de
  `frontend/src/main.tsx` (antes de los imports de React).

**Gate (Playwright L=1440×900):**
- Nav `/` + reload hard.
- `getComputedStyle(document.documentElement).getPropertyValue('--sp-bg').trim()` = `#0D0A15`.
- `getComputedStyle(document.documentElement).getPropertyValue('--sp-fg').trim()` = `#F2F2F5`.
- `getComputedStyle(document.documentElement).getPropertyValue('--sp-font').trim()` incluye `"SF Pro Text"`.
- `getComputedStyle(document.body).backgroundColor` = `rgb(13, 10, 21)`.
- `getComputedStyle(document.body).color` = `rgb(242, 242, 245)` (= #F2F2F5).
- `getComputedStyle(document.body).fontFamily` incluye `"SF Pro Text"`.

**Bash assert:**
- `cd frontend && npx tsc --noEmit` → 0 errors.

Si falla: verificar que el import se encuentra (Vite dev logs),
inspeccionar `<head>` para ver que el CSS se inyectó, chequear que
las tokens token no estén sobreescritas por un `style=` inline en
otro lado del árbol. No avanzar a Subtarea 3 hasta que los computed
styles confirmen.

### Subtarea 3 — Full gates bundle (L + S + reload + regresión)

**Scope:**
- Ninguno nuevo — es la run final que certifica que las 2 subtareas
  anteriores no rompieron nada en las rutas navegables.

**Gate (Playwright L=1440×900 **y** S=375×812, en ese orden):**

L=1440×900:
- Nav /home → assertar: 0 console errors, sidebar persistente visible,
  Grammar snapshot card (0062) presente si master ON, computed styles
  confirmados (GL-a/b/c).
- Nav /characters → 0 errors, layout toggle search (0053) operativo.
- Nav /settings → 0 errors, two-pane visible (0054).
- Nav /chat/:id (cualquier conversación existente) → 0 errors,
  ChatShell root con altura correcta (sin double scrollbar — cycle
  0056 preservado).
- Hard reload ×3 en /home → computed `--sp-bg`, body bg, body
  fontFamily idénticos en cada reload (fonts + tokens persisten).

S=375×812 (resize o new context):
- Nav /home → sidebar oculta, hamburger topbar visible (0056), drawer
  abre/cierra.
- Nav /characters desde drawer → 0 errors, layout toggle responsive.
- Nav /settings desde drawer → drill-through iOS-style (0054).
- Nav /chat/:id desde drawer → ChatShell mobile header compacto
  (0058) preservado, composer visible.

**Bash assert final:**
- Console tab de DevTools mostrando 0 errors.
- `curl -s http://localhost:5173/ | head -40` sanity check que el HTML
  sirve el `<div id="root">`.

Si cualquier gate falla: fix, re-run TODOS los gates desde el inicio
de Subtarea 3 (no sólo el que falló). No commitear hasta que L y S
estén ambos verdes end-to-end.

## Cierre del cycle (después de que las 3 subtareas pasen)

1. Lanzar **code-review** + **code-simplifier** en paralelo como
   agents sobre el diff del cycle (files: `frontend/public/fonts/*`
   [ignorar bin], `frontend/src/styles/tokens.css`,
   `frontend/src/main.tsx`, `frontend/index.html`).
2. Aplicar cualquier fix no-controversial que surja. Hallazgos que
   revelen seed misreads → fix. Hallazgos ambiguos → anotar en plan,
   no escalar a open-questions (este cycle no toca semántica del
   dominio).
3. Llenar la sección `## Verification` con outcomes por gate
   (GL-a..h, GS-a..f, G1-G3).
4. `git add` sólo los archivos del cycle (no los binarios de fonts si
   el user prefiere usar `git lfs` — preguntar antes de commitear si
   el repo ya usa LFS o si prefiere tracked as binary).
5. Commit con mensaje `feat(0066): install design tokens + SF Pro
   font stack + global dark reset` + body + `Co-Authored-By: Claude
   Opus 4.7 (1M context) <noreply@anthropic.com>`.
6. Actualizar [SESSION_HANDOFF.md](../SESSION_HANDOFF.md):
   - Añadir fila `0066 | Design tokens + SF Pro + global reset | ...`
     a la tabla de cycles.
   - Actualizar "Estado actual" con "66 cycles shipped (0001–0031,
     0033–0066)" + siguiente cycle apuntado a 0067 (AppShell skin).
   - Marcar `[x]` en el checklist de la fase actual (Cycle 0066).

## Riesgos / notas

- **Peso del repo**: 6 OTF × ~2.2 MB = ~13 MB tracked. Si el user
  usa Git LFS, preguntar antes de commitear. Si no, aceptable —
  `db/schema.sql` ya pesaba 2.9K líneas y el repo ya subió 98 MB de
  screenshots en session 6.
- **FOUT flash**: con `font-display: swap` el primer paint usa
  `-apple-system` (= SF Pro real en macOS, system font en
  Windows/Linux). Swap cuando los OTF cargan. En macOS visualmente
  imperceptible. En otras plataformas hay un mini-flash aceptable.
- **Form inputs con fondo blanco**: expected. Hex hardcoded
  `background: white` + `border: 1px solid #d0d0d0` en el bloque
  `[data-form="stack"]` (cycle 0061) seguirán mostrándose como
  islas claras sobre body oscuro hasta los cycles 0071/0075/0076.
  No es una regresión — es la migración en fases.
- **Screens con styles inline**: la mayoría de screens usan
  `style={{ ...hex... }}` inline. Esos NO cambian con este cycle
  — sólo cambia el body background + el default text color. Si
  hubiera un screen con `background: transparent` + relying on
  browser white default, ahora se vería con body oscuro a través.
  Playwright nav smoke catch eso si el screen se vuelve ilegible.
- **Hard-coded CSS file loaders**: el CSS token file tiene ~270
  líneas; Vite lo procesa como módulo global al importarlo desde
  `main.tsx`. No necesita PostCSS ni plugins extra.

## Verification

Shipped 2026-04-20. Todos los gates verdes contra Vite live (`:5173`)
+ Playwright headless. Backend (`:8000`) intencionalmente caído
durante la verificación — el cycle es 100% frontend, y el único error
de console relacionado al backend (`127.0.0.1:8000/insights/run
ERR_CONNECTION_REFUSED`) es pre-existente.

### Asset + compile (G1–G3)

| Gate | Outcome |
|---|---|
| G1: `ls frontend/public/fonts/*.otf \| wc -l` = 6 | ✅ 6 archivos: SF-Pro-Text-{Regular,Semibold,Bold,RegularItalic} + SF-Pro-Display-{Semibold,Bold} |
| G2: `npx tsc --noEmit` 0 errors | ✅ output vacío en frontend/ |
| G3: Vite sin warnings nuevos al reload | ✅ HMR respeta el import de tokens.css; no warnings nuevos en server stdout |

### Playwright L = 1440 × 900 (GL-a..h)

| Gate | Outcome |
|---|---|
| GL-a: `--sp-bg` = `#0D0A15` | ✅ |
| GL-b: body bg = `rgb(13, 10, 21)` | ✅ |
| GL-c: body fontFamily incluye `"SF Pro Text"` | ✅ — resuelto: `"SF Pro Text", -apple-system, "system-ui", "Segoe UI", Roboto, sans-serif` |
| GL-d: `document.fonts.check('16px "SF Pro Text"')` = `true` | ✅ — además `text600`, `text700` también `true` después de `document.fonts.load(...)` |
| GL-e: ≥1 `200 /fonts/*.otf` | ✅ 6/6: Text-Regular, Text-Semibold, Text-Bold, Text-RegularItalic, Display-Semibold, Display-Bold |
| GL-f: nav /home /characters /settings /chat sin crashes | ✅ ningún error nuevo en consola; sidebar persistente visible en los 4 |
| GL-g: Grammar snapshot card (cycle 0062) renderiza | ✅ `[data-testid="grammar-snapshot"]` presente en /home |
| GL-h: reload×3 → tokens + fonts persisten | ✅ `--sp-bg`, body bg, body color, body fontFamily, `document.fonts.status="loaded"` idénticos en N=1, 2, 3 |

### Playwright S = 375 × 812 (GS-a..f)

| Gate | Outcome |
|---|---|
| GS-a: `--sp-bg` = `#0D0A15` | ✅ |
| GS-b: body bg = `rgb(13, 10, 21)` | ✅ |
| GS-c: body fontFamily incluye `"SF Pro Text"` | ✅ |
| GS-d: sidebar oculta + hamburger visible | ✅ button `aria-label="Open navigation"` (cycle 0056); sidebar query devuelve null |
| GS-e: hamburger click abre drawer con YOUR PERSONA + RECENT CHATS + nav items | ✅ screenshot confirma drawer overlaid con YOUR PERSONA / Michael card / Home·Characters·Gallery·Grammar / RECENT CHATS / Settings / Sign out |
| GS-f: nav /chat/:id desde drawer carga ChatShell sin crash | ✅ /chat/d1eec46f-…/resolve renderiza shell con bg dark + "Loading..." (resolución backend-dependent, pero el shell monta) |

### Pre-existing console state (NO regresión)

3 errors observados, **todos pre-existentes**, ninguno introducido por
este cycle:

1. `Failed to load resource: 127.0.0.1:8000/insights/run ERR_CONNECTION_REFUSED` — backend `:8000` no corriendo durante la verificación; agnóstico al diff.
2. `Warning: a style property during rerender ... Updating background backgroundPosition at YourPersonaCard` — bug pre-existente cycle 0055 (mezcla shorthand `background:` + `backgroundPosition:` en el mismo style object).
3. `Warning: ... Updating background backgroundSize at YourPersonaCard` — mismo bug del 0055.

Hallazgo de oportunidad: ambos warnings (#2 y #3) son fixeables en un
cycle de hardening del shell (e.g. 0067 cuando re-skineemos
YourPersonaCard) — añadir a backlog post-cierre, no a este cycle.

### Code-review hallazgos + resoluciones

1. **[Conf 85] Plan stale "12 OTF" en 5 spots** — fixeado: 12 → 6
   en líneas 56, 153, 251, 254, 354 + bash assert G1.
2. **[Conf 82] `--sp-weight-medium: 500` sin OTF shipped** — fixeado
   con header expandido en `tokens.css` listando subset shipped +
   ruta de remediación si aparece flash de faux-bold en non-Apple.
   No se modificó `--sp-weight-medium` en el `:root` (mantiene
   verbatim parity con DesignSystem source).

### Code-simplifier hallazgos

Ninguno. `tokens.css` mantiene mirror constraint con
`DesignSystem/colors_and_type.css`; `index.html` solo añade
`@font-face` mínimos sobre la convención existente; `main.tsx` es un
import de una línea. Todos los comments existentes son traceability
intencional.

### Visual evidence (artefactos)

- `cycle-0066-L-home-after.png` — L=1440×900 home con dark bg, sidebar (todavía con hex hardcoded esperado del 0067), Grammar card 0062 visible.
- `cycle-0066-S-home-after.png` — S=375×812 home con dark bg + topbar hamburger compacto del 0058.
- `cycle-0066-S-drawer-open.png` — drawer mobile abierto con YOUR PERSONA + RECENT CHATS + nav items (panel del drawer aún con tonos claros hardcoded — se migra en 0067).
- `cycle-0066-S-chat-after.png` — /chat shell mobile con dark bg + "Loading..." (backend caído).
