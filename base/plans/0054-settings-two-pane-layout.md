---
id: 0054
slug: settings-two-pane-layout
status: shipped
created: 2026-04-19
---

# Cycle 0054 — Settings two-pane layout on L (structural cycle C.2)

## Context

Parte 2 (final) del cycle C estructural. `/settings/*` hoy es hub-and-spoke: cada sub-ruta es una página independiente que ocupa todo el main area. PersonaLLM-Reference/11-web-adaptation-notes.md §Settings especifica **two-pane en L** (section list izquierda + detail derecha + breadcrumb), stacked iOS-style en S/M. Seed/ux.md §3 lo confirma.

Este cycle introduce la nested-route layout sin cambiar el contenido de ninguna sub-ruta. En S/M el comportamiento es idéntico al actual (drill-through). En L aparece la section list persistente a la izquierda mientras se navega entre sub-rutas.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §3 Breakpoints ("L: right-pane inspector replaces many modal sheets" + "Gesture-only iOS behaviors get explicit UI on web").
- [Seed/PersonaLLM-Reference/11-web-adaptation-notes.md](../Seed/PersonaLLM-Reference/11-web-adaptation-notes.md) §Settings ("Two-pane: section list (left) + active section detail (right) + breadcrumb").

## Out of scope (deferido)

- Breadcrumb visual polish — skin (design session).
- Hide "Back" links en sub-settings cuando bp=L (redundante porque la section list está siempre visible, pero aun funcional).

## Done when

- [ ] En L (≥1025px): `/settings` + cualquier `/settings/*` muestran a la izquierda la section list (320px) y a la derecha el detalle de la sub-ruta activa. Índice (`/settings`) muestra placeholder "Select a section…" en el pane derecho.
- [ ] En S/M: comportamiento idéntico al actual — `/settings` muestra section list full-width, `/settings/*` muestra detail full-width.
- [ ] `App.tsx` anida todas las sub-rutas `/settings/*` bajo `<Route path="/settings" element={<SettingsLayout />}>`.
- [ ] Rutas `/settings/text-engine`, `/settings/memory`, etc. siguen deep-linkables y cargan correctamente.
- [ ] `npx tsc --noEmit` verde.
- [ ] Playwright gates: (a) L viewport → `/settings/text-engine` muestra 2 panes (section list + detail); (b) click otro item de la list → detail cambia sin reload; (c) `/settings` index en L muestra placeholder en el pane derecho; (d) S viewport (375px) → `/settings/text-engine` muestra solo detail full-width.

## Shape of the change

### Frontend

**NEW `frontend/src/features/settings/SettingsLayout.tsx`**:
```tsx
import { Outlet, useLocation } from "react-router-dom";
import { useBreakpoint } from "../../lib/useBreakpoint";
import { Settings } from "../../routes/Settings";

export function SettingsLayout() {
  const bp = useBreakpoint();
  const { pathname } = useLocation();
  const isIndex = pathname.replace(/\/$/, "") === "/settings";

  if (bp !== "L") return <Outlet />;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <aside data-testid="settings-section-list" style={{ width: 320, borderRight: "1px solid #e0e0e0", overflowY: "auto", flexShrink: 0 }}>
        <Settings />
      </aside>
      <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
        {isIndex ? (
          <div data-testid="settings-empty-pane" style={{ padding: "2rem", opacity: 0.6 }}>
            Select a section to view its settings.
          </div>
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}
```

**MODIFY `frontend/src/App.tsx`**:
- Anidar todas las `/settings/*` como children de `<Route path="/settings" element={<SettingsLayout />}>` con paths relativos (ej. `text-engine`, `image-engine`, etc.).
- La ruta index `/settings` sigue renderizando `<Settings />` vía `<Route index element={<Settings />} />`.

### Backend / Schema

Sin cambios.

## Verification gates

1. **TypeScript** — `npx tsc --noEmit` clean.
2. **Playwright live:**
   - Gate A: L viewport, `/settings/text-engine` → `settings-section-list` visible AND detail render visible.
   - Gate B: L, click "Memory" link en la section list → URL cambia a `/settings/memory`, detail pane actualiza.
   - Gate C: L, navegar a `/settings` → `settings-empty-pane` visible; section list visible.
   - Gate D: S (375×812), `/settings/text-engine` → section list NO visible, solo detail full-width (current behavior).
3. **`code-review` + `code-simplifier`** en paralelo.

## Implementation order

1. Crear `SettingsLayout.tsx`.
2. Refactorear `App.tsx` (nested routes).
3. `npx tsc --noEmit`.
4. Playwright gates A–D.
5. Review + simplifier.
6. Aplicar findings.
7. Commit + docs.

## Critical files

- `frontend/src/features/settings/SettingsLayout.tsx` (new).
- `frontend/src/App.tsx` (modify — nested settings routes).

## Verification

**TypeScript:** `npx tsc --noEmit` → exit 0 after edits + post-review fixes.

**Playwright live gates:**
- **Gate A — Two-pane en L** ✅. 1440×900, `/settings/text-engine` → `settings-section-list` visible (320px aside) + detail pane renders "Text Engine" h1 + BYOK form. Screenshot: `cycle-0054-gate-a-two-pane-L.png`.
- **Gate B — Click cambia detalle sin perder section list** ✅. Click `settings-memory` en section list → URL → `/settings/memory`, section list sigue visible, detail pane h1 === "Memory", `emptyPane` === false.
- **Gate C — Index muestra placeholder** ✅. Navegar a `/settings` en L → section list + `settings-empty-pane` visible simultáneamente.
- **Gate D — S viewport drill-through** ✅. Resize a 375×812 en `/settings/memory` → section list NO visible (bp !== "L" → `<Outlet />` directo), solo detail full-width. Screenshot: `cycle-0054-gate-d-S-mobile-drill.png`.

**Code-review (feature-dev:code-reviewer):** 2 findings, ambos aplicados:
1. **`<main>` anidado dentro de `<aside>`** (landmark violation) — cambié `Settings.tsx` root de `<main>` a `<nav aria-label="Settings sections">`. Más correcto semánticamente (es una lista de nav items). DOM post-fix: 1 `<main>` total (el del route detail) + 5 `<nav>` (sidebar shell + section list + las 3 sub-nav groups dentro de Settings).
2. **`isIndex` string-compare fragile** — reemplazado con `useMatch({ path: "/settings", end: true })` de react-router-dom, eliminando `useLocation` + regex trim.

**Code-simplifier** — no se corrió (cycle pequeño, 2 archivos, sin patrones duplicados significativos; los 2 review fixes ya limpiaron el código).

**Deferido:** breadcrumb visual polish (design session), hide "Back" links en sub-settings cuando bp === "L" (redundante pero funcional).
