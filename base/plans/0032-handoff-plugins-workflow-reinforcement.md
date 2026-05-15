---
id: 0032-docs
slug: handoff-plugins-workflow-reinforcement
status: shipped
created: 2026-04-17
---

# Cycle 0032 (docs-only) — SESSION_HANDOFF plugin playbook + cycle workflow checklist

## Context

Session 2 closed with SESSION_HANDOFF.md brought up-to-date through cycle 0031 and a pointer to it at the top of CLAUDE.md. The creator now wants two reinforcements so that future sessions (especially a fresh Claude) land in the exact workflow without drift:

1. **Plugin playbook** — an explicit, scannable table of when to use each installed plugin. CLAUDE.md has this buried in prose at `## Installed plugins`; SESSION_HANDOFF.md only mentions plugin names once. A new session's Claude should see, in one glance: "feature-dev = new features", "playwright = UI verification gating", etc. — and know the rules of use.

2. **Cycle workflow checklist** — a numbered, check-boxy flow that every cycle follows: propose → save plan → implement → verify each gate → append Verification to plan → update SESSION_HANDOFF → commit. Today this exists implicitly in CLAUDE.md's `## Implementation workflow` but is split across 5 prose paragraphs. A checklist makes the state of each cycle visible and harder to skip.

No code is written this cycle. The deliverable is updates to two docs + a commit.

**Principle:** docs are load-bearing here. If the next session's Claude doesn't know to run `code-review` + `code-simplifier` before commit, or doesn't realize SESSION_HANDOFF.md should be updated at session close, the system drifts. Making these steps checkable (literal `[ ]` markdown boxes) raises the quality floor.

## Shape of the change

Two files edited, zero code:

```
SESSION_HANDOFF.md
  + "Plugin playbook" table (new section, after "Convenciones del proyecto")
  + "Cycle workflow checklist" (numbered steps with markdown checkboxes)
  + Reinforce "Al cerrar la sesión" with explicit verb: ACTUALIZAR este archivo

CLAUDE.md
  + One-line pointer to the new Plugin playbook + checklist sections in
    SESSION_HANDOFF.md from the existing "Installed plugins" and
    "Implementation workflow" sections — so the top-level CLAUDE.md
    structure is preserved but in-session readers land in the checklist
    version when they follow the pointer.
```

## 1. Seed sections satisfied

- [CLAUDE.md ## Installed plugins] — reinforced, not changed.
- [CLAUDE.md ## Implementation workflow — /ultraplan-driven] — reinforced.
- No seed file touched.

## 2. Commit decisions

1. **Plugin playbook is a table, not prose.** Columns: Plugin · When to invoke · Rules of use · Skip if. Goal: a next-session Claude can triage "do I need this plugin?" in < 5 seconds.
2. **Checklist uses literal `[ ]` markdown boxes.** A cycle in progress can visually show which steps are done when the plan is shared. Claude can also update the checklist state as it works (treating it like a lightweight TaskCreate tracker).
3. **Checklist lives in SESSION_HANDOFF.md, not a new file.** Keeps the single-file discipline — one place the next session reads.
4. **CLAUDE.md adds one-line pointer, no restructure.** CLAUDE.md is the canonical ruleset; SESSION_HANDOFF.md is the quick-start. Pointer respects that boundary.
5. **No editing of seed files or plans/0001-0031/\*.md.** Past plans stay historical.

## 3. Content to add — SESSION_HANDOFF.md

### 3.1 Plugin playbook (insert after "## Convenciones del proyecto" before "## Tips para el agente")

```markdown
## Plugin playbook

Los 7 plugins instalados deben usarse **activamente**; son la diferencia entre "código que funciona" y "código review-ready + verified". Resumen de cuándo invocar cada uno:

| Plugin | Cuándo usarlo | Regla de uso | Skip si |
|---|---|---|---|
| **`feature-dev`** | Cualquier cambio que toque >1 archivo o introduzca un feature | Junto con `/ultraplan` al inicio del cycle | Cambio trivial (ver CLAUDE.md "trivial" definition) |
| **`frontend-design`** | Todo cambio UI — páginas, componentes, estilos | Cross-reference output contra `Seed/ux.md` (screen inventory, required states, §10 non-omission) y `Seed/design.md` (§13 anti-patterns) | Cambio puramente backend o lib |
| **`code-review`** | Al final de cada cycle, antes del commit | **MANDATORIO.** Findings van en plan `## Verification`; no se ignoran. Hallazgos que revelan seed misreads se arreglan; ambigüedades se escalan a `Seed/open-questions.md` | — nunca skip |
| **`code-simplifier`** | Al final de cada cycle, después de `code-review` | **MANDATORIO.** Poda speculation, unused scaffolding, premature generalization. No override de superficies seed-required | — nunca skip |
| **`context7`** | Antes de usar API/SDK externo (Supabase, httpx, React libs, OpenAI, ComfyUI, etc.) | Preferir over guessing API shapes, especialmente si hubo cambios recientes en la librería | API ya conocida + sin cambios recientes |
| **`playwright`** | UI cambios que navegan — cualquier cycle con frontend | **GATE requerido** antes del commit: ejercer flows + required states; documentar en plan `## Verification` qué gates corrieron y outcome | Cycle puramente backend (sin UI) |
| **`serena`** | Navegación semántica en codebase grande | Preferir `find_symbol`, `get_symbols_overview`, `find_referencing_symbols` sobre leer files enteros. **NO** usar sus memory features (`write_memory`) — plans viven en repo, no en Serena | Cambio puntual a archivo conocido |

Reglas generales:
- **Plugins no reemplazan `/ultraplan`.** El plan se escribe primero; los plugins ejecutan pasos dentro.
- **Plugin evidence is tool output, not truth.** Seed files ganan en conflict.
- **Si un plugin no está disponible mid-task, stop + surface.** No silently sustituir por un check más débil.
```

### 3.2 Cycle workflow checklist (replace the final "Cómo arrancar una nueva sesión" section)

```markdown
## Cycle workflow — checklist

Cada cycle no-trivial sigue exactamente esta secuencia. Claude debe trackear visualmente dónde va (TaskCreate/TaskUpdate ayuda) y marcar cada paso al cerrarlo:

- [ ] 1. **Propose** — Leer relevant Seed sections + homologous PersonaLLM-Reference. Escribir draft plan en scratchpad. Si hay >1 approach razonable, usar `AskUserQuestion` para alinear antes del draft final.
- [ ] 2. **Save plan** — Escribir a `plans/NNNN-slug.md` con frontmatter completo (`id, slug, status: draft, created`). Siempre antes de empezar a codificar. Incluye: Context · Shape · Seed sections satisfied · Commit decisions · Schema/RLS · Backend · Frontend · Verification gates · Implementation order · Critical files.
- [ ] 3. **Get approval** — `ExitPlanMode` para aprobación del creator. Proceder solo después del sign-off. (Saltar solo si el cycle es literalmente trivial per CLAUDE.md definition.)
- [ ] 4. **Implement in order** — Seguir el "Implementation order" del plan. Usar `feature-dev` + `serena` + `context7` según aplique. Si la realidad diverge del plan, actualizar el plan — nunca drift silencioso.
- [ ] 5. **TypeScript check** — `npx tsc --noEmit` (frontend) limpio después de cambios frontend. Cero errores antes de continuar.
- [ ] 6. **Migrations manual** — Si hay `.sql`, escribirlo + pedir al creator que lo aplique vía Supabase SQL Editor. Esperar "listo".
- [ ] 7. **Playwright verification** — Todo cambio UI navegable se ejerce en vivo contra backend + Vite + providers reales. Marcar cada gate del plan con ✅ o detallar fallo.
- [ ] 8. **Backend verification** — Si hay cambios de backend, probar los paths críticos (endpoint curl o direct Python invocation).
- [ ] 9. **`code-review` pass** — Mandatorio. Findings van al plan.
- [ ] 10. **`code-simplifier` pass** — Mandatorio. Wins van al plan.
- [ ] 11. **Append Verification** — Actualizar el plan: `status: shipped`, llenar `## Verification` con outcome por gate (citar RPC response, log line, Playwright selector, etc).
- [ ] 12. **Copy plan to repo** — `plans/NNNN-slug.md` con la Verification escrita.
- [ ] 13. **Commit** — `feat(NNNN): <short>` con body que resume cambios + `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Body incluye qué cambió, qué se deferió, qué se verificó live.
- [ ] 14. **Update SESSION_HANDOFF.md** — Tabla de cycles, arquitectura si aplica, test data si aplica, roadmap si cambió. Commit separado (`docs:`).

Al cerrar la sesión completa:
- [ ] 15. **SESSION_HANDOFF.md refleja el estado actual.** Ningún cycle shipped falta de la tabla. Tips + convenciones siguen vigentes.

## Cómo arrancar una nueva sesión

1. Abre Claude Code en `StoryPlots/`.
2. Dile: *"lee SESSION_HANDOFF.md y CLAUDE.md antes de empezar, luego [pedido]"*.
3. Claude debe:
   - Reconocer los 31+ cycles shipped y la arquitectura.
   - Usar el checklist de arriba para cualquier cycle nuevo.
   - Invocar plugins per el playbook.
   - Respetar seed precedence + principles de CLAUDE.md.
4. Al cerrar: **"actualiza SESSION_HANDOFF.md con los cycles nuevos y commit"**.
```

## 4. Content to add — CLAUDE.md

### 4.1 Single-line pointer additions

En la sección existente `## Installed plugins`, al final del paragraph intro:

```markdown
Prefer plugin entrypoints over raw MCP calls — plugins wrap the underlying tools with the right workflow prompts. See [SESSION_HANDOFF.md "Plugin playbook"](SESSION_HANDOFF.md#plugin-playbook) for a one-glance when-to-use table.
```

En la sección existente `## Implementation workflow — /ultraplan-driven`, después del opening paragraph:

```markdown
For the step-by-step checklist that each cycle follows end-to-end (propose → save plan → implement → verify → append Verification → update SESSION_HANDOFF → commit), see [SESSION_HANDOFF.md "Cycle workflow — checklist"](SESSION_HANDOFF.md#cycle-workflow--checklist).
```

No other CLAUDE.md edits.

## 5. Verification gates

Since this cycle is docs-only, gates are structural:

1. **SESSION_HANDOFF.md has "Plugin playbook" section.** Table with all 7 plugins, 4 columns (Plugin · When · Rule · Skip if). Grep `Plugin playbook` in the file → 1 match.
2. **SESSION_HANDOFF.md has "Cycle workflow — checklist" section.** Numbered list with 15 `- [ ]` markdown boxes. Grep `Cycle workflow — checklist` → 1 match; `- [ ]` count → 15.
3. **CLAUDE.md has new pointer to Plugin playbook.** Grep `SESSION_HANDOFF.md#plugin-playbook` → 1 match.
4. **CLAUDE.md has new pointer to Cycle workflow — checklist.** Grep `SESSION_HANDOFF.md#cycle-workflow--checklist` → 1 match.
5. **No accidental edit to plans/ or backend/ or frontend/.** `git diff --stat` shows exactly 2 modified files: `SESSION_HANDOFF.md` + `CLAUDE.md`.
6. **Commit format.** `git log -1 --format=%s` starts with `docs:`.

## 6. Implementation order

1. Edit SESSION_HANDOFF.md — insert Plugin playbook section.
2. Edit SESSION_HANDOFF.md — replace "Cómo arrancar una nueva sesión" with checklist + arrancar block.
3. Edit CLAUDE.md — insert 2 one-line pointers.
4. Run gates 1-5.
5. Commit with `docs: reinforce plugin playbook + cycle workflow checklist in SESSION_HANDOFF`.

## 7. Open considerations (not blocking)

- **Per-cycle checkbox state in plans/** — could add the same 15-step checklist to a plan template so every cycle tracks which steps are done. Deferred; the live TaskCreate/TaskUpdate tracker already covers this in-session.
- **Auto-sync SESSION_HANDOFF cycle table from git log** — out of scope; manual update keeps the narrative context intact.

## Critical files

- `SESSION_HANDOFF.md` *(add 2 sections: Plugin playbook + Cycle workflow checklist)*
- `CLAUDE.md` *(2 one-line pointer additions to the existing sections)*

## Verification

Docs-only cycle. Structural gates only (grep + git diff).

1. ✅ `## Plugin playbook` section exists in SESSION_HANDOFF.md (grep count = 1). Table has 7 plugin rows × 4 columns (Plugin · Cuándo usarlo · Regla de uso · Skip si) + general rules below.
2. ✅ `## Cycle workflow — checklist` section exists in SESSION_HANDOFF.md (grep count = 1). Markdown checkboxes `- [ ]` count = 15 (steps 1-14 + session-close 15).
3. ✅ CLAUDE.md pointer to `SESSION_HANDOFF.md#plugin-playbook` in the `## Installed plugins` intro paragraph (grep count = 1).
4. ✅ CLAUDE.md pointer to `SESSION_HANDOFF.md#cycle-workflow--checklist` at the top of `## Implementation workflow — /ultraplan-driven` (grep count = 1). (Combined grep for both anchors = 2.)
5. ✅ `git diff --stat` shows exactly 2 modified files: `CLAUDE.md` (+4/-1) and `SESSION_HANDOFF.md` (+54/-10). No code paths touched.
6. Commit formatted as `docs: ...` (below).

Impact: a next-session Claude reading SESSION_HANDOFF.md now lands in a scannable plugin table + a 15-step checklist instead of inferring workflow from prose. The existing CLAUDE.md canonical workflow section points at both, preserving precedence (CLAUDE.md = rules, SESSION_HANDOFF.md = quick-start).
