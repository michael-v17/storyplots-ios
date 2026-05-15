# CLAUDE.md — StoryPlots iOS

> ECC harness instalado al **project scope** (`.claude/`). Poda aplicada para Swift/iOS:
> agents 25/58, commands 42/74, skills 84/229, rules 4 dirs (común, swift, web) + custom overlay.
> Seed completo en `seed/` (8 archivos verified). Producto spec vive en seed; mecánica de trabajo vive aquí.

---

## Cómo arrancar una sesión

1. **Serena se activa automático** via `SessionStart` hook en `.claude/settings.json`.
2. **Verificar MCPs iOS** (ver `dev-runbook.md` §2):
   ```bash
   claude mcp list
   ```
   Mínimo el #1 conectado: `xcode: xcrun mcpbridge`. Los otros (XcodeBuildMCP, ios-simulator) según necesidad concreta del ciclo.
3. **Leer la rule de seed-precedence** se carga automático (`.claude/rules/seed-precedence.md`, sin `paths:`).
4. **Identificar la fase activa** en `seed/roadmap.md` — encontrar la siguiente `pending` o la `in-progress`.
5. **Leer el plan de la fase si existe** en `plans/NNNN-fase-X-slug.md`.

---

## Source of truth — orden de autoridad

Carga automática vía rules:
1. **`seed/`** — qué construir. Ver precedence en `.claude/rules/seed-precedence.md`.
2. **`.claude/rules/`** — cómo trabajar (genéricas + path-scoped Swift).
3. **`base/`** — referencia operativa (backend código real, frontend para inspección, DesignSystem tokens).

ECC harness (.claude/agents/skills/commands) configura **mecánica**, no producto. Si un agent contradice al seed, gana el seed.

---

## Workflow PRP (canónico)

Cada fase no-trivial corre por este loop. Comandos disponibles en `.claude/commands/`:

```
roadmap.md (siguiente fase pending)
   ↓
/prp-plan <phase-name>           → .claude/PRPs/plans/NNNN-phase-N-slug.plan.md
   ↓ (creator revisa el plan)
/prp-implement <plan-path>       → escribe código + tests; 5-level validation
   ↓
/code-review + /quality-gate
   ↓
/prp-commit "feat(phase-N): scope"
   ↓
/prp-pr                          → abre el PR
   ↓
seed/roadmap.md row → done; Next pointer avanza
```

**Single-commit-per-fase** preservado por `/prp-commit`. Sin WIP commits intermedios.

### Comandos disponibles más usados

| Comando | Cuándo |
|---|---|
| `/prp-plan` | Inicio de cada fase del roadmap |
| `/prp-implement` | Ejecutar un plan aprobado |
| `/prp-commit`, `/prp-pr` | Cerrar fase con commit + PR |
| `/code-review` | Review antes del commit |
| `/quality-gate` | Gate final pre-commit |
| `/feature-dev` | Para implementar features compactos no del roadmap |
| `/refactor-clean` | Cleanup pass |
| `/security-scan` | Audit de seguridad |
| `/test-coverage` | Análisis de coverage |
| `/save-session`, `/resume-session` | Continuidad inter-sesiones |
| `/learn` | Captura de patterns al final de fase |
| `/skill-create`, `/skill-health` | Meta — extender el harness |
| `/ecc-guide` | Lookup del harness mismo |

---

## Agents disponibles (25)

Subagents en `.claude/agents/`. Claude los invoca automático según `description:` o se pueden `@-mencionar` desde autocomplete.

### Específicos iOS / Swift
- **`swift-build-resolver`** — resuelve Xcode build errors (clang, linker, codesign).
- **`swift-reviewer`** — code review específico Swift idioms + concurrency.

### Generales relevantes
- `a11y-architect` — accessibility planning + audit.
- `architect`, `code-architect` — decisiones arquitectónicas.
- `code-reviewer`, `code-simplifier`, `refactor-cleaner` — quality.
- `code-explorer` — exploración semántica.
- `database-reviewer` — Supabase / Postgres reviews.
- `docs-lookup` — wrapper de context7.
- `performance-optimizer` — bottlenecks.
- `security-reviewer` — security audit.
- `silent-failure-hunter` — caza de bugs silenciosos.
- `tdd-guide` — TDD coaching.
- `type-design-analyzer` — tipos Swift / generics design.
- `build-error-resolver` — fallback general (cuando swift-build-resolver no aplica).
- `chief-of-staff` — coordinación high-level.
- `planner` — planning auxiliar.
- `pr-test-analyzer` — análisis de tests pre-merge.
- `doc-updater` — actualizar docs durante cambios.
- `harness-optimizer` — meta: optimizar el .claude/.
- `loop-operator` — loops continuos (eval, regression).
- `comment-analyzer`, `conversation-analyzer` — análisis de código y sesiones.

---

## Skills clave (84 totales)

Skills en `.claude/skills/`. Auto-invocadas por descripción o `/skill-name`.

### Críticas para este proyecto (iOS 26)
- **`liquid-glass-design`** ⭐ — patterns Liquid Glass.
- **`swift-actor-persistence`** ⭐ — concurrent persistence patterns.
- **`swift-concurrency-6-2`** ⭐ — Swift 6.2 strict concurrency.
- **`swift-protocol-di-testing`** ⭐ — DI + testing patterns.
- **`swiftui-patterns`** ⭐ — SwiftUI idioms.
- **`ios-icon-gen`** ⭐ — generar app icons.
- **`foundation-models-on-device`** ⭐ — iOS 26 FoundationModels framework.
- **`make-interfaces-feel-better`** ⭐ — polish + microinteractions.
- **`motion-foundations`**, **`motion-patterns`**, **`motion-ui`**, **`motion-advanced`** — animations.
- **`accessibility`** — Dynamic Type, VoiceOver, contrast.
- **`fal-ai-media`** — fal.ai integration (el backend lo usa).
- **`postgres-patterns`** — Supabase = Postgres.

### Workflow / engineering
- `api-design`, `api-connector-builder` — para v2/ios endpoints.
- `architecture-decision-records` — ADRs.
- `coding-standards`, `code-tour`, `codebase-onboarding`.
- `tdd-workflow`, `e2e-testing`, `eval-harness`, `verification-loop`.
- `error-handling`, `safety-guard`.
- `repo-scan`, `workspace-surface-audit`.
- `performance-optimizer` (también agent).
- `security-review`, `security-scan`, `security-bounty-hunter`.

### ECC meta + agentic
- `ecc-guide`, `configure-ecc`, `ecc-tools-cost-audit`.
- `agent-eval`, `agent-harness-construction`, `agent-introspection-debugging`, `agent-architecture-audit`.
- `continuous-learning`, `continuous-learning-v2`, `continuous-agent-loop`.
- `skill-create`, `skill-comply`, `skill-scout`, `skill-stocktake`, `skill-health`.

### Otros útiles
- `documentation-lookup` — wrapper context7.
- `deep-research`, `research-ops`, `search-first`.
- `context-budget`, `strategic-compact`, `token-budget-advisor` — context management.
- `mcp-server-patterns` — para integrar MCPs nuevos.
- `git-workflow`, `github-ops`.

---

## Rules disponibles

Reglas en `.claude/rules/`. Auto-loaded según frontmatter `paths:`.

### Cargadas siempre (no `paths:`)
- **`seed-precedence.md`** — orden de autoridad seed/, base/, harness.

### Path-scoped a Swift
- **`swift/liquid-glass.md`** — materials per `seed/design.md` §6.5.
- **`swift/storyplots-stack.md`** — stack constraints específicos del proyecto.
- **`swift/coding-style.md`** — formatting, immutability, naming, error handling.
- **`swift/testing.md`** — Swift Testing framework.
- **`swift/patterns.md`**, **`swift/security.md`**, **`swift/hooks.md`** — del upstream ECC.

### Comunes
- **`common/`** — agents, code-review, coding-style, development-workflow, git-workflow, hooks, patterns, performance, security, testing.

### Web (para inspeccionar `base/`)
- **`web/`** — coding-style, design-quality, hooks, patterns, performance, security, testing.

---

## MCPs activos

### iOS (orden estricto de prioridad)
1. **Apple Xcode MCP** (`xcode: xcrun mcpbridge`) — siempre. `BuildProject`, `RunAllTests`, `RenderPreview`, `DocumentationSearch`, `ExecuteSnippet`. Requiere Xcode abierto.
2. **XcodeBuildMCP** — para deploy device físico, builds headless, LLDB.
3. **ios-simulator-mcp** — para flujos interactivos (`ui_tap`, `ui_swipe`, accessibility tree).

### Orthogonal
- **Serena** (`mcp__plugin_serena_serena__*`) — navegación semántica Swift. Preferir sobre `Read`/`Grep` para archivos > 150 líneas.
- **context7** (`mcp__plugin_context7_context7__*`) — docs actualizadas Apple frameworks, Supabase, etc.
- **Playwright** (`mcp__plugin_playwright_playwright__*`) — **solo para inspeccionar `base/` web vivo**, nunca como gate iOS.

---

## Plan format

Cada fase escribe a `.claude/PRPs/plans/NNNN-phase-N-slug.plan.md`:

```markdown
# Phase N — [Name]

**Seed sections:** [citations]
**Roadmap section:** seed/roadmap.md §Fase N
**Non-negotiables:** [from creator-vision.md §6]

## Scope
[Una frase. Qué entrega esta fase + qué queda out.]

## Subtasks (3-5 atómicas)

### 1. [Name]
[Qué construir + test]
**Verify:** [comando ejecutable]

### 2. ...

## Gate (exit criteria de la fase)
[Verbatim del seed/roadmap.md §Verificación de la fase]

## Verification (post-implementación)
- BuildProject: [resultado]
- RunAllTests: [N passed, coverage X%]
- RenderPreview: [archivos snapshot]
- ios-simulator-mcp: [flujos verificados]
- Liquid Glass acceptance: [snapshots default + Reduce Transparency]
- Code-review findings: [resolved / escalated]
- Quality-gate: [all green]
- Riesgos materializados: ...
- Deuda creada: ...
```

---

## Verification ritual pre-commit

Antes de cerrar una fase:

1. **Type/lint** — `xcodebuild build` zero warnings.
2. **Unit tests** — `RunAllTests` green.
3. **Integration** — tests con Supabase staging si aplica.
4. **E2E iOS** — ios-simulator-mcp ejerce flow crítico.
5. **`/code-review`** — findings resueltos o escalados.
6. **`/quality-gate`** — exit criteria green.
7. **Liquid Glass** — snapshots default + Reduce Transparency comparados.
8. **Non-omission** — checklist de non-negotiables (rule seed-precedence §Non-omission).
9. **Memory hygiene** — actualizar Serena memories afectados (`structure_and_layout`, `suggested_commands` si cambió, etc.).
10. **`/prp-commit`** — single commit.

---

## Guardrails

- **Non-invention.** No en seed → flagear en `seed/open-questions.md`, no inventar.
- **Non-omission.** Required behaviors no se droppean (ver §6 creator-vision).
- **Seed over harness.** Agent suggestions que contradigan seed → wrong, reject.
- **No WIP commits.** Single commit por fase.
- **Seed read-only durante implementación.** Solo `open-questions.md` append-only.
- **`roadmap.md` es status + scope.** Insertar fase requiere seed update primero; reordenar es OK con justificación.
- **No `--no-verify`.** Si un hook bloquea, investigar.

---

## Escalation

Parar y consultar al creator si:
- Una non-negotiable de `creator-vision.md` §6 se va a violar.
- El backend cambia shape de un endpoint v1 documentado en `api-contract.md`.
- ECC agent produce un plan que contradice el seed.
- 3 restarts fallados de dev services o build.
- `find_referencing_symbols` revela un refactor materialmente más grande que asumido.
- Coverage cae bajo el threshold de la fase (60% global, 80% chat/auth/persistence).

---

## Notas operacionales

- **Hooks de ECC**: no instalados (los upstream requieren `/plugin install everything-claude-code`). Project-scope harness funciona sin ellos. Si querés el set completo de hooks (governance, doc-warning, suggest-compact, etc.), instalar ECC como plugin a futuro.
- **PRPs directory**: `.claude/PRPs/plans/` y `.claude/PRPs/reports/` se crean cuando `/prp-plan` corra la primera vez.
- **Custom skills/agents nuevos**: usar `/skill-create` y agregar al `.claude/skills/<name>/SKILL.md`. Update este CLAUDE.md cuando se agreguen.
