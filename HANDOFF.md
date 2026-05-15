# Handoff — autonomous run

**Status**: not-started
**Phase**: —
**Subtask**: —
**Last commit**: 0cf8fca docs(autonomy): add AUTONOMY contract + HANDOFF template
**Wall-clock used**: 0h 0m

## Available external resources (mientras la sesión autónoma corre)

El creator dejó la web vieja corriendo en otra sesión por si la sesión autónoma necesita inspeccionar el comportamiento real:

- **Frontend web**: `http://localhost:5173/` (Vite dev server, sirviendo `base/frontend/`).
- **Backend FastAPI**: `http://localhost:8000/` — endpoints documentados en `seed/api-contract.md` §3.
- **Auth state**: una sesión autenticada está activa en el browser que Playwright abrirá (user logged in, API keys configurados, listo para tests reales contra el backend).

Cómo usarlos correctamente:
- **Playwright MCP** (`mcp__plugin_playwright_playwright__*`) es el camino canónico. Lanzar `browser_navigate http://localhost:5173/...`, tomar snapshots, leer DOM. No requiere setup adicional.
- **NO** usar `curl`/`wget` desde Bash hacia esos ports — el hook `check-port.mjs` los bloquea si el cwd no está en `~/.claude/port-registry.json` (el cwd de este repo no está registrado para ningún port).
- **NO** intentar levantar otro frontend/backend desde `base/` durante la sesión autónoma (ya está corriendo + `AUTONOMY.md` §4 lo prohíbe).
- Si la web cae mid-run (proceso muere por cualquier razón), no intentar revivirla — usar el código de `base/frontend/src/` y `base/backend/app/` directo como referencia, no la versión corriendo.

Para qué fases del roadmap es útil esto:
- Phase 0 / Phase 1: **raramente**. El bootstrap Xcode + auth shell son self-contained en iOS.
- Phase 2 (Home tab) en adelante: útil para verificar comportamiento real del web (e.g. cómo se ve un chat card poblado, qué shape exacto devuelve `/health` con un JWT real, cómo se renderiza el typing indicator).
- Phase 5 (SSE streaming): potencialmente útil para validar la secuencia real de eventos del backend de chat con datos reales.

## Done since start
(none yet — autonomous mode not activated)

## In progress
(none)

## Open-questions appended
(none)

## To review when human returns
(none yet)

## Next phase suggested
Phase 0 — Bootstrap Xcode (from `seed/roadmap.md` §Fase 0)

---

> This file is updated by Claude during autonomous runs per `AUTONOMY.md` §7.
> When the human returns, read this file first.
