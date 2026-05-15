# Plan 0101 — Shell layout: inset content card + transparent sidebar

## Provenance

- Lift estructural del kit `ui-prototype-traveliru-partners/ui_kits/index.html` (líneas 459–482, función `renderScreen`). El patrón Traveliru:
  - Outer `<div display:flex; minHeight:100vh; background:#E6ECEF>` (page bg unificado)
  - Sidebar = `width: 260 / 72`, sobre el outer bg, sin border ni shadow propio (se "funde" con la página)
  - Content wrapper = `margin: 16 16 16 0; marginLeft: <sidebar width>; background: white; borderRadius: 12; boxShadow: tv-shadow-sm; overflow: hidden`
  - Resultado visual: la sidebar parece "detrás" del page bg, el content flota como card inset con respiro.
- Adaptado a tokens dark de StoryPlots:
  - Outer + sidebar usan `--sp-bg` (neutral dark, post-cycle 0100)
  - Content card usa `--sp-bg-2` (elevado), `--sp-radius-lg`, `--sp-shadow-sm`
- Seed/design.md no especifica el shape del shell — el DesignSystem decide forma. El kit JSX (`DesignSystem/ui_kits/app/`) tampoco mostraba este patrón, así que es lift consciente del Traveliru kit con tokens propios.
- Cycle 0067 (AppShell skin) y 0074 (Settings two-pane) son los antecedentes del shell actual; este cycle re-arquitectura la composición sin tocar la lógica de navegación / drawer / persistent toggle.

## Decisiones resueltas

1. **Outer + sidebar comparten bg** (`--sp-bg`, neutral dark). Sin border-right, sin elevation. La sidebar se siente parte del fondo de la página, no un panel diferenciado.
2. **Content card inset**: margin de 16px (top, right, bottom; left = 0 porque pega a la sidebar), `bg: --sp-bg-2`, `border-radius: --sp-radius-lg`, `box-shadow: --sp-shadow-sm`, `overflow: hidden` para que el scroll viva dentro de la card.
3. **Logo dual**: full wordmark cuando expandido, mark-only (ícono solo) cuando colapsado. **El asset reducido lo provee el creador** (path nuevo: `frontend/public/logos/logo-mark.png` o `.svg`); hasta que llegue, fallback al existing `/logos/logo.png` con altura más chica.
4. **RecentChats colapsado** se renderiza como columna de avatars circulares clickeables (no se oculta). Cada avatar es un link a la conversación con tooltip de nombre del char.
5. **Drawer mode (móvil) no se toca** — el drawer es un overlay completo, no usa el inset card pattern.

## Surfaces afectados

- `frontend/src/features/shell/AppShell.tsx` — outer wrapper bg + nuevo content card wrapper alrededor del topbar + outlet
- `frontend/src/features/shell/Sidebar.tsx` — drop bg-1 fill + border-right, transparent / --sp-bg
- `frontend/src/features/shell/RecentChats.tsx` — soportar `collapsed` prop para render avatar-only
- (Pendiente del creador) `frontend/public/logos/logo-mark.{png,svg}` — asset reducido

## Implementation order (4 subtareas, cada una con Playwright assertion)

1. **Content card wrapper en AppShell** — envolver `<header>` topbar + `<Outlet>` en un div con `margin: 16 16 16 0`, `bg: --sp-bg-2`, `radius-lg`, `shadow-sm`, `overflow: hidden`. Outer wrapper bg = `--sp-bg`. Sidebar intacta esta subtask. Assert: en `/` a 1440×900, dos elements visibles (sidebar + card), card tiene `border-radius` ≥ 12 px y `box-shadow` no-none, no hay scroll del outer wrapper.

2. **Sidebar transparente** — quitar `background: var(--sp-bg-1)` y `border-right: 1px solid var(--sp-border)`. La sidebar ahora hereda el outer bg (`--sp-bg`). Verificar que las nav active tints (sp-bg-3 background) siguen siendo visibles contra el nuevo bg circundante. Assert: el sidebar `<nav>` tiene `background-color: rgba(0,0,0,0)` o `--sp-bg` computed; navegación se ve coherente sin border seam.

3. **Logo dual** — agregar lógica condicional: si existe `/logos/logo-mark.png`, usarlo en collapsed; si no, mostrar el actual `/logos/logo.png` reducido (24-28 px). Cuando el asset reducido llegue, swap. Assert: en collapsed state, hay un `<img>` con `height ≤ 32` dentro del header de la sidebar; en expanded, `height ≥ 36` con `Step into stories` tagline visible.

4. **RecentChats colapsado** — agregar prop `collapsed` y branch de render: cuando true, renderizar lista de avatares 32×32 circulares (sin nombre, sin preview). Cada avatar mantiene el `<Link to={chat URL}>` y `title={char.name}` para tooltip. Assert: en collapsed, hasta 5 avatares visibles en columna estrecha; click en uno navega a `/chat/...`; hover muestra title attribute con el nombre.

## Verification (post-implementation)

- Playwright sweep L (1440×900) + S (375×812):
  - Home / Characters / Gallery / Grammar — todos respetan el inset card sin doble scroll
  - Chat (cualquier route `/chat/*`) — su scroll interno funciona dentro de la card sin generar scroll outer
  - Settings sub-routes — la card respeta el padding interno de Settings
  - Drawer mode (S breakpoint) — abre overlay completo, sin regresiones
- `code-review` pass + `code-simplifier` pass
- tsc 0 errors
- testIDs preservados: `sidebar`, `sidebar-backdrop`, `sidebar-hamburger`, `sidebar-collapse`, `nav-*`, `recent-{conversation_id}`

## Risks / Open

- **Doble scroll en routes que ya tenían scroll outer** (Home, Settings, Gallery, Grammar). El nuevo card tiene `overflow: hidden` así que el scroll debe vivir DENTRO de la card. Implementación: el `<Outlet>` wrapper interno mantiene `overflow-y: auto` para esas routes; el card wrapper externo es `overflow: hidden`. Para `/chat/*`, el card wrapper debe permitir el chat handling su scroll (currently `outletOverflow = isChatRoute ? "hidden" : "auto"`).
- **Sidebar visual seam**: sin border-right, en breakpoints donde la card pega a la sidebar (16 px de gap real entre sidebar derecha y card izquierda), el ojo necesita una pista visual de separación. El gap de margin (no hay margin-left en card pero sí marginLeft = sidebar width) crea naturalmente un breath. Si se ve borroso, agregar 1 px de border al card en su lado izquierdo o un sutil shadow ring.
- **Logo reducido**: el creador pegará el asset; mientras tanto el fallback (logo.png redimensionado) puede verse algo apretado. Aceptable para una primera pasada.
- **RecentChats avatares**: la implementación actual usa la signed URL de cada avatar — en collapsed mode con 5 avatares cargando simultáneamente, hay 5 fetches. El IntersectionObserver del Cycle 0096 se aplica en chat MessageImage, no acá. Para sidebar avatars (32 px) no es crítico el lazy-load, pero conviene cachear el signed URL si todavía no se hace.
- **Chat persistente con sidebar**: cuando un chat está activo + sidebar expandida, hay competencia visual (chat bg + sidebar nav active highlight). Verificar que el active state de RecentChats (la conv abierta) sea legible.

## Verification

(A completar después de implementar.)
