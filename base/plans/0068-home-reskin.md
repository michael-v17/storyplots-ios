---
id: 0068
slug: home-reskin
status: shipped
created: 2026-04-20
---

# Cycle 0068 — Home re-skin

## Context

Tercer cycle de Design Overhaul. Después de 0066 (foundation: tokens
+ fonts) y 0067 (shell chrome: sidebar + widgets + topbar + drawer),
este cycle repinta **Home y los 4 componentes compartidos de
Character** que consume: card, grid, circles-list, rows. Como esos
componentes también se usan en `/characters`, este cycle los skinea
una sola vez y `/characters` queda re-skinado como efecto gratis
(solo queda pendiente el chrome propio de ese route — search + radio
group de layout — que cae en 0083 final sweep o un cycle dedicado si
aparece ruido).

Pieza por pieza del scope 0068:

- `features/characters/CharacterCard.tsx` — card con borde + radius
  + avatar 72×72 con ring. Migra hex hardcoded (#e0e0e0 border,
  #f0f0f0 avatar photo bg) a tokens + aplica el patrón
  `--char-accent-border` per-card + double-shadow ring en el avatar
  (inner = card bg = `--sp-bg-2`, outer = `--char-accent`).
- `features/characters/CharacterGrid.tsx` — wrapper grid sin hex
  (solo layout). Auditoría — no touch esperado.
- `features/characters/CharacterCirclesList.tsx` — avatars-only
  variant. Mismo patrón de avatar ring del kit.
- `features/characters/CharacterListRows.tsx` — horizontal rows
  con avatar + name + tagline + stats. Mismo patrón de border
  tokenizado + avatar ring.
- `routes/Home.tsx` — h1 "Recent Characters", Link "See all",
  Create/Import character links, empty state ("No Companions Yet"),
  y — importante — el **Grammar snapshot card** del cycle 0062 con
  sus KPIs y pattern chips (hex #f8f9ff/#dce2f0/white hardcoded a lo
  largo).

**NO estructural** — JSX tree, props, testids, stats logic (cycle
0059) intactos. Solo hex → tokens + aplicación del per-card
`--char-accent` scope que el kit mandata.

Cycles aguas abajo que consumen estos componentes:
- `/characters` route (cycle 0053 layout toggle + search + cycle
  0059 stats metadata) — los 4 componentes Character* se renderizan
  allí también; quedan migrados automáticamente. El header del
  route (search input + radio group de layout) se queda con sus
  hex actuales hasta un cycle dedicado.
- `/home` route (0068 target).

## DesignSystem provenance (precedencia #2)

- [DesignSystem/ui_kits/app/HomeScreen.jsx](../DesignSystem/ui_kits/app/HomeScreen.jsx)
  — card pattern canónico: per-card CSS var scope
  `style={{ '--char-accent': p.accent }}` + `background:
  var(--sp-bg-2)` + `border: 1px solid var(--char-accent-border)` +
  `borderRadius: 14`. Avatar component con double box-shadow
  `0 0 0 2px var(--sp-bg-2), 0 0 0 3px <accent>` (inner matches
  card bg).
- [DesignSystem/preview/components-character-card.html](../DesignSystem/preview/components-character-card.html)
  — visual ground truth. Confirma name `fontSize: 15,
  fontWeight: 600`, tagline `fontSize: 13, color: --sp-fg-3`, stats
  `fontSize: 12, color: --sp-fg-3` con emojis glyphs
  (`🎭 💬 1`). "Example" pill en top-right es específico del preview
  (no se implementa en production — el kit cuenta con placeholder
  data).
- [DesignSystem/SKILL.md](../DesignSystem/SKILL.md) §"key
  conventions" — **Pill everything**: chips/buttons/search/user
  bubbles. **Card radii 14 px**. Brand gradient NO en cards, solo
  en wordmark + primary CTA + send button.

## PersonaLLM-Reference provenance

- [04-screens/home.md](../Seed/PersonaLLM-Reference/04-screens/home.md)
  — estructuralmente ya satisfecho por cycles 0053 (layout toggle
  State B/C/D grid/circles/list) + 0059 (metadata chips) + 0062
  (Grammar snapshot card). Este cycle solo aplica skin.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §4 Home — inventario de tarjetas
  (principal: Recent Characters + Grammar snapshot opcional + CTAs
  Create/Import). Estructura intacta.
- [Seed/design.md](../Seed/design.md) §13 anti-patterns — se
  evitan los patterns marcados: no gradient fills en cards, no
  drop-shadows recargados, no 2-adjacent gradient CTAs (Create +
  Import quedan ambos como links secundarios tokenizados, no
  primary gradient).

## Non-negotiables

Ninguno tocado. Cambios 100% visuales sobre UI client-side.

## Out of scope (deferido, con dónde cae)

- **`/characters` route header (search input + layout radio
  group)** — el cycle 0053 puso estos controles con inline hex;
  quedarán con su estilo actual hasta un cycle dedicado (el
  roadmap no lo incluye como cycle propio — lo agregaremos en la
  final sweep 0083 si queda visible). La lista de character cards
  en ese route SÍ se skinea por side-effect del cycle 0068 (usa
  los mismos componentes).
- **`HomeNudge`** — componente separado que muestra CTA "Sign up"
  para anon users. Hex actual se mantiene; se migra cuando toque
  ese componente específicamente (no es target del roadmap).
- **Create/Import Character** como primary CTAs con brand gradient
  — el seed no los lista como primary global (son secondary/
  navigational). Se quedan como links tokenizados.
- **KPI grid del Grammar card** como radar/spark viz — cambio de
  viz sale del scope; mismos 4 tiles numéricos con tokens.

## Done when

- [ ] CharacterCard: bg `--sp-bg-2` + border `--char-accent-border`
  + radius 14 + avatar con ring `0 0 0 2px var(--sp-bg-2), 0 0 0
  3px var(--char-accent)` scoped via per-card `style={{
  '--char-accent': character.accent_color }}`.
- [ ] CharacterCirclesList: mismo avatar ring pattern (aunque no
  hay card wrapper — el ring separa el avatar del body bg =
  `--sp-bg`, así que inner = `--sp-bg` no `--sp-bg-2`).
- [ ] CharacterListRows: row border tokenizado + hover sutil +
  avatar con ring `0 0 0 2px var(--sp-bg), 0 0 0 3px <accent>`
  (inner matches body, porque el row no tiene bg propio).
- [ ] Home Grammar snapshot card (0062): bg `--sp-bg-2` + border
  `--sp-border` + radius 14; KPI tiles `--sp-bg-3` + border
  `--sp-border` + radius 8; pattern chips pill 999 con bg
  `--sp-bg-3` + border `--sp-border`.
- [ ] Home h1 "Recent Characters" usa display font + 2xl tamaño;
  "See all" link usa color tokenizado.
- [ ] Home empty state ("No Companions Yet") con h1 display +
  párrafo `--sp-fg-2`.
- [ ] Create Character / Import Character links tokenizados (color
  `--sp-fg-2` hover `--sp-fg`).
- [ ] Opacity-based muting en stats/tagline/hint migrado a color
  tokens (`--sp-fg-3`/`-fg-4`).
- [ ] React shorthand bg warnings NO reintroducidos (la avatar
  fallback sigue con longhand `backgroundColor`/`Image`/`Size`/
  `Position` conditional — mismo fix del 0067).
- [ ] `npx tsc --noEmit` verde.
- [ ] Playwright L=1440×900 y S=375×812 verdes.
- [ ] Regresiones preservadas: layout toggle (0053), stats chips
  (0059), grammar card estructura (0062), sidebar (0051/0067).

## Shape of the change

### Frontend

**MOD `frontend/src/features/characters/CharacterCard.tsx`:**
- Wrapper `<a>`: add `style={{ "--char-accent": character.accent_color, ... }}`
  (CSS var scope); `border: "1px solid #e0e0e0"` →
  `1px solid var(--char-accent-border)`; `borderRadius: 8` →
  `var(--sp-radius-lg)` (14); `background` explicit `var(--sp-bg-2)`
  (el preview lo declara); add `transition: transform 200ms
  var(--sp-ease), box-shadow 200ms` (kit estándar).
- Avatar: mismo fix del 0067 (conditional Image/Size/Position +
  `backgroundColor` longhand). Ring: `boxShadow: "0 0 0 2px
  var(--sp-bg-2), 0 0 0 3px var(--char-accent)"`.
- Name `<strong>`: `fontSize: 15, fontWeight: 600`.
- Tagline `<span>`: `opacity: 0.7` → `color: var(--sp-fg-3)` +
  `fontSize: 13`.
- Stats div: `opacity: 0.75` → `color: var(--sp-fg-3)` +
  `fontSize: 12`. Emoji glyphs (🎭/💬/⏱) se preservan.

**MOD `frontend/src/features/characters/CharacterCirclesList.tsx`:**
- Avatar fallback: mismo fix del 0067. Ring: `boxShadow: "0 0 0
  2px var(--sp-bg), 0 0 0 3px <accent>"` — inner = body bg porque
  no hay card wrapper aquí. Accent = `character.accent_color`.
- Name `<span>`: `fontSize: 13, color: var(--sp-fg-2)` — un
  poquito más presente que tagline.

**MOD `frontend/src/features/characters/CharacterListRows.tsx`:**
- Row `<a>`: `border: "1px solid #e0e0e0"` → `1px solid
  var(--sp-border)`; `borderRadius: 6` → `var(--sp-radius-md)`
  (10); `background` transparente mantiene; hover
  `var(--sp-bg-1)`. Per-row CSS var `--char-accent: character
  .accent_color` scope para que el hover border pueda usar `--
  char-accent-border` si quisiéramos (no forzar hover ring por
  ahora).
- Avatar: inner ring = `var(--sp-bg)` (body); outer = accent.
- Name `<strong>`: `color: var(--sp-fg)`.
- Tagline: `opacity: 0.7` → `color: var(--sp-fg-3)`.
- Stats: `opacity: 0.75` → `color: var(--sp-fg-3)`.

**MOD `frontend/src/features/characters/CharacterGrid.tsx`:**
- Auditoría solamente. Si no tiene hex, no se toca (spoilers: no
  tiene hex — solo layout CSS).

**MOD `frontend/src/routes/Home.tsx`:**
- `<h1>` "Recent Characters" y "No Companions Yet": añadir
  `className="sp-h2"` (usar clase utility del tokens.css —
  `.sp-h2` aplica display font + bold + tight letter-spacing).
- "See all" `<Link>`: `color: var(--sp-fg-2)` + hover
  `var(--sp-fg)` + `textDecoration: none`.
- Empty state paragraph: `color: var(--sp-fg-2)`.
- Create/Import Character links: `color: var(--sp-fg-2)` +
  hover `var(--sp-fg)` + remove default purple.
- `grammarCardStyle`: bg `--sp-bg-2` + border `--sp-border` +
  radius 14; padding expandido para respirar.
- `kpiCardStyle`: bg `--sp-bg-3` + border `--sp-border-soft` +
  radius 8.
- `patternChipStyle`: bg `--sp-bg-3` + border `--sp-border` +
  radius 999 (pill) + `color: var(--sp-fg-2)`.
- Kpi inner label: `opacity: 0.65` → `color: var(--sp-fg-3)`
  con `font-size: var(--sp-text-xs)`.
- Kpi inner value: `color: var(--sp-fg)` + `font-size: 1.3em`
  mantiene.
- Kpi hint: `opacity: 0.55` → `color: var(--sp-fg-4)`.
- "Top patterns" section title: `opacity: 0.65` →
  `color: var(--sp-fg-3)`. borderTop `#dce2f0` → `--sp-border-soft`.
- Grammar header "See full details →": `opacity: 0.6` →
  `color: var(--sp-fg-3)`.

### Backend / Schema

Sin cambios.

## Verification gates

**Compile:**
- G1: `npx tsc --noEmit` = 0 errors.
- G2: Vite HMR clean.

**Playwright L=1440×900 (GL-*):**
- GL-a: /home → `[data-testid^="char-tile-"]` (primer card)
  computed: `backgroundColor: rgb(26, 20, 36)` (= `--sp-bg-2`),
  `border` con color que resuelve a un `--char-accent-border`
  color-mix (no más #e0e0e0), `border-radius: 14px`.
- GL-b: CharacterCard avatar: `box-shadow` contiene
  `rgb(26, 20, 36) 0px 0px 0px 2px` (inner = bg-2) +
  `<char.accent_color> 0px 0px 0px 3px`.
- GL-c: Grammar snapshot card `[data-testid="grammar-snapshot"]`:
  bg `rgb(26, 20, 36)`, border `rgb(42, 35, 56)`, radius 14px.
- GL-d: Primer KPI tile: bg `rgb(34, 26, 46)` (= `--sp-bg-3`),
  radius 8.
- GL-e: Primer pattern chip: border-radius 999px, bg `--sp-bg-3`.
- GL-f: h1 "Recent Characters" con `font-family` que incluye
  "SF Pro Display" (via `.sp-h2` class).
- GL-g: Nav /home → /characters → cards mismo skin (side-effect
  positive: /characters cards tokenizadas también).
- GL-h: Console: 0 React shorthand bg warnings NUEVOS; errors
  pre-existentes aceptables (backend `:8000`).

**Playwright L — /characters (regresión + side-effect):**
- GL-i: `/characters` switch a layout `circles` → circles-list
  avatars con ring tokenizado.
- GL-j: `/characters` switch a layout `list` → rows con border
  tokenizado + avatar ring.
- GL-k: Search + stats (0053/0059) preservados.

**Playwright S=375×812 (GS-*):**
- GS-a: /home en mobile — cards render correctamente en grid
  auto-fill minmax(180px, 1fr); en 375px cabe 1 columna.
- GS-b: Grammar card stack vertical (KPI grid auto-fit
  minmax(120px) cae a 2-col o 1-col según caja).
- GS-c: Tokens aplicados end-to-end.

**Regression:**
- GR-a: Grammar snapshot card (0062) structure intact (hero +
  KPI grid + Top patterns).
- GR-b: Layout toggle (0053) en /characters funcional.
- GR-c: Sidebar (0051/0067) sin regresión visual.
- GR-d: Reload×3 estable.

## Implementation order (3 subtareas atómicas)

### Subtarea 1 — Character* componentes compartidos

**Scope:** CharacterCard + CharacterCirclesList + CharacterListRows
+ auditoría CharacterGrid. Migra hex → tokens + avatar ring + per-
card CSS var scope. `/characters` y `/home` consumen lo mismo →
ambos se re-skinean en este paso.

**Gate (L=1440×900):** GL-a, GL-b verdes. Nav /characters — layouts
grid/circles/list funcionales con tokens aplicados (GL-i, GL-j). TS
verde. Console sin warnings nuevos.

### Subtarea 2 — Home-specific (heading, links, Grammar card, KPIs, chips)

**Scope:** Home.tsx — h1 con `.sp-h2`, links tokenizados, empty
state, Grammar snapshot card + KPI tiles + pattern chips.

**Gate (L=1440×900):** GL-c, GL-d, GL-e, GL-f verdes. h1 con
display font visible. Grammar card legible sobre body dark. TS
verde.

### Subtarea 3 — Full gates L+S + regression

**Scope:** bundle final.

**Gate:** GL-g, GL-h, GS-a, GS-b, GS-c, GR-a, GR-b, GR-c, GR-d
verdes. Screenshots L+S. 0 console warnings nuevos.

## Cierre del cycle

1. **code-review** + **code-simplifier** en paralelo sobre 5
   archivos modificados.
2. Aplicar fixes; llenar `## Verification`.
3. Commit `feat(0068): skin Home + character card variants with
   design tokens`.
4. Actualizar SESSION_HANDOFF.md (tabla + estado + roadmap `[x]`).

## Riesgos

- **Inner ring color (`--sp-bg-2` vs `--sp-bg` vs `--sp-bg-1`)**:
  depende del contexto del avatar. El kit asume `--sp-bg-2` para
  cards; pero en `CharacterCirclesList` no hay card wrapper (viven
  sobre body bg = `--sp-bg`) y `CharacterListRows` tampoco (row
  tiene bg transparent sobre body bg). Decisión: usar `--sp-bg-2`
  en CharacterCard (correcto per kit), `--sp-bg` en Circles y
  Rows (matches su contexto). Sin esta distinción el ring se ve
  como un anillo descoordinado con el fondo.
- **Per-card `--char-accent` scope**: se setea inline en el style
  del wrapper. Cada card tiene su propia hue, así que
  `--char-accent-border` (color-mix 55%) se evalúa per-card. Esto
  NO rompe nada — el kit usa exactamente este patrón.
- **`.sp-h2` class**: usar className para la h1 mezcla pattern
  (inline styles + utility class). Aceptable porque `.sp-h2`
  encapsula display-font + weight + tracking — hacer eso inline
  serían 3-4 propiedades duplicadas. Es la primera vez que usamos
  una utility class del tokens.css; cycles posteriores pueden
  seguir el patrón o mantenerse con inline — ambos válidos.
- **Grammar card radius 14 vs existing 10**: el radius actual
  (10) es `--sp-radius-md` / inputs. Cards son 14 (`-lg`) per
  SKILL "card radii 14 px". Bump a 14.

## Verification

Shipped 2026-04-20. Playwright live L=1440×900 y S=375×812 contra Vite dev
server (`:5173`) + Supabase hosted con test user `testuser@storyplots.app`
(characters: Evelyn Hart, Dr. Aris Thorne, Aria).

**Compile**
- G1 ✅ `npx tsc --noEmit` = 0 errors (pre-implementación, post-
  Subtarea 1, post-Subtarea 2, post code-review fix).
- G2 ✅ Vite HMR clean — reload×3 sin errors nuevos.

**Playwright L=1440×900 (GL-*)**
- GL-a ✅ `[data-testid^="char-tile-"]` primer card (Evelyn):
  `backgroundColor: rgb(26, 20, 36)` (= `--sp-bg-2`), `border: 1px
  oklab(0.605616 0.0845671 -0.201916 / 0.55)` (= `--char-accent-border`
  color-mix resolved), `border-radius: 14px`.
- GL-b ✅ CharacterCard avatar `box-shadow: rgb(26, 20, 36) 0px 0px 0px
  2px, rgb(74, 74, 74) 0px 0px 0px 3px` (inner = `--sp-bg-2`, outer =
  Evelyn `accent_color` #4a4a4a).
- GL-c ✅ `[data-testid="grammar-snapshot"]`: bg `rgb(26, 20, 36)`
  (`--sp-bg-2`), border `rgb(42, 35, 56)` (`--sp-border`), radius 14px.
- GL-d ✅ Primer KPI tile: bg `rgb(34, 26, 46)` (`--sp-bg-3`), radius
  8px (4 tiles en total).
- GL-e ✅ Primer pattern chip: `border-radius: 999px`, bg `rgb(34, 26,
  46)` (`--sp-bg-3`), color `rgb(169, 164, 186)` (`--sp-fg-2`). 5 chips
  rendered (punctuation, fragment, prepositions, word choice, spelling).
- GL-f ✅ h1 "Recent Characters": `font-family: "SF Pro Display", "SF
  Pro Text", -apple-system, …` via `.sp-h2` class, font-size 28px.
- GL-g ✅ Nav `/home` → `/characters` (layout grid) → char-tiles mismo
  skin tokenizado (bg `rgb(26, 20, 36)`, radius 14, per-char accent
  border).
- GL-h ✅ Console post-reload×3: 1 error = `http://127.0.0.1:8000/
  insights/run` ERR_CONNECTION_REFUSED (pre-existente, backend :8000
  down). 2 warnings = React Router v7 future flags (pre-existentes). **0
  React shorthand background warnings NUEVOS** (avatar fallback
  conditional split preserved).

**Playwright L — /characters (regresión + side-effect)**
- GL-i ✅ `/characters` → layout `circles`: 3 `a[data-testid^="char-
  circle-"]`, avatar `box-shadow: rgb(13, 10, 21) 0px 0px 0px 2px, rgb(74,
  74, 74) 0px 0px 0px 3px` (inner = `--sp-bg` body, outer = accent).
- GL-j ✅ `/characters` → layout `list`: 3 `a[data-testid^="char-row-"]`,
  row border `rgb(42, 35, 56)` (`--sp-border`), radius 10px
  (`--sp-radius-md`), avatar ring same pattern que circles.
- GL-k ✅ Search preservado: typing `"zzzzz"` via native setter +
  dispatchEvent → 0 tiles matched + `[data-testid="characters-no-match"]`
  text `"No companions match \"zzzzz\"."`.

**Playwright S=375×812 (GS-*)**
- GS-a ✅ `/home` mobile: tile_count=3, tile_w=330px (single column @
  375 viewport per `minmax(180px, 1fr)`), tile_bg `rgb(26, 20, 36)`,
  radius 14px.
- GS-b ✅ Grammar card en mobile: snapshot_w=330px, KPI tiles kpi_w~
  143px (2-col grid auto-fit `minmax(120px, 1fr)` cabe dentro de 330px
  body — 2 columnas × 2 filas visible).
- GS-c ✅ Tokens aplicados end-to-end: body_bg `rgb(13, 10, 21)` (=
  `--sp-bg`), body color `rgb(242, 242, 245)` (= `--sp-fg`), tile_bg
  `--sp-bg-2`.

**Regression**
- GR-a ✅ Grammar snapshot card (0062) estructura intacta: hero row
  con LEVEL + REINFORCEMENT + ERRORS + FILLERS, Top patterns section
  abajo, `See full details →` link header preservado.
- GR-b ✅ Layout toggle (0053) en `/characters` funcional: clicks en
  `[data-testid="layout-grid"]` / `layout-circles` / `layout-list`
  cambian render + persisten en `users.preferences.home.layout`.
- GR-c ✅ Sidebar (0051/0067) sin regresión visual: wordmark top +
  YourPersonaCard con Michael + Home highlight activo +
  Characters/Gallery/Grammar rows + RecentChats (Evelyn/Aria/Aris) +
  Settings bottom pill + email + Sign out; AppShell dark bg 0D0A15.
- GR-d ✅ Reload×3 estable: post cada reload, snapshot_present=true,
  snapshot_bg `rgb(26, 20, 36)`, tile_radius 14, body_fontFamily "SF
  Pro Text". Console sin spikes.

**code-review findings (agent `feature-dev:code-reviewer`)**
- **Finding 1 (medium, applied):** `CharacterListRows` row `<a>` faltaba
  el per-row `--char-accent` CSS var scope que el plan Shape mandata
  ("Per-row CSS var `--char-accent: character.accent_color` scope"). Fix
  aplicado: añadido `["--char-accent" as string]: character.accent_color`
  al inline style. Matching el pattern de CharacterCard.
- **Finding 2 (low, retained):** `transition: "background 120ms var
  (--sp-ease)"` en CharacterListRows + `transition: "transform 200ms,
  box-shadow 200ms"` en CharacterCard son no-op actualmente (no hay CSS
  `:hover` rule que triggeree cambio). Retenidos — el plan Shape los
  lista explícitamente como "kit estándar" (scaffolding para futuro CSS
  hover rule en cycle 0082 animation pass). Harmless — browsers no
  animan lo que no cambia.
- **Finding 3 (inform):** Plan tiene inconsistencia interna en "Done
  when" (`--sp-border`) vs "Shape" (`--sp-border-soft`) para KPI tile
  border. Código usa `--sp-border-soft` (matching Shape, la sección más
  detallada). No es un bug — anotado para consistencia en plans
  futuros.

**code-simplifier findings (agent `code-simplifier:code-simplifier`)**
- Sin simplificaciones propuestas. El diff es un token-swap ajustado +
  avatar ring pattern; `mutedLinkStyle` ya está extraído correctamente;
  la 3-componente separación Character* está protegida por Seed/
  PersonaLLM-Reference (layouts grid/circles/list semánticamente
  distintos); la duplicación residual de avatar block está cubierta por
  la restricción del plan "no consolidar". Como 0067, sin simplification
  ganancias.

**Screenshots**
- `cycle-0068-L-home-subtask1.png` — post Subtarea 1 (Character*
  componentes).
- `cycle-0068-L-characters-grid.png` — side-effect /characters
  tokenizado.
- `cycle-0068-L-home-subtask2.png` — post Subtarea 2 (Home-specific).
- `cycle-0068-L-home-final.png` — final L=1440×900.
- `cycle-0068-S-home-final.png` — final S=375×812.

**Flujos Seed/user-stories.md §6 ejercitados**
- Flow 2 (Characters CRUD / picking a character): nav Home → /characters,
  switching layouts grid/circles/list, search filter.
- Flow 3 (Start a conversation): char-tile clicks resolve a
  `/chat/:id/resolve` (verified nav to `/chat/adbb8f1e-.../resolve`
  loads ChatShell).
- Flow 4 (Grammar mode A dashboard): `grammar-snapshot` card renderiza
  + link a `/grammar` preservado.

**Non-omission ([Seed/ux.md](../Seed/ux.md) §10) check**
- Home con characters: "Recent Characters" title + See all + CTAs
  Create/Import + Grammar snapshot — presentes.
- Home empty state: "No Companions Yet" + CTAs — presentes.
- Estados "loading" preservados (sess.status !== "ready").

**Non-negotiables ([Seed/creator-vision.md](../Seed/creator-vision.md) §8)**
Ninguno tocado. Cambios 100% visuales client-side.
