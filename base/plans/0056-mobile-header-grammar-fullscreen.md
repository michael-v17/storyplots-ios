---
id: 0056
slug: mobile-header-grammar-fullscreen
status: shipped
created: 2026-04-19
---

# Cycle 0056 — Mobile header unify + Grammar fullscreen + Fix double scroll

## Context

Creator review de la fase estructural pidió tres fixes:
1. **Dos headers en Chat mobile** (AppShell topbar con hamburger + Chat header con back/avatar/name/controls) se siente "raro". PersonaLLM uses un solo header. Merge.
2. **Grammar sidebar cramped en mobile** — actualmente es inline flex sibling del feed, queda muy angosta. Debe ocupar pantalla entera en S/M.
3. **Doble scroll en Chat desktop** — el AppShell outlet container tiene `overflowY:auto` y la feed interna también scrollea. En Chat se ven dos scrollbars verticales (afuera + adentro). Outlet debe no scrollear cuando la ruta es Chat (Chat ya maneja su propio scroll interno).

## Done when

- [ ] En Chat route (`/chat/*`) con bp !== "L": AppShell topbar **no** renderiza. El único header es el de ChatShell, que gana un botón hamburguesa (al inicio, antes del back chevron) que abre el drawer del AppShell.
- [ ] En rutas no-Chat en S/M: AppShell topbar sigue visible como antes.
- [ ] Nuevo `ShellContext` exposes `{ openDrawer: () => void }` desde AppShell. Consumers (ChatShell) llaman `openDrawer()` para mostrar el drawer.
- [ ] Grammar sidebar en bp !== "L": renderiza como **full-screen overlay** (fixed inset 0) con backdrop + close button. En L sigue inline como ahora.
- [ ] AppShell outlet container switch: si la ruta es `/chat/*` → `overflow: "hidden"` (Chat maneja su propio scroll interno); else → `overflow: "auto"` (rutas estáticas como Home/Settings/Gallery lo necesitan para scrollear cuando el contenido excede viewport).
- [ ] `npx tsc --noEmit` verde.
- [ ] Playwright: (a) S viewport 375px en Chat → solo 1 header (el de Chat) con hamburger; click hamburger → drawer abre; (b) S viewport → toggle grammar sidebar → full-screen overlay; (c) L viewport en Chat → hamburger NO visible (sidebar persistent lo reemplaza); (d) L → grammar sidebar inline como antes; (e) L viewport en Chat → una sola scrollbar vertical (la del feed), no doble.

## Shape of the change

### Frontend

**MODIFY `features/shell/AppShell.tsx`**:
- Create `ShellContext` exporting `{ openDrawer: () => void }`.
- Provide `<ShellContext.Provider>` around the inner tree.
- Hide topbar when `!persistent && isChatRoute` (use `useMatch("/chat/*")`).

**NEW helper `features/shell/useShellDrawer.ts`**:
- `export function useShellDrawer(): { openDrawer: () => void } | null` — consume context.

**MODIFY `features/chat/ChatShell.tsx`**:
- Import `useShellDrawer`.
- In the Chat header, when `bp !== "L"`, render hamburger button (☰) at the start of the header — calls `useShellDrawer()?.openDrawer()`.

**MODIFY `features/chat/GrammarSidebarPanel.tsx`**:
- Accept `mode: "inline" | "overlay"` prop.
- When `overlay`: render as `position: fixed inset: 0 z-index: 60` with backdrop dismiss + close button inside.
- `ChatShell` decides mode: `bp === "L" ? "inline" : "overlay"`.

### Backend / Schema

Sin cambios.

## Verification gates

1. TypeScript clean.
2. Playwright live: S viewport 375px en Chat:
   - Solo 1 header visible (Chat's), con hamburger button.
   - Click hamburger → sidebar drawer slides in.
   - Click grammar toggle → full-screen overlay (fixed cubre viewport, close dismiss).
3. Playwright L viewport 1440px en Chat:
   - Shell sidebar persistent + Chat header (sin hamburger).
   - Grammar toggle → inline panel side-by-side con feed.

## Implementation order

1. `AppShell.tsx` — context + conditional topbar.
2. `useShellDrawer.ts` new.
3. `ChatShell.tsx` — consume context, render hamburger in header on S/M.
4. `GrammarSidebarPanel.tsx` — mode prop + overlay style.
5. `ChatShell.tsx` — pass mode to GrammarSidebarPanel based on bp.
6. Typecheck + Playwright + commit.

## Critical files

- `frontend/src/features/shell/AppShell.tsx`.
- `frontend/src/features/shell/useShellDrawer.ts` (new).
- `frontend/src/features/chat/ChatShell.tsx`.
- `frontend/src/features/chat/GrammarSidebarPanel.tsx`.

## Verification

**TypeScript:** `npx tsc --noEmit` → exit 0.

**Playwright live:**
- ✅ **L (1440×900) en Chat** → `shellHeight = outletScrollHeight = outletClientHeight = 900` (no overflow, no double scroll). Shell topbar no renderizado (isChatRoute), sidebar persistente left + Chat header único right. Screenshot: `cycle-0056-L-no-double-scroll.png`.
- ✅ **S (375×812) en Chat** → 1 solo header (`chat-header`), `shell-topbar` ausente, `chat-sidebar-hamburger` visible al inicio del Chat header antes del back chevron. Screenshot: `cycle-0056-S-single-header.png`.
- ✅ **S → Click chat hamburger** → drawer del AppShell slides in con persona card + nav + RECENT CHATS + Settings footer + Sign out. Via `ShellContext.openDrawer()`. Screenshot: `cycle-0056-S-drawer-from-chat.png`.
- ✅ **S → Toggle grammar sidebar** → `grammar-sidebar[data-mode="overlay"]` con position: fixed inset 0 z-index 56 + backdrop fixed 55 + close × button. Cubre viewport entero. Screenshot: `cycle-0056-S-grammar-overlay.png`.
- ✅ **L → Toggle grammar sidebar** → `grammar-sidebar[data-mode="inline"]` como flex sibling junto al feed (280px width, height 100%).

**Files touched:**
- `features/shell/AppShell.tsx` — new `ShellDrawerContext` + `useShellDrawer` hook; conditional topbar via `useMatch("/chat/*")`; conditional outlet overflow (`hidden` on Chat route, `auto` elsewhere).
- `features/chat/ChatShell.tsx` — consume `useShellDrawer`, render hamburger en Chat header cuando `bp !== "L"` + `shellDrawer != null`. GrammarSidebarPanel gana prop `mode`.
- `features/chat/GrammarSidebarPanel.tsx` — nueva prop `mode: "inline" | "overlay"` + `onClose`. Overlay mode renderiza backdrop fixed + panel fixed inset 0 + close button en header.

**Defferido:** Close grammar overlay tapping backdrop ya lo hace (onClick en backdrop llama onClose); keyboard Esc close — polish a futuro.
