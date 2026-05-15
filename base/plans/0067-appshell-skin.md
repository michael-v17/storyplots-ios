---
id: 0067
slug: appshell-skin
status: shipped
created: 2026-04-20
---

# Cycle 0067 — AppShell skin

## Context

Segundo cycle de Design Overhaul (la fundación la instaló 0066 —
tokens CSS + 6 SF Pro OTF + body reset). Este cycle re-skinea las 6
piezas del shell para que lean de los tokens del 0066 en lugar de los
hex hardcoded actuales:

- `features/shell/AppShell.tsx` — topbar mobile, drawer container,
  backdrop.
- `features/shell/Sidebar.tsx` — root nav (persistent L + drawer S),
  header (wordmark + collapse/close), nav row group, Settings footer
  button.
- `features/shell/YourPersonaCard.tsx` — top-of-sidebar persona card
  + avatar fallback. **Aprovechamos para fixear el bug pre-existente
  del cycle 0055**: React warning "Updating background
  backgroundPosition/backgroundSize" — el style mezcla `background:
  <hex>` shorthand con `backgroundImage`/`backgroundSize`/
  `backgroundPosition` longhands, lo que React flagea cada render.
  Fix: usar `backgroundColor` en lugar de `background` shorthand.
- `features/shell/RecentChats.tsx` — section label + 5 rows con
  avatar circular del character + nombre + snippet + relative time.
  Cada avatar gana **ring de `--char-accent`** tomando
  `char.accent_color` como `color-mix` source (patrón del kit, usado
  en `components.jsx` Avatar).
- `features/shell/UserSection.tsx` — auth footer (Sign in / Sign out
  + email display).
- `features/shell/CollapsedUserAvatar.tsx` — icon-rail footer cuando
  sidebar está colapsada en L.

**NO estructural** — ni orden de secciones, ni JSX tree, ni props
shape, ni localización de testids cambian. Sólo substituimos hex por
`var(--sp-*)` / `var(--char-accent)`, y aplicamos radii + el double
box-shadow pattern del kit para los avatars.

El resto del app (Home body, Chat, Characters, Settings, Grammar,
forms con `[data-form="stack"]`) sigue con sus hex hardcoded hasta
sus cycles respectivos (0068–0081). Este cycle sólo repinta el
perímetro de navegación — "the room, not the furniture".

## DesignSystem provenance (precedencia #2 — gana en visual tokens)

- [DesignSystem/SKILL.md](../DesignSystem/SKILL.md) — dark-only
  violet-tinted surfaces (`#0D0A15`), pill everything (buttons +
  chips + search fields), card radii 14, per-character accent drives
  avatar rings.
- [DesignSystem/README.md](../DesignSystem/README.md)
  §"Visual foundations" — 5-step surface ramp
  (`--sp-bg`..`--sp-bg-3` + inset), 5-step fg ramp, `--char-accent`
  variants, `.sp-section-label` small-caps pattern
  (`letter-spacing: 0.08em; text-transform: uppercase; color:
  --sp-fg-3; font-size: 12px;`).
- [DesignSystem/ui_kits/app/components.jsx](../DesignSystem/ui_kits/app/components.jsx)
  — `Avatar` component pattern: `boxShadow: '0 0 0 2px var(--sp-bg),
  0 0 0 3px <accent>'` (double-shadow ring que lee el bg del sidebar
  como inner gap + accent externo). Este es el patrón canónico para
  RecentChats avatars.
- [DesignSystem/ui_kits/app/HomeScreen.jsx](../DesignSystem/ui_kits/app/HomeScreen.jsx)
  — `--char-accent` scoped a cada card con `style={{ '--char-accent':
  p.accent, border: '1px solid var(--char-accent-border)' }}` —
  patrón que aplicamos a cada row de RecentChats.
- [DesignSystem/preview/components-buttons.html](../DesignSystem/preview/components-buttons.html)
  — `.secondary { background: var(--sp-bg-3); color: var(--sp-fg);
  border: 1px solid var(--sp-border); }` — patrón para el Settings
  button del footer.
- [DesignSystem/preview/colors-surface.html](../DesignSystem/preview/colors-surface.html),
  [colors-foreground.html](../DesignSystem/preview/colors-foreground.html),
  [colors-accents.html](../DesignSystem/preview/colors-accents.html) —
  referencia visual de los tokens aplicados.

## PersonaLLM-Reference provenance

- [04-screens/menu.md](../Seed/PersonaLLM-Reference/04-screens/menu.md)
  §Sections — orden top→bottom: YOUR PERSONA card → top links → RECENT
  CHATS → footer (Credits omitido per Seed §2 + Settings). Ya
  implementado estructuralmente en cycle 0055. Este cycle solo repinta.
- [11-web-adaptation-notes.md](../Seed/PersonaLLM-Reference/11-web-adaptation-notes.md)
  §Per-screen adaptation: Menu — sidebar persistente en L (~280px /
  64px collapsed), drawer slide-in en S/M. Intacto desde 0051/0056.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §2 Navigation model — sidebar +
  persona row + nav items + RECENT CHATS + Settings + account footer.
- [Seed/ux.md](../Seed/ux.md) §3 Breakpoints — persistent L, drawer S.
  Estructura preservada; cambian sólo los tokens visuales.
- [Seed/design.md](../Seed/design.md) §13 anti-patterns — evitar
  elementos rotulados con la paleta brand donde no son acción primaria.
  Este cycle respeta la regla: ningún elemento del sidebar adopta
  `--sp-brand-grad` (ese gradient se reserva para wordmark + primary
  CTA + send button per SKILL §key conventions).

## Non-negotiables ([Seed/creator-vision.md](../Seed/creator-vision.md) §8)

Ninguno tocado. Visual-only sobre shell chrome. No SSE, no prompt
assembly, no agent isolation, no grammar, no memory, no lorebook, no
schema.

## Out of scope (deferido)

- **Wordmark con brand gradient** (`.sp-wordmark` class) — el header
  del sidebar muestra el string "StoryPlots" como `<strong>`; el
  gradient wordmark per DesignSystem se aplica cuando tengamos el SVG
  del wordmark (`DesignSystem/assets/logo-wordmark.svg`). Este cycle
  usa el string con tipografía bold; el SVG wordmark lo dejamos para
  el cycle 0082 (animation + elevation + polish). Si el creator lo
  pide antes, se puede bumpear.
- **Collapsed sidebar hover popover** (tooltip que muestre label del
  nav item cuando collapsed) — el kit no lo define; el `title` HTML
  nativo sigue siendo el affordance.
- **Skeleton loading state visual polish** — `RecentChats.tsx` tiene
  un `<Skeleton />` con 3 placeholder rows. Mantiene su estructura,
  sólo cambian los hex a tokens. Animación shimmer (si queremos una)
  cae en 0082.
- **Anti-pattern audits en el resto del app** — este cycle sólo
  evalúa anti-patterns del [Seed/design.md](../Seed/design.md) §13
  aplicables al shell. El audit completo se hace en 0083 final QA.
- **Re-skin de rutas auth (Sign in, Sign up, Reset password)** — no
  usan AppShell (cycle 0051 las excluyó del shell), así que ni se
  tocan aquí. Cuando se re-skinean, es un cycle aparte.

## Done when

- [ ] Todos los `background: <hex>`, `background: "white"`, `border:
  ... #hex`, `color: #hex` en los 6 archivos listados en "Files
  changed" abajo → substituidos por `var(--sp-*)` equivalentes.
- [ ] YourPersonaCard: el style mixto shorthand+longhand de
  `background` eliminado (React warning del 0055 no aparece más en
  console al renderizar /home).
- [ ] Cada row de RecentChats tiene avatar con double-shadow ring
  pattern (`0 0 0 2px var(--sp-bg-1), 0 0 0 3px <accent>`) usando
  `char.accent_color` como origen del accent.
- [ ] Settings button del footer = pill-shaped per kit
  (`border-radius: 999px` + bg `--sp-bg-3` + border `--sp-border`),
  con `--char-accent-soft` tint cuando active.
- [ ] Nav items (Home/Characters/Gallery/Grammar) muestran highlight
  activo usando `--sp-bg-3` de fondo + `--sp-fg` texto + `--sp-radius-md`
  (ya no el `background: #e6e6e6; font-weight: 600` anterior).
- [ ] Topbar mobile (AppShell cuando `!persistent && !isChatRoute`)
  bg = `--sp-bg-1` + borde bottom = `--sp-border` + hamburger text =
  `--sp-fg`.
- [ ] Drawer container (AppShell cuando `!persistent && drawerOpen`)
  bg = `--sp-bg-1` (match sidebar), backdrop `--sp-overlay`.
- [ ] `npx tsc --noEmit` verde.
- [ ] Playwright verde en L=1440×900 **y** S=375×812.
- [ ] 0 console errors NEW; las 2 warnings del React shorthand
  background (pre-existentes en YourPersonaCard, cycle 0055) ya **no
  aparecen** — este cycle las fixea como efecto colateral.

## Shape of the change

### Frontend

**MOD `frontend/src/features/shell/Sidebar.tsx`** — migrar
inline-styles a tokens:

- Root `<nav>`: `background: "#fafafa"` → `var(--sp-bg-1)` +
  `borderRight: "1px solid #e0e0e0"` → `1px solid var(--sp-border)`.
- Header row: `borderBottom: "1px solid #e0e0e0"` → `var(--sp-border)`.
  Wordmark `<strong>`: `color: var(--sp-fg)` inherited; font puede
  quedar con default (SF Pro Text 700 via token).
- `iconBtnStyle` (collapse/close button): añadir `color: var(--sp-fg-2)`
  + hover `color: var(--sp-fg)` (transición 120ms `var(--sp-ease)`);
  bg sigue transparent.
- `itemStyle(active)`: `background: "#e6e6e6"` → `var(--sp-bg-3)` +
  `borderRadius: var(--sp-radius-md)` (10px) + padding interno
  ajustado para que el radius se note. Text `color: inherit` se queda
  (el body color es `--sp-fg`).
- `settingsBtnStyle`: `border: "1px solid #d0d0d0"` →
  `var(--sp-border)` + `background: "white"` → `var(--sp-bg-3)` +
  `background` active → `var(--char-accent-soft)` + `border-radius:
  8` → `var(--sp-radius-pill)` (999) per DesignSystem convention
  para footer button; `color: var(--sp-fg-2)` → `var(--sp-fg)` when
  active.
- Footer wrapper: `borderTop: "1px solid #e0e0e0"` → `var(--sp-border)`.

**MOD `frontend/src/features/shell/AppShell.tsx`** — topbar + drawer:

- Drawer container: `background: "#fff"` → `var(--sp-bg-1)` (match
  Sidebar root, so the drawer is visually one piece with the nav).
- Backdrop: `background: "rgba(0,0,0,0.4)"` → `var(--sp-overlay)`
  (= `rgba(13, 10, 21, 0.72)`).
- `<header data-testid="shell-topbar">`: `background: "#fff"` →
  `var(--sp-bg-1)` + `borderBottom: "1px solid #e0e0e0"` →
  `var(--sp-border)` + hamburger button `color: var(--sp-fg)` +
  wordmark `<strong>` hereda body color.

**MOD `frontend/src/features/shell/YourPersonaCard.tsx`** —
migrar + fix shorthand bg bug:

- `sectionLabelStyle`: `color: "#777"` → `var(--sp-fg-3)` (la clase
  `.sp-section-label` del token file ya encapsula este patrón; usar
  className en lugar de inline si es viable; si no, inline con tokens).
- `cardStyle`: `background: "white"` → `var(--sp-bg-2)` + `border:
  "1px solid #d7d3e8"` → `var(--sp-border)` + `borderRadius: 10` →
  `var(--sp-radius-md)`.
- Avatar fallback: **fix del warning 0055** — reemplazar
  `background: photoUrl ? "#f0f0f0" : "#6750c4"` (shorthand) +
  `backgroundImage`/`Size`/`Position` (longhands) por:
  - Siempre `backgroundColor: photoUrl ? "var(--sp-bg-3)" : "var(--sp-brand-1)"`
    (longhand — no colide con backgroundImage).
  - Mantener `backgroundImage`/`Size`/`Position` como están (longhands).
- Chevron `>`: `opacity: 0.55` OK pero explicitar `color: var(--sp-fg-3)`.
- Hint text: `opacity: 0.65` → `color: var(--sp-fg-3)` (tokenized).

**MOD `frontend/src/features/shell/RecentChats.tsx`** — migrar +
añadir accent ring a avatars:

- `<section>` root: `borderTop: "1px solid #e0e0e0"` →
  `var(--sp-border)`.
- `labelStyle`: `color: "#777"` → `var(--sp-fg-3)`.
- `rowStyle`: sin cambio estructural; hover añade
  `background: var(--sp-bg-3)` (no estaba antes — mejora de
  affordance, mantiene neutralidad visual).
- Avatar inline div: mismo fix que YourPersonaCard (separar
  `backgroundColor` de `backgroundImage`). Añadir
  `boxShadow: '0 0 0 2px var(--sp-bg-1), 0 0 0 3px ' +
  (char?.accent_color ?? 'var(--sp-fg-4)')` — doble ring per kit.
  El fallback `#aaa` se migra a `var(--sp-fg-4)`.
- Name span: `fontWeight: 500` se queda (tokens declaran
  `--sp-weight-medium: 500`, mismo número).
- Snippet div: `opacity: 0.6` → `color: var(--sp-fg-3)`.
- Timestamp span: `opacity: 0.55` → `color: var(--sp-fg-4)` (muted).
- Skeleton rows: `background: "#eee"` → `var(--sp-bg-3)`.

**MOD `frontend/src/features/shell/UserSection.tsx`** — migrar:

- `primaryBtnStyle` (Sign in link): `background: "#2a2a2a"` →
  `var(--sp-bg-3)` + `color: "white"` → `var(--sp-fg)` + `border-radius:
  6` → `var(--sp-radius-md)` (10). Este CTA NO recibe el gradient brand
  (per SKILL: gradient solo en wordmark + primary CTA + send button;
  el Sign in del footer no cuenta como primary CTA global — es
  contextual al sidebar).
- `secondaryLinkStyle` (Create account link): `opacity: 0.75` →
  `color: var(--sp-fg-3)`.
- `secondaryBtnStyle` (Sign out): `border: "1px solid #d0d0d0"` →
  `var(--sp-border)` + `border-radius: 6` → `var(--sp-radius-md)` +
  añadir `color: var(--sp-fg-2)`.
- Email span: `opacity: 0.65` → `color: var(--sp-fg-3)`.

**MOD `frontend/src/features/shell/CollapsedUserAvatar.tsx`** —
migrar:

- Link inline: `background: "#ddd"` → `var(--sp-bg-3)` +
  `color: "inherit"` se queda (body = `--sp-fg`).
- Añadir ring sutil: `boxShadow: '0 0 0 2px var(--sp-bg-1)'` para
  que cuando se alinea con la rail el avatar no se pegue al borde
  del nav.

### Backend

Sin cambios.

### Schema

Sin migrations.

### Dependencias

Sin cambios. No hay imports de librerías nuevas. Tokens se resuelven
por CSS custom properties ya instaladas por 0066.

## Verification gates

**Compile:**
- G1: `npx tsc --noEmit` en `frontend/` = 0 errors.
- G2: Vite HMR rebuild limpio tras cada subtarea (revisar stdout por
  warnings nuevos).

**Playwright L = 1440 × 900 (GL-*):**
- GL-a: Nav `/` → sidebar `data-testid="sidebar"` computed `background`
  = `rgb(19, 15, 30)` (= #130F1E = `--sp-bg-1`).
- GL-b: Sidebar computed `border-right-color` resuelve a un token del
  color palette (no más `rgb(224, 224, 224)` = #e0e0e0).
- GL-c: Nav item active (`[aria-current="page"]`) tiene
  `background-color` = `rgb(34, 26, 46)` (= #221A2E = `--sp-bg-3`).
- GL-d: `[data-testid="sidebar-persona-card"]` computed `background` =
  `rgb(26, 20, 36)` (= #1A1424 = `--sp-bg-2`) y border color token.
- GL-e: `[data-testid="recent-chats"]` primer row avatar tiene
  `box-shadow` con 2 rings (longitud string > 30 chars + contiene
  color tokenizado).
- GL-f: `[data-testid="nav-settings"]` (footer) tiene `border-radius`
  = `999px`.
- GL-g: Console: **no React shorthand background warnings** (el bug
  del 0055 queda fixeado). Solo errors pre-existentes aceptables
  (backend `:8000` down).
- GL-h: Nav /characters /settings /chat sin crashes.
- GL-i: Collapse button → sidebar ancho = 64px; CollapsedUserAvatar
  visible con `background-color` tokenizada.

**Playwright S = 375 × 812 (GS-*):**
- GS-a: Topbar computed `background-color` = `rgb(19, 15, 30)` +
  `border-bottom-color` tokenizada.
- GS-b: Hamburger click → drawer abre; drawer container `background-color`
  = `rgb(19, 15, 30)`; backdrop `background-color` = `rgba(13, 10, 21,
  0.72)`.
- GS-c: Dentro del drawer: YOUR PERSONA card, 4 nav items, RECENT
  CHATS label + rows, Settings button, auth footer — todos con
  tokens aplicados (body-colored text sobre bg dark sidebar).
- GS-d: Click backdrop → drawer cierra.

**Regression:**
- GR-a: Grammar snapshot card (cycle 0062) sigue renderizando en /.
- GR-b: Layout toggle (cycle 0053) en /characters sigue funcionando.
- GR-c: Settings two-pane (cycle 0054) en L sigue con aside + outlet.
- GR-d: Chat mobile compact header (cycle 0058) sin regresión.
- GR-e: Reload×3 en /home — tokens aplican idempotentemente.

**Visual:**
- GV-a: Screenshot /home L=1440 — sidebar dark, body dark, nav items
  legibles, RECENT CHATS avatars con ring de color.
- GV-b: Screenshot /home S=375 + drawer abierto — drawer dark, items
  legibles sin islas claras.

## Implementation order (3 subtareas atómicas, verify entre cada una)

### Subtarea 1 — Shell chrome (Sidebar.tsx + AppShell.tsx)

**Scope:** migrar root `<nav>`, header, nav items, Settings footer
button, drawer bg, backdrop, topbar. No toca los sub-widgets (Persona
card / RecentChats / UserSection / CollapsedUserAvatar — se siguen
viendo con sus hex actuales; quedan para subtareas 2 y 3).

**Gate Playwright (L=1440×900 + S=375×812):**
- L: GL-a, GL-b, GL-c, GL-f, GL-i verdes.
- S: GS-a, GS-b (drawer container bg + backdrop), GS-d (backdrop
  cierra) verdes.
- `npx tsc --noEmit` verde.
- Console: no React shorthand warnings NUEVOS (las 2 pre-existentes
  de YourPersonaCard siguen hasta Subtarea 2).

### Subtarea 2 — Persona card skin + shorthand bg fix

**Scope:** YourPersonaCard.tsx + CollapsedUserAvatar.tsx (ambos
relacionados con la identidad del user). Fix del React warning del
0055 por separación `backgroundColor` vs `backgroundImage`.

**Gate Playwright (L=1440×900):**
- GL-d (persona card bg tokenizado) verde.
- GL-g: **Console 0 warnings** del tipo "Updating background
  backgroundPosition/backgroundSize at YourPersonaCard" — el bug del
  0055 queda cerrado.
- Reload /home → el warning no reaparece en re-render.
- Collapse → CollapsedUserAvatar bg tokenizado + subtle ring visible.

### Subtarea 3 — RecentChats + UserSection + full gates

**Scope:** migrar RecentChats.tsx (incluye accent ring en avatars via
double box-shadow pattern del kit) + UserSection.tsx (auth footer).
Después, correr full gates bundle.

**Gate Playwright (L=1440×900 + S=375×812):**
- L: GL-e (avatar ring), GL-h (nav sin crashes), GR-a..e
  (regressions), GV-a (screenshot).
- S: GS-c (drawer sub-widgets), GV-b (drawer screenshot).
- Reload ×3 en /home — tokens estables, fonts estables.
- `npx tsc --noEmit` verde.
- Console: 0 nuevos warnings/errors.

## Cierre del cycle

1. Lanzar **code-review** + **code-simplifier** en paralelo sobre
   el diff (6 archivos). `context7` no aplica (sin APIs externas).
2. Aplicar fixes no-controversiales. Anotar hallazgos + resoluciones
   en Verification.
3. Llenar `## Verification` con outcomes por gate.
4. Commit `feat(0067): skin AppShell + Sidebar + shell widgets with
   design tokens` + Co-Authored-By.
5. Actualizar `SESSION_HANDOFF.md`:
   - Añadir fila `0067 | AppShell skin | ...` a la tabla.
   - Estado actual → "67 cycles shipped" + siguiente Cycle 0068
     (Home re-skin).
   - `[x]` en Cycle 0067 del roadmap.

## Riesgos / notas

- **Avatar double box-shadow con accent color dinámico**: el shadow
  string se computa en runtime a partir de `char?.accent_color` (que
  es un string hex de la DB). Si el character no tiene accent (row
  incompleto), cae a `--sp-fg-4`. El inner ring `2px var(--sp-bg-1)`
  asume que el avatar vive sobre el sidebar bg — si el avatar
  aparece en otro contexto (drawer, collapsed rail) el bg es el
  mismo `--sp-bg-1`, así que el patrón funciona.
- **Settings button como pill vs rectangle**: el DesignSystem lo
  muestra como pill (radius 999). El current Sidebar.tsx lo tiene
  como rectangle (radius 8). Cambio: pill. Es coherente con "pill
  everything" del SKILL. Si el creator prefiere rectangle, revertir
  en <2 lines.
- **Accent ring en User's own persona**: no aplica — nuestras
  personas (tabla `user_personas`) no tienen `accent_color`. Usamos
  bg neutro (`--sp-bg-3`) para el fallback del YourPersonaCard
  avatar y confianza en el brand purple `--sp-brand-1` cuando no
  hay foto. No introducimos ring accent donde no hay señal.
- **`.sp-section-label` class vs inline**: la tokens.css expone una
  class utility con el pattern correcto (`font-size: 12px;
  font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--sp-fg-3);`). Podría usarse via `className` en lugar
  de `style`. Prefiero por ahora migrar con inline tokens — cambio
  más quirúrgico (single-file diff), y se puede consolidar a
  `.sp-section-label` en un cycle de cleanup posterior.
- **Dev server ya corriendo** desde Cycle 0066 — Vite HMR va a
  hot-reload cada archivo tocado. No requiere restart. Verificamos
  gates L y S con el mismo browser session.

## Verification

Shipped 2026-04-20. Todos los gates verdes L=1440×900 y S=375×812.

### Compile

| Gate | Outcome |
|---|---|
| G1: `npx tsc --noEmit` = 0 errors | ✅ exit 0, output vacío |
| G2: Vite HMR clean rebuild | ✅ hot-reload aplicado después de cada subtarea; sin warnings nuevos en dev server stdout |

### Playwright L=1440×900 (GL-*)

| Gate | Outcome |
|---|---|
| GL-a: Sidebar bg = `rgb(19, 15, 30)` (= `--sp-bg-1`) | ✅ |
| GL-b: Sidebar border-right = `rgb(42, 35, 56)` (= `--sp-border`) | ✅ |
| GL-c: Active NavLink Home bg = `rgb(34, 26, 46)` (= `--sp-bg-3`), radius = 10px, color = near-white | ✅ |
| GL-d: Persona card bg = `rgb(26, 20, 36)` (= `--sp-bg-2`), border = `rgb(42, 35, 56)`, radius = 10px | ✅ |
| GL-e: RecentChats avatar boxShadow = `rgb(19, 15, 30) 0px 0px 0px 2px, rgb(74, 74, 74) 0px 0px 0px 3px` (inner ring `--sp-bg-1` + outer ring = character accent_color del DB) | ✅ |
| GL-f: Settings footer (uncollapsed) radius = 999px, bg = `rgb(34, 26, 46)`, border = `--sp-border` | ✅ |
| GL-f-bis (post-fix): Settings footer (collapsed) 42×42 circular, `border-radius: 50%` | ✅ |
| GL-g: **Console 0 React shorthand background warnings** — el bug del cycle 0055 en YourPersonaCard queda fixeado. Único error pre-existente: backend `:8000` down. | ✅ |
| GL-h: Nav /home → /characters → /settings → /chat sin crashes | ✅ |
| GL-i: Collapse button → sidebar = 64px + CollapsedUserAvatar con bg `--sp-bg-3` + ring `--sp-bg-1` | ✅ |

### Playwright S=375×812 (GS-*)

| Gate | Outcome |
|---|---|
| GS-a: Topbar bg = `rgb(19, 15, 30)`, border-bottom = `rgb(42, 35, 56)`, color = `rgb(242, 242, 245)` | ✅ |
| GS-b: Drawer abierto — container bg = `rgb(19, 15, 30)`, backdrop bg = `rgba(13, 10, 21, 0.72)` (= `--sp-overlay`) | ✅ |
| GS-c: Drawer muestra YOUR PERSONA card (avatar con ring) + 4 nav items + RECENT CHATS label + 5 rows con accent ring + Settings pill + auth footer — todos tokenizados | ✅ screenshot `cycle-0067-S-drawer-final.png` |
| GS-d: Click backdrop → drawer cierra | ✅ comportamiento preservado del 0051 |

### Regression (GR-*)

| Gate | Outcome |
|---|---|
| GR-a: Grammar snapshot card (0062) renderiza en / | ✅ `[data-testid="grammar-snapshot"]` presente |
| GR-b: Layout toggle (0053) en /characters | ✅ funcional |
| GR-c: Settings two-pane (0054) en L | ✅ nav "Settings sections" + Outlet |
| GR-d: Chat mobile compact header (0058) | ✅ sin regresión |
| GR-e: Reload×3 en /home tokens estables | ✅ `--sp-bg`, body bg, sidebar bg, persona card bg, avatar ring — idénticos en cada reload |

### Code-review hallazgos + resoluciones

1. **[Conf 88] Settings button collapsed se ve como stadium/capsule, no circle** — fixeado: en `settingsBtnStyle` cuando `collapsed`, override a `width: 40, height: 40, padding: 0, borderRadius: "50%"`. Verificado en Playwright: 42×42 (40 + 2 border), `borderRadius: 50%`, `isSquare: true`. Justificación del tamaño 40: ligeramente mayor que el avatar rail de 32 para mantener la jerarquía del Settings como footer primario.
2. **[Conf 82] Fallback de accent ring invisible (`--sp-fg-4` = #6A657A apenas distinguible de `--sp-bg-1` = #130F1E)** — fixeado: `char?.accent_color ?? "var(--sp-fg-4)"` → `char?.accent_color ?? "var(--sp-border-strong)"` (#3A3050). `--sp-border-strong` tiene mayor contraste sobre `--sp-bg-1` y es semánticamente el token correcto para "stronger border/divider". Característers con accent_color del DB no son afectados.

### Code-simplifier hallazgos

Ninguno. El diff es mecánico (swap hex → token) con una función fix de shorthand bg. Los patrones repetidos (double-ring boxShadow, conditional avatar bg, ellipsis triple) aparecen 2-3 veces — el simplifier validó que extracting a helper produciría código equivalente o ligeramente mayor una vez contado el import/callsite overhead.

### Visual evidence

- `cycle-0067-L-home-subtask1.png` — después de Subtarea 1: shell chrome dark, persona card todavía light (expected, migra en Subtarea 2)
- `cycle-0067-L-persona-card-subtask2.png` — después de Subtarea 2: persona card con bg `--sp-bg-2`, avatar con ring
- `cycle-0067-L-home-final.png` — estado final L: sidebar completo dark + RecentChats con rings accent
- `cycle-0067-S-drawer-subtask1.png` — después de Subtarea 1: drawer dark, widgets internos todavía light
- `cycle-0067-S-drawer-final.png` — estado final S: drawer completo dark + widgets tokenizados + 5 avatars con rings
