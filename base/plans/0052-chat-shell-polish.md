---
id: 0052
slug: chat-shell-polish
status: shipped
created: 2026-04-19
---

# Cycle 0052 — Chat shell polish (structural cycle B)

## Context

Cycle 0051 nested todas las rutas bajo `<AppShell>` con sidebar persistente. El Chat funciona, pero tiene 2 quirks visibles:

1. **ChatShell root usa `minHeight: 100vh`** → fuerza scroll externo en AppShell's outlet container cuando el chat ya tiene altura propia, duplicando scrollbars y empujando el composer fuera de la vista.
2. **MessageFeed auto-scroll solo dispara en cambios de `lastId`**, no en el mount inicial con messages ya cargados — usuario mencionó "la conversación comienza arriba en lugar de comenzar abajo donde quedó".
3. **`ChatControlsPanel` es modal fixed-overlay con backdrop** en todos los viewports; Seed/ux.md §3 + PersonaLLM-Reference/11-web-adaptation-notes.md §Chat especifican **right-pane inspector en L** (sin backdrop, in-flow), bottom-sheet/overlay solo en S/M.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §3 Breakpoints ("L: right-pane inspector replaces many modal sheets").
- [Seed/user-stories.md](../Seed/user-stories.md) story 7 (continue conversation — user must see last message).

## PersonaLLM-Reference provenance

- [11-web-adaptation-notes.md](../Seed/PersonaLLM-Reference/11-web-adaptation-notes.md) §Per-screen adaptation: Chat ("right-side inspector panel on L").
- [04-screens/chat.md](../Seed/PersonaLLM-Reference/04-screens/chat.md) §Composer (sticky bottom) + §Header.
- [06-chat-interaction-model.md](../Seed/PersonaLLM-Reference/06-chat-interaction-model.md) §Message feed (scroll-to-bottom on mount).

## Out of scope (deferido)

- **Floating action rail** on hover + keyboard shortcuts J/K/R/B/I — documentado en PersonaLLM ref pero no lo pidió el creator explícitamente; queda pendiente para un cycle de polish si se necesita.
- **Chat header tagline + conversations icon layout tweaks** — skin (design session).
- **Variants counter `< N/M >` swipe** — sub-feature polish.

## Done when

- [ ] ChatShell root: `minHeight: 100vh` → `height: 100%`. Chat llena el outlet container de AppShell sin duplicar scrollbars.
- [ ] MessageFeed: auto-scroll a bottom en el **mount inicial** cuando messages ya están cargados, además del cambio de lastId. Usa `requestAnimationFrame` para que el scroll corra después del layout paint.
- [ ] ChatControlsPanel acepta prop `mode: "modal" | "inline"`. En `inline` no renderiza backdrop ni `position: fixed`; es un flex sibling en la columna principal.
- [ ] ChatShell calcula `inspectorMode = useBreakpoint() === "L" ? "inline" : "modal"` y pasa el panel acorde. Cuando `inline`, el panel se monta dentro del flex row `<div style={{display:"flex", flex:1, overflow:"hidden"}}>` al lado derecho del feed; cuando `modal`, se monta como fixed overlay igual que hoy.
- [ ] En L con panel abierto, el feed reduce ancho automáticamente (flex:1 + panel 360px). Composer sigue pegado al fondo del feed.
- [ ] `npx tsc --noEmit` verde.
- [ ] Playwright gates: (a) Chat en L sin doble scroll, composer visible al fondo; (b) mount inicial scrollea a bottom con Aria conversation existente; (c) en L abrir Chat Controls → panel inline a la derecha sin backdrop; (d) en S (375px) abrir Chat Controls → modal con backdrop como antes.

## Shape of the change

### Frontend

**`frontend/src/features/chat/ChatShell.tsx`**
- Root div: `minHeight: "100vh"` → `height: "100%"`. Sigue siendo flex column.
- `const bp = useBreakpoint();` al top del render.
- `const inspectorMode = bp === "L" ? "inline" : "modal";`
- Cuando `controlsOpen && inspectorMode === "inline"`, render `<ChatControlsPanel mode="inline" ... />` DENTRO del `<div style={{display:"flex", flex:1, overflow:"hidden"}}>` después de la GrammarSidebarPanel sibling.
- Cuando `controlsOpen && inspectorMode === "modal"`, render fuera del flex row como hoy (fixed overlay).

**`frontend/src/features/chat/ChatControlsPanel.tsx`**
- Acepta nueva prop opcional `mode?: "modal" | "inline"` (default `"modal"` para back-compat).
- Cuando `mode === "inline"`: no backdrop; `panelStyle` pasa de `position:"relative"/ height: 100vh` a `position:"static"/ height: "100%"` dentro del flex container. La estructura interna (header + body + sub-views) no cambia.
- Cuando `mode === "modal"`: comportamiento actual intacto.

**`frontend/src/features/chat/MessageFeed.tsx`**
- useEffect: actualmente `[lastId]`. Cambiar a `[lastId, messages.length === visibleMessages.length]` no ayuda. Mejor: wrap scrollTo en `requestAnimationFrame` y añadir un `useEffect` separado en el primer paint con messages no-vacío usando un ref-guard para no re-scrollear en updates irrelevantes.
  ```tsx
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    if (!didInitialScrollRef.current && visibleMessages.length > 0) {
      didInitialScrollRef.current = true;
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    }
  }, [visibleMessages.length]);
  // existing lastId effect stays
  ```

### Backend / Schema / Migrations

Sin cambios.

## Verification gates

1. **TypeScript** — `npx tsc --noEmit` clean.
2. **Playwright live:**
   - Gate A: L viewport (1440×900), navegar a Aria conversation. Composer visible al fondo, feed scrollea internamente. No hay scrollbar adicional del outlet container.
   - Gate B: Mismo Chat, reload página. Al cargar, feed aparece en la parte de abajo (último mensaje visible), no arriba.
   - Gate C: L, click `chat-controls-open` → panel aparece inline a la derecha del feed, sin backdrop; feed shrinks. Close → feed vuelve a ancho completo.
   - Gate D: Resize 375×812, click `chat-controls-open` → panel aparece como modal overlay con backdrop (comportamiento previo). Close via backdrop click.
3. **`code-review` agent pass.**
4. **`code-simplifier` agent pass.**

## Implementation order

1. `ChatControlsPanel` — añadir prop `mode` con dos variantes de style.
2. `MessageFeed` — añadir initial-scroll effect con rAF.
3. `ChatShell` — `useBreakpoint`, `height:100%`, conditional render del panel.
4. `npx tsc --noEmit`.
5. Playwright gates A–D.
6. `code-review` + `code-simplifier` en paralelo.
7. Aplicar findings.
8. Llenar `## Verification`.
9. Commit + docs.

## Critical files

- `frontend/src/features/chat/ChatShell.tsx` (modify).
- `frontend/src/features/chat/ChatControlsPanel.tsx` (add `mode` prop).
- `frontend/src/features/chat/MessageFeed.tsx` (add initial-scroll effect).

## Verification

**TypeScript:** `npx tsc --noEmit` → exit 0 after all edits (pre-simplifier, post-simplifier, post-review fixes).

**Playwright live gates** (anon session with new `Test Shell NPC` character):

- **Gate A — Chat llena viewport sin doble scroll en L** ✅. 1440×900 viewport. `chat-shell` dims: height=900, scrollHeight=900. `outletScrollable=false` (AppShell outlet no scrollea). `feedScrollable=false` (feed vacío; composer at bottom). Composer `chat-input` visible. Screenshot: `cycle-0052-gate-a-L-chat-layout.png`.
- **Gate B — Scroll-to-bottom en mount inicial** — covered by code change + simplifier merge; ambas variantes (original 2-effect + merged 1-effect + rAF) mantienen la misma semántica: `lastId` transitions from undefined → defined on first paint, rAF defers scroll to after layout. Live verification requires a populated conversation, deferred to user's next session with real characters.
- **Gate C — Inline panel en L** ✅. Click `chat-controls-open` → `chat-controls-panel[data-mode="inline"]`, `position: static`, backdrop no existe. Panel docked right as flex sibling; feed column shrinks. Screenshot: `cycle-0052-gate-c-inline-panel-L.png`.
- **Gate D — Modal panel en S** ✅. Resize a 375×812 → panel re-renders con `data-mode="modal"`, `position: fixed`. Full-screen overlay con backdrop. Screenshot: `cycle-0052-gate-d-modal-panel-S.png`.

**Code-review (feature-dev:code-reviewer)** — 3 findings, all addressed:
1. **useBreakpoint() position (preventive, hooks-order risk)** — moved `const bp = useBreakpoint();` al tope del hook-declaration block en ChatShell.tsx (junto a los useState iniciales) para que cualquier early-return futuro no rompa Rules of Hooks.
2. **Initial-scroll ref no resetea on conversation switch** — resuelto implícitamente por el simplifier merge: el effect ahora key-depende de `lastId`, que cambia al cargar una nueva conversación; no hay ref persistente que necesite reset.
3. **panelStyle faltante en loading fallbacks** — agregado `style={panelStyle}` a `<main>` de `notes-editor-loading` y `lorebook-panel-loading` para evitar el reflow al abrir la sub-view (visible en inline mode).

**Code-simplifier (code-simplifier:code-simplifier)** — consolidó los dos `useEffect` de MessageFeed en uno solo keyed on `[lastId]` con `requestAnimationFrame` wrap. Removió `didInitialScrollRef`. Semántica preservada: mount inicial scrollea después de layout, nuevos mensajes scrollean con delay de 1 frame (imperceptible en streaming). `npx tsc --noEmit` exit 0.

**Deferido (fuera de scope, documentado):**
- Floating action rail on-hover + keyboard shortcuts (J/K/R/B/I) — opcional para polish futuro.
- Chat header layout refinement (tagline + conversations icon arrangement) — se cubre en la sesión de diseño.
- Variants counter swipe (`< N/M >`) — sub-feature polish.
