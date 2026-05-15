# Autonomy Contract — StoryPlots iOS

> Reglas de operación para sesiones donde Claude trabaja sin supervisión humana durante varias horas.
> Este documento es el **contrato**. Sin esto, el modo autónomo no procede.

---

## 1. Modo

**Autónomo** significa: el creator no está disponible para aprobar planes, decidir blockers, ni revisar commits hasta su regreso. Claude debe **ejecutar con criterio + dejar trazabilidad** para que la revisión post-facto sea posible.

Cuando el modo autónomo está activo:
- Los `[REVIEW]` markers en el seed se resuelven con el **default documentado** en `seed/open-questions.md` §99 o §1 (defaults).
- Los planes PRP **se auto-aprueban** después de un self-review documentado en el archivo del plan (sección `## Self-review`).
- La revisión humana ocurre **post-facto** sobre los commits, plans, reports, y HANDOFF.md.

---

## 2. Stop conditions (de mayor a menor prioridad)

Claude **debe parar** y escribir a `HANDOFF.md` cuando ocurre cualquiera de:

1. **Critical blocker**: una decisión que viola un non-negotiable de `seed/creator-vision.md §6` o requiere input humano específico no documentado.
2. **Build roto sin fix obvio** después de 3 intentos consecutivos.
3. **3 fallos consecutivos del mismo test** después de fix attempts.
4. **Fin de Phase 2** del roadmap (no avanzar a Phase 3 sin revisión humana — Phase 3 requiere UI y flujos que vale la pena confirmar antes de seguir).
5. **4 horas wall-clock** desde el inicio del modo autónomo.
6. **Acción destructiva ambigua** (e.g. need to delete an entire feature; ser conservador y parar).
7. **Conflicto con el remote** al hacer push (algo externo cambió origin/main).

En cualquiera de estos casos: actualizar `HANDOFF.md` con `STATUS: stopped — <razón>` + commit + push.

---

## 3. Permitido sin pedir

Estas acciones se ejecutan sin pausar a confirmar:

### Código + tests
- Crear/editar archivos en `storyplots/`, `storyplotsTests/`, `storyplotsUITests/`.
- Editar `.claude/PRPs/plans/*.md` y `.claude/PRPs/reports/*.md` (son producidos por Claude).
- Append-only a `seed/open-questions.md` (única excepción de modificar el seed).
- Actualizar `HANDOFF.md` cada N subtasks completadas (mínimo al final de cada fase).
- Crear/editar archivos en `storyplots.xcodeproj/` (project changes).

### Builds + tests
- `xcodebuild build` y `xcodebuild test` con cualquier destination iOS Simulator/iOS 26.x.
- `xcrun simctl *` para controlar simuladores booted (no apagar el iPhone 17 Pro Max booted que ya está corriendo).
- `RenderPreview` via Apple Xcode MCP.

### Git
- `git add <específicos>` (no `git add -A`, no `git add .`).
- `git commit` con mensajes convencionales single-purpose (`feat(scope):`, `fix(scope):`, `chore:`, `test:`, `refactor:`, `docs:`, `style:`).
- `git push origin main` después de cada fase cerrada.
- `git fetch origin` para chequear si remote cambió.

### MCPs
- Apple Xcode MCP (`xcode: xcrun mcpbridge`) — todas las tools.
- XcodeBuildMCP — todas las tools.
- ios-simulator-mcp — todas las tools.
- Serena (`mcp__plugin_serena_serena__*`) — todas las tools de navegación + write_memory para insights.
- context7 — query docs para confirmar Apple API shapes antes de comprometerse.
- Playwright — **solo** si necesita inspeccionar `base/` web vivo (raro en Phase 0-2).

---

## 4. Prohibido (parar y log en HANDOFF.md)

### Seed
- ❌ **NO** editar archivos en `seed/` **excepto** `seed/open-questions.md` (append-only).
- ❌ **NO** crear archivos nuevos dentro de `seed/`.

### Backend / web
- ❌ **NO** modificar nada en `base/`. Es read-only reference. Si necesitás cambio en backend (e.g. nuevo endpoint v2/ios), documentar en `seed/open-questions.md` + crear plan separado + parar.
- ❌ **NO** levantar `base/backend` ni `base/frontend` automáticamente (el modo autónomo no necesita web vivo en Phase 0-2).

### Git destructivo
- ❌ **NO** `git push --force` (ni `-f`).
- ❌ **NO** `git reset --hard` salvo a un SHA local recién creado por el mismo session (rare).
- ❌ **NO** `git branch -D` ni `git checkout` a otra branch (quedate en `main`).
- ❌ **NO** modificar `.git/config` ni hooks.
- ❌ **NO** `git rebase -i` (no interactive).
- ❌ **NO** `--no-verify` en commits.
- ❌ **NO** abrir PRs vía `gh pr create` durante el modo autónomo (esperar revisión humana primero).

### Sistema
- ❌ **NO** instalar plugins de Claude Code (`/plugin install`).
- ❌ **NO** instalar MCPs nuevos (`claude mcp add`).
- ❌ **NO** modificar `.claude/settings.json` (project-level).
- ❌ **NO** `brew install`, `npm install -g`, `pip install` ni gestores de paquetes globales.
- ❌ **NO** `rm -rf` en paths más amplios que un directorio temporal o `~/Library/Developer/Xcode/DerivedData/storyplots-*` específico.

### Datos
- ❌ **NO** Read de `.env`, `.env.local`, `secrets/**`, `.aws/**`, `.ssh/**` (ya denegado en settings.json — confirmar).
- ❌ **NO** hardcodear keys, tokens, URLs de Supabase en código.

---

## 5. Workflow PRP en modo autónomo

```
ciclo por fase:
   1. Leer seed/roadmap.md §Fase N.
   2. Verificar que la fase anterior está done (excepto Phase 0 que no tiene previa).
   3. Escribir .claude/PRPs/plans/NNNN-phase-N-slug.plan.md siguiendo formato CLAUDE.md.
   4. Self-review: sección ## Self-review en el plan que cubre:
      - ¿Cubre todos los exit criteria de seed/roadmap.md §Fase N?
      - ¿Cita seed sections correctas?
      - ¿Liquid Glass gates aplicables incluidas?
      - ¿Subtasks atómicas con Verify ejecutable?
      - ¿Non-negotiables de creator-vision §6 respetadas?
   5. Si self-review pasa: proceder. Si falla: re-escribir plan o parar.
   6. Implementar subtask por subtask, verify entre cada una.
   7. Si una subtask falla 3 veces: parar (Stop condition #3).
   8. Al terminar todas las subtasks: ejecutar el Gate (exit criteria verbatim).
   9. Si Gate pasa: escribir .claude/PRPs/reports/NNNN-phase-N-slug-report.md con:
      - Lo que se hizo (vs lo planeado).
      - Build / test results.
      - Coverage si aplica.
      - RenderPreview snapshots producidos.
      - Liquid Glass acceptance (default + Reduce Transparency).
      - Riesgos materializados.
      - Deuda creada (qué se pospone).
   10. Actualizar seed/roadmap.md row → done con fecha.
   11. Single commit + push:
       feat(phase-N): <scope>
       
       <Resumen 2-3 líneas>
       
       Plan: .claude/PRPs/plans/NNNN-phase-N-slug.plan.md
       Report: .claude/PRPs/reports/NNNN-phase-N-slug-report.md
       
       Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   12. Update HANDOFF.md con resumen + last commit SHA.
   13. Pasar a la siguiente fase pending (si no se cumplió un Stop condition).
```

---

## 6. Manejo de blockers no-críticos

Si encontrás algo que **no** bloquea pero requiere decisión, **no parar**. En su lugar:

1. Append a `seed/open-questions.md` §1 con:
   - Pregunta clara.
   - Origen (fase / subtask donde apareció).
   - Default que aplicaste (la decisión que tomaste para no parar).
   - Cuándo el creator debería confirmar/cambiar (e.g. "antes de Phase X").
2. Documentar en el `.claude/PRPs/reports/` de la fase actual con `BLOCKER-LITE: <id>`.
3. Seguir con el default.

Ejemplos de blockers no-críticos típicos:
- Nombre de un type/protocolo que tiene varios opciones razonables.
- Patrón de logging específico (info vs debug).
- Animation timing exact (e.g. spring response 0.35 vs 0.4).
- Naming de un internal helper.

Ejemplos de blockers **críticos** (parar):
- ¿Bundle ID debe ser X o Y? (no decidir — afecta App Store / signing).
- ¿Apple Sign-In flow se hace via Supabase o custom? (afecta seed §api-contract si cambia).
- Un endpoint del backend no devuelve lo que `seed/api-contract.md` documenta — implica cambio en seed o backend.
- Decisión de UI mayor que no aplica patrones idiomáticos de iOS (e.g. tab bar con > 5 items).

---

## 7. HANDOFF.md — formato

Mantener este archivo siempre actualizado, en root del repo:

```markdown
# Handoff — autonomous run [YYYY-MM-DD HH:MM start]

**Status**: in-progress | completed | stopped
**Phase**: [N] [Name]
**Subtask**: [N.M] [name] — [status]
**Last commit**: [SHA] [message]
**Wall-clock used**: [Xh Ym]

## Done since start
- [phase N.subtask]: brief description
- [phase N.subtask]: brief description

## In progress
[What was being worked on when stopped, if applicable]

## Open-questions appended
- [Q ID]: brief description

## To review when human returns
1. [Highest priority item]
2. [Next item]
3. ...

## Next phase suggested
[N+1] [Name] — ready / blocked-on-X
```

---

## 8. Cómo Claude se autoreporta el progreso

Cada vez que se cierra una fase:
1. Actualizar `HANDOFF.md` completo.
2. Append a una línea en `seed/roadmap.md` §Fase N "Estado" con `✅ Completed YYYY-MM-DD HH:MM by autonomous run, see plan/report`.
3. Single commit.
4. Push.

Cada hora de wall-clock (aprox):
1. Update HANDOFF.md "Wall-clock used".
2. Si llevás > 3 horas sin cerrar una fase: parar al final de la subtask actual + HANDOFF.md con `STATUS: stopped — phase taking longer than expected`. Es señal de over-engineering.

---

## 9. Verificación post-autonomy (cuando el human regresa)

El human revisa:
1. `HANDOFF.md` — qué pasó.
2. `git log --oneline` desde el SHA inicial (lo dejé en HANDOFF.md).
3. Cada plan + report en `.claude/PRPs/` para las fases completadas.
4. `seed/open-questions.md` §1 — nuevas entries (decisiones que tomaste con default).
5. `seed/roadmap.md` — qué fases marcadas done.
6. Spot-check de código en `storyplots/` — patrones, naming, tests.
7. Build + tests locales (no asumir que Claude lo verificó: re-correr).

Si el human encuentra algo mal:
- Revertir el commit ofensivo (`git revert <SHA>` o `git reset` al estado prior).
- Actualizar `seed/open-questions.md` con el corrective default.
- Lanzar una nueva sesión con el aprendizaje aplicado.

---

## 10. Entry prompt para activar modo autónomo

El creator pega esto en la sesión limpia para activar el modo:

```
Activate autonomous mode per AUTONOMY.md.

Run Phase 0 from seed/roadmap.md. Plan → self-review → implement →
verify per Gate → commit (single-purpose) → push to origin/main. Then
proceed to Phase 1 if Phase 0 closed clean. Stop on any condition from
AUTONOMY.md §2 (critical blocker, end of Phase 2, 4h wall-clock, etc.).

Update HANDOFF.md after each phase close AND at stop. Append decisions
taken-with-default to seed/open-questions.md §1.

I'm back at 09:00 local. The first thing I'll read is HANDOFF.md, so
make it count.
```

---

## 11. Cómo este documento se mantiene

Esta es la **primera versión** del contrato de autonomía. Si una sesión autónoma revela gaps (e.g. una situación no cubierta acá), el human los integra acá post-run con un commit `docs(autonomy): clarify <X>`.

El contrato es read-only durante la sesión autónoma — Claude no se da nuevos poderes a sí mismo.
