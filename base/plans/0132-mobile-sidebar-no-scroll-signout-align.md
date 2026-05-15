# Plan 0132 — Mobile sidebar: no-scroll Recent Chats + Sign out alignment

## Objetivo

Dos fixes del drawer móvil (`Sidebar mode="drawer"`), reportados por el creator:

1. **Recent Chats no debe scrollear en mobile.** Hoy el área media del sidebar
   es `overflowY: auto`; con 4 nav items + 5 recent chats + footer, en un
   viewport de teléfono el contenido desborda y aparece scroll. Debe mostrarse
   **solo la cantidad de recent chats que entra sin scroll**.
2. **"Sign out" se ve desalineado** — parece tener un margen a la izquierda
   respecto de "Settings" y los nav items.

## Diagnóstico

**(1) Scroll:** `Sidebar.tsx` — el `<div>` medio (`flex: 1; overflowY: auto`)
contiene los nav items + `<RecentChats>`. En drawer las filas son más grandes
(`itemStyle` drawer = `0.75rem 1rem` padding, `1.05rem` font) y `RecentChats`
siempre renderiza las 5 conversaciones → desborda → scroll.

**(2) Alineación:** `UserSection.tsx` `rowStyle` usa `padding: "0.5rem 0.75rem"`
+ `gap: "0.75rem"` **siempre**. Pero `itemStyle` de `Sidebar.tsx` — que usan
Settings y los nav items — en drawer usa `padding: "0.75rem 1rem"` + `gap:
"0.85rem"`. El comentario de `rowStyle` dice textual que debe alinear
"pixel-perfect con Settings + the primary nav", pero nunca se actualizó cuando
se agregó el modo drawer a `itemStyle`. Resultado: el ícono de Sign out queda
~4px a la izquierda del de Settings.

## Cambios

`frontend/src/features/shell/UserSection.tsx`:
- `UserSection` recibe un prop nuevo `isDrawer?: boolean`.
- `rowStyle(collapsed)` → `rowStyle(collapsed, isDrawer)`: en drawer usa
  `padding: "0.75rem 1rem"` + `gap: "0.85rem"`, igual que `itemStyle`. (No
  drawer y collapsed: comportamiento idéntico al actual.)

`frontend/src/features/shell/Sidebar.tsx`:
- Pasar `isDrawer` a `<UserSection>`.
- El `<div>` medio: en drawer pasa a `overflow: hidden` + `display: flex;
  flexDirection: column; minHeight: 0` para que `RecentChats` pueda tomar el
  espacio restante. En persistent (desktop) **sin cambios** — sigue
  `overflowY: auto` (desktop tiene espacio y el scroll del sidebar es válido).
- Pasar `fitToHeight={isDrawer}` a `<RecentChats>`.

`frontend/src/features/shell/RecentChats.tsx`:
- Prop nuevo `fitToHeight?: boolean` (solo aplica al render expandido, no al
  `collapsed`).
- Cuando `fitToHeight`: el `<section>` es `flex: 1; minHeight: 0; overflow:
  hidden; display: flex; flexDirection: column`; el label queda fijo arriba y la
  lista va en un `<div ref={listRef}>` con `flex: 1; minHeight: 0; overflow:
  hidden`.
- `useLayoutEffect` + `ResizeObserver` sobre `listRef`: mide `clientHeight`
  disponible y la altura real de la primera fila renderizada (`offsetHeight` de
  un `[data-recent-row]`), calcula `maxRows = max(1, floor(avail / rowH))` y
  slicea `convs`. El loop de medición es estable: la altura del contenedor
  (`flex:1` dentro del panel `position:fixed` de altura definida) no depende de
  cuántas filas se rendericen, y la altura de fila tampoco. `useLayoutEffect`
  evita el flash de "5 filas → sliced".
- Persistent (`fitToHeight` falso): render actual sin tocar.

## Provenance

- Feedback directo del creator (sesión 2026-05-14): "en el mobile en el sidebar
  no debe haber scroll en los recent chats … y alinear el sign out".
- `RecentChats` ya es una superficie del sidebar (cycle 0101 §4); este ciclo
  ajusta solo su comportamiento de altura en drawer. No se omite ninguna
  superficie — las conversaciones que no entran simplemente no se listan en el
  drawer (siguen accesibles desde `/` Home "Recent Characters" y `/characters`).
- `[[feedback_ios_web_app_pattern]]` — el panel drawer es `position: fixed; top
  0; bottom 0` (tokens.css `.sp-drawer-panel`), altura definida → `flex: 1`
  resuelve bien, sin `100vh`/`100dvh`.

## Domain invariants

Ninguno en juego — cambio puramente de layout del shell. Sin schema, sin
prompt-assembly, sin SSE, sin non-negotiables.

## Open questions

Ninguna.

## Implementation order (3 subtareas)

1. **Sign out alignment.** `UserSection` recibe `isDrawer`; `rowStyle` mira el
   flag y matchea el padding/gap de `itemStyle` drawer. `Sidebar` pasa el prop.
   *Verify (Playwright S=375, drawer abierto)*: el `getBoundingClientRect().left`
   del ícono de Sign out === el de Settings (±1px).

2. **No-scroll en RecentChats.** `Sidebar` middle div → `overflow: hidden` +
   flex column en drawer; `RecentChats` gana `fitToHeight` + medición
   `ResizeObserver`/`useLayoutEffect` + slice.
   *Verify (Playwright S=375 drawer)*: el `<nav>` del drawer no tiene scroll
   (`scrollHeight <= clientHeight`); el `<div>` medio tampoco; se ven N filas de
   recent chats con N < 5 y la footer (Persona/Settings/Sign out) visible sin
   scrollear.

3. **Regresión + close-out.** Persistent (L=1440) intacto: middle div sigue con
   `overflowY: auto`, RecentChats muestra las 5, sin medición. Collapsed sidebar
   intacto. `code-review` + `code-simplifier`. tsc 0, 0 console errors. Visual
   sign-off del creator antes de commit (screenshots S drawer + L).

## Verification

**Subtarea 1 (Sign out alignment)**: dos causas, las dos arregladas.
(a) `rowStyle` de `UserSection` no usaba el padding/gap del modo drawer →
`UserSection` recibe `isDrawer`, `rowStyle(collapsed, drawer)` matchea
`itemStyle`. ⚠️ Bug propio: el `replace_all` inicial se salteó el `<button>`
de sign-out — detectado por Playwright (padding 12px), corregido.
(b) **Tras visual review del creator** ("lo veo un poco desalineado"): el ícono
de Sign out estaba hardcodeado en `size={18}` mientras las filas del nav en el
drawer usan `navIconSize = 22` — ícono más chico desplazaba todo el contenido de
la fila y se veía liviano. Fix: `UserSection` deriva `iconSize = isDrawer ? 22 :
18` (= `navIconSize` de Sidebar) y lo aplica a los 3 íconos (LogOut/LogIn/
UserPlus). Verificado Playwright S=375 drawer: las 6 filas
(Home/Characters/Gallery/Grammar/Settings/Sign out) idénticas — `svgLeft: 24`,
ícono `22×22`, `textLeft: 59.59`. Persistent L=1440 sin cambios (`navIconSize` y
el ícono de Sign out ya eran 18 ambos).

**Subtarea 2 (no-scroll RecentChats)**: Playwright en 3 alturas — drawer S=375:
**812px** → nav no scrollea, sección no scrollea, 5 filas (todas entran),
footer visible; **667px** → 2 filas (`listClientH 124 / firstRowH 55 →
floor=2`), no scroll, footer visible; **600px** → 1 fila, no scroll, footer
visible. El slice se ajusta correctamente a la altura. Persistent L=1440:
`middle.overflowY = "auto"` (intacto), 5 filas, sección `display: block` (sin
el layout flex de fit) — comportamiento desktop sin cambios.

**Subtarea 3 (close-out)**: `code-review` 3 findings —
**F1 (ResizeObserver loop) rechazado**: la lista es `flex:1; overflow:hidden`,
su `clientHeight` lo fija el flexbox circundante y NO depende del row count;
`setMaxRows` al mismo valor es no-op de React; los `transform` del drawer no
cambian `clientHeight` → no hay oscilación.
**F2 (measure antes de filas en DOM) auto-rechazado por el reviewer** — el
guard `avail > 0 && rowH > 0` lo absorbe; además el dep `convs` hace re-correr
el efecto cuando las filas montan.
**F3 (padding de filas de RecentChats ≠ itemStyle drawer) fuera de scope** — el
creador pidió específicamente alinear *Sign out*; la alineación horizontal
(`1rem` left) ya matchea, que es lo que importa para el borde izquierdo. El
ritmo vertical de las filas de RecentChats (`0.6rem`) es una inconsistencia
pre-existente, no introducida por este ciclo, y cambiarla afecta la medición
fit-to-height — queda como nota de polish separada.
`code-simplifier` propuso quitar `convs` del dep array del `useLayoutEffect` —
**no aplicado**: el dep es load-bearing (el Sidebar drawer está siempre montado
y renderiza ANTES de que carguen las conversaciones; sin el dep `convs` el
efecto nunca re-corre cuando montan las filas → `maxRows` queda null → no se
slicea). Se reforzó el comentario del efecto para documentar por qué `convs` es
obligatorio. tsc 0 errores, 0 console errors. Visual sign-off del creator antes
del commit (screenshots `cycle-0132-drawer-812.png` + `cycle-0132-drawer-667.png`).
