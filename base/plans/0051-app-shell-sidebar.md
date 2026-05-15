---
id: 0051
slug: app-shell-sidebar
status: shipped
created: 2026-04-19
---

# Cycle 0051 — App shell with persistent sidebar

## Context

El app hoy no tiene shell: cada ruta se auto-layouta y no hay navegación persistente. El seed lo exige explícitamente en [Seed/ux.md](../Seed/ux.md) §2 ("UI shell: left sidebar + top nav bar. No bottom button bar") y §3 (breakpoints S/M/L). PersonaLLM-Reference [04-screens/menu.md](../Seed/PersonaLLM-Reference/04-screens/menu.md) documenta secciones + order del drawer; [11-web-adaptation-notes.md](../Seed/PersonaLLM-Reference/11-web-adaptation-notes.md) §Global strategy + §Per-screen adaptation: Menu documenta el adaptación web (drawer S, collapsible M, persistente L ~280px con collapse a ~64px icon rail).

Este cycle construye SOLO el shell + sidebar + breakpoints. No toca layout interno del Chat (Cycle B) ni Home/Settings nav (Cycle C). No toca estilos visuales — usa los estilos inline actuales; el skin viene en la sesión de diseño.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §2 Navigation model (sidebar + items + user section + account upgrade CTA + open/closed persists per-User).
- [Seed/ux.md](../Seed/ux.md) §3 Breakpoints (S drawer, M collapsible, L persistent).
- [Seed/user-stories.md](../Seed/user-stories.md) story 29 AC (sidebar state persistence per-User).

## PersonaLLM-Reference provenance

- [04-screens/menu.md](../Seed/PersonaLLM-Reference/04-screens/menu.md) §Sections — YOUR PERSONA row, nav links, footer (Settings + Credits; Credits se omite per Seed §2 "What is removed vs PersonaLLM").
- [11-web-adaptation-notes.md](../Seed/PersonaLLM-Reference/11-web-adaptation-notes.md) §Global strategy + §Per-screen adaptation: Menu.
- [02-information-architecture.md](../Seed/PersonaLLM-Reference/02-information-architecture.md) §Top-level navigation surfaces.

## Out of scope (deferido)

- **RECENT CHATS** list dentro del sidebar (PersonaLLM lo tiene; v0 Seed §2 no lo exige como must-have — la sidebar lista rutas top-level, no conversations). Se puede evaluar para un cycle posterior si el creator lo pide. Por ahora, navegar a Chat es vía Home/Characters → character card.
- **Right-pane inspector** en Chat (L) — Cycle B.
- **Cross-device nudge banner** para anonymous ([Seed/ux.md](../Seed/ux.md) §2) — cycle aparte si el creator lo pide; no bloquea el shell.
- Skin visual (dark theme, gradients, pills, animations) — sesión de diseño.

## Done when

- [ ] Cualquier ruta no-auth se renderiza dentro de `<AppShell>` con sidebar visible en L, colapsable en M, drawer en S.
- [ ] Sidebar muestra, en orden: Home / Characters / Gallery / Grammar / Settings. Item "Chat" aparece SOLO cuando la ruta activa es `/chat/...` (highlighted, no es link separado — es indicador de estado).
- [ ] Footer del sidebar: user section (avatar + display name) → click navega a `/profile`. Si el user es anonymous, debajo aparece CTA "Sign up" → `/sign-up`.
- [ ] Hamburger toggle visible en S y M. En L el sidebar tiene un collapse button (280px ↔ 64px icon rail).
- [ ] Estado open/collapsed persiste en `users.preferences.sidebar.collapsed` (boolean). Leer al montar, escribir al togglear (direct-RMW como `memoryPrefs`/`promptEditorPrefs`).
- [ ] Rutas auth (`/sign-in`, `/sign-up`, `/reset-password`) NO usan el shell.
- [ ] `npx tsc --noEmit` verde.
- [ ] Playwright E2E exercises: (a) sidebar visible en L, (b) collapse/expand en L persiste tras reload, (c) drawer abre/cierra con hamburger en S (viewport 375px), (d) highlight correcto del item activo navegando entre Home / Characters / Settings / Grammar, (e) user section con Aria avatar clickeable → /profile, (f) anonymous CTA aparece sin session.

## Shape of the change

### Frontend

**NEW `frontend/src/lib/sidebarPrefs.ts`** — helpers `readSidebarPrefs(preferences) → { collapsed: boolean }` y `saveSidebarCollapsed(userId, collapsed)`. Patrón direct-RMW idéntico a `memoryPrefs.ts`/`promptEditorPrefs.ts`.

**NEW `frontend/src/features/shell/AppShell.tsx`** — layout component:
- CSS grid: `grid-template-columns: auto 1fr` en L/M; `1fr` en S con drawer overlaid.
- Props: ninguno (usa `useContext(SessionContext)` + `useLocation` para active item).
- Interno: lee `sidebarPrefs.collapsed` del `users.preferences` al montar.
- `<main>` renderiza `<Outlet />` de react-router.

**NEW `frontend/src/features/shell/Sidebar.tsx`** — sidebar ui:
- Nav items con `NavLink` de react-router (highlight automático via `isActive`).
- `useIsMobile()` (ya existe, 768px) + nuevo `useIsDesktop()` (≥1025px) hook para los 3 breakpoints.
- En S/M: render como drawer slide-in con backdrop cuando `open`; hamburger button en AppShell header.
- En L: render persistente; collapse/expand button en el header del sidebar.
- UserSection en footer: avatar + display_name del session → navigate `/profile`; si anonymous, muestra "Sign up" CTA abajo.

**MODIFY `frontend/src/App.tsx`** — wrap non-auth routes con `<Route element={<AppShell />}>`:
```tsx
<Route element={<AppShell />}>
  <Route path="/" element={<Home />} />
  {/* ...todas las rutas no-auth... */}
</Route>
<Route path="/sign-in" element={<SignIn />} />
<Route path="/sign-up" element={<SignUp />} />
<Route path="/reset-password" element={<ResetPassword />} />
```

**MODIFY routes que hoy tienen su propio header con "Back to Home" link** (Home.tsx, Characters.tsx, Settings.tsx, GrammarSettings.tsx, etc.):
- Remover los `<Link to="/">← Back</Link>` redundantes (el sidebar los reemplaza).
- Solo en rutas que estén adentro del AppShell.
- Chat conserva su propio header interno (back chevron + avatar + name) — eso es Cycle B.

**NEW `frontend/src/lib/useBreakpoint.ts`** — consolidar `useIsMobile` actual + agregar `useIsDesktop` en un solo hook `useBreakpoint() → "S" | "M" | "L"`. Mantener `useIsMobile` como alias por compat si muchos sitios lo usan.

### Backend

Sin cambios. `users.preferences` ya es JSONB, sidebar state se guarda como subkey.

### Schema

Sin migrations. `users.preferences` existing column.

## Verification gates

1. **TypeScript** — `npx tsc --noEmit` en frontend → 0 errors.
2. **Playwright live (con backend + Vite + Supabase reales):**
   - Gate A: Login como user con session → sidebar visible en 1440px viewport con 6 items. Active highlight en Home.
   - Gate B: Click Characters → highlight se mueve. Click Settings → highlight se mueve. Click Grammar → navega a `/grammar`.
   - Gate C: Click collapse button → sidebar a 64px icon-only. Reload → sigue colapsado (persistence OK).
   - Gate D: Resize a 375px → sidebar desaparece, aparece hamburger. Click hamburger → drawer slide-in con backdrop. Click backdrop → cierra.
   - Gate E: Click user section → navega a `/profile`.
   - Gate F: Sign out → en `/sign-in` NO hay sidebar (shell excluido). Sign in anonymous → sidebar aparece con CTA "Sign up" debajo del user section.
3. **`code-review` agent pass** (subagent `feature-dev:code-reviewer`).
4. **`code-simplifier` agent pass** (subagent `code-simplifier:code-simplifier`).

## Implementation order

1. `useBreakpoint.ts` (new) + refactor sitios que usan `useIsMobile`.
2. `sidebarPrefs.ts` (new).
3. `Sidebar.tsx` (new).
4. `AppShell.tsx` (new) — wrap con `<Outlet />`.
5. `App.tsx` modify — nest routes.
6. Purge "Back to Home" redundante en rutas ya bajo el shell.
7. `npx tsc --noEmit`.
8. Playwright gates A–F.
9. `code-review` + `code-simplifier` en paralelo.
10. Llenar `## Verification` abajo.
11. Commit `feat(0051): app shell with persistent sidebar` + docs commit actualizando SESSION_HANDOFF.

## Critical files

- `frontend/src/App.tsx` (modify — nest routes).
- `frontend/src/features/shell/AppShell.tsx` (new).
- `frontend/src/features/shell/Sidebar.tsx` (new).
- `frontend/src/lib/sidebarPrefs.ts` (new).
- `frontend/src/lib/useBreakpoint.ts` (new).
- `frontend/src/routes/Home.tsx`, `Characters.tsx`, `Settings.tsx`, etc. (purge redundant back links).

## Verification

**TypeScript:** `npx tsc --noEmit` → exit 0 (clean) after all edits.

**Playwright live gates** (frontend `:5173` + backend `:8000` + Supabase real):

- **Gate A — L sidebar visible** ✅. 1440×900 viewport. Snapshot shows `nav[aria-label="Primary"]` with 5 NavLinks (Home/Characters/Gallery/Grammar/Settings) + UserSection (persona="Michael"). Home link `fontWeight: 600`, `bg: rgb(230,230,230)` (active highlight). Screenshot: `cycle-0051-gate-a-L-sidebar.png`.
- **Gate B — Navigation highlight moves** ✅. Click `nav-characters` → nav-home becomes 400/transparent, nav-characters becomes 600/gray. URL changes to `/characters`. Other items remain 400/transparent.
- **Gate C — Collapse persists** ✅. Click `sidebar-collapse` → sidebar width 65px (64 + border), `data-collapsed="true"`. Hard reload → still 65px / collapsed (RMW to `users.preferences.sidebar.collapsed` persisted). Icon-rail shows all 5 items as icons + `[data-testid="persona-link-collapsed"]` avatar button in footer. Screenshot: `cycle-0051-gate-c-collapsed-persisted.png`.
- **Gate D — Mobile drawer** ✅. Resize to 375×812 → persistent sidebar disappears, `[data-testid="shell-topbar"]` appears with hamburger ☰ button. Click hamburger → `[data-testid="sidebar"]` renders as slide-in drawer + `[data-testid="sidebar-backdrop"]` overlay. Click backdrop → drawer + backdrop removed from DOM, topbar persists. Screenshot: `cycle-0051-gate-d-drawer-open.png`.
- **Gate E — User section navigates to /profile** ✅. Click `nav a[href="/profile"]` → URL changes to `/profile`.
- **Gate F — Auth routes outside shell + anon CTA** ✅. Navigate `/sign-in` → `document.querySelector('[data-testid="sidebar"]')` returns `null`, topbar also null. After `localStorage.clear()` + reload `/` → ensureAnonSession creates anon user; sidebar renders with UserSection showing "Sign up to access from anywhere" link (`[data-testid="upgrade-cta"]`). Collapsed rail → `persona-link-collapsed` href becomes `/sign-up`. Screenshot: `cycle-0051-gate-f-anon-cta.png`.

**Code-review (feature-dev:code-reviewer):** 2 findings applied:
1. **`Sidebar.tsx` footer hidden when collapsed** — fixed by new `features/shell/CollapsedUserAvatar.tsx` that renders a 32×32 circular avatar/pictogram button in the icon-rail footer. Links to `/profile` (authenticated), `/sign-up` (anonymous), or `/sign-in` (signed out). Live-verified in Gate C + F.
2. **`useBreakpoint` no debounce** — fixed with `requestAnimationFrame` coalesce in the resize handler; cleanup cancels any pending frame.

One finding (sidebarPrefs RMW identity race) self-retracted by reviewer as pre-existing convention in `memoryPrefs.ts`/`promptEditorPrefs.ts` — not a new regression.

**Code-simplifier (code-simplifier:code-simplifier):** Consolidated duplicated nav-item inline styles (NavLink items + nav-chat-active div) into `itemStyle(collapsed, active)` helper in `Sidebar.tsx`. Byte-identical visual output. `npx tsc --noEmit` still exit 0. No other safe simplifications found.

**Deferred (out of scope, documented):**
- RECENT CHATS list in sidebar — not required by Seed §2; defer until creator requests.
- Right-pane inspector in Chat on L → Cycle B.
- Chat's own internal header restructure → Cycle B.
- Visual skin (dark theme, gradients, pills, animations) → design session.
