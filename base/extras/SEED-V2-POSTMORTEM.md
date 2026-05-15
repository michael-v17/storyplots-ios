# Análisis — Semilla greenfield: qué tuviste, qué faltó, qué shape probar el próximo intento

> **Tipo:** análisis + propuesta de plantilla. No es un plan de implementación — es una evaluación de la semilla de StoryPlots contra el curso de spec-driven development, para diseñar una semilla v2 reusable en un próximo greenfield (potencialmente re-hacer StoryPlots desde cero).
>
> **Alcance:** diagnóstico de lo que hizo que Claude drifteara en StoryPlots + recomendación concreta del shape que una próxima semilla debería tener para soportar **sesiones largas, autónomas y resumibles** con menos intervención del creador.

---

## 0. Contexto

Arrancaste StoryPlots con un **greenfield seed approach**: `Seed/` con 10 archivos de especificación (creator-vision, product, domain, user-stories, schema, ux, design, open-questions + README + PersonaLLM-Reference como evidencia secundaria) y un prompt de arranque `ultraplan-kickoff.md` que invocaba `/ultraplan` para producir el primer ciclo. El diseño explícito en `greenfield_seed_instructions.md` líneas 7–10 dice:

> The seed is not a sprint backlog. The seed is not a task tracker. The seed is not a giant random documentation dump. The seed is a **foundational project harness**.

Líneas 582–586 refuerzan: *no incluir* sprint tickets, implementation plans exhaustivos, roadmaps especulativos. Es decir: la semilla describe **qué es el producto**, no **en qué orden se construye**.

Después de 72 ciclos (sesiones 1 a 6, desde 2026-04-15 hasta hoy 2026-04-20), tu intuición dice que a Claude "se le perdió" en algún punto. Tomaste el curso corto de spec-driven development y viste que su shape (`specs/mission.md + roadmap.md + tech-stack.md + specs/YYYY-MM-DD-feature-slug/{requirements, plan, validation}.md + CHANGELOG.md`) tiene piezas que tú no pusiste. Quieres evaluar:

1. ¿El routemap fue lo que más faltó, o hay más?
2. ¿Qué sirvió de lo que tienes (conservar para la próxima)?
3. ¿Qué shape debería tener una semilla v2 para un proyecto nuevo **que permita a Claude ir por fases, cambiar de sesión sin recargar contexto, y que no te obligue a aprobar cada ciclo**?

Este documento responde esas tres preguntas con evidencia concreta de tu repo (plans/, SESSION_HANDOFF, commits) cruzada contra lo que el curso spec-driven enseña.

---

## 1. TL;DR — Veredicto

**Sí, el roadmap fue un gap real y grande — pero no es el único.** Hay **7 ausencias** en tu semilla que, combinadas, forzaron el modo "approval-por-ciclo" y el drift en mitad del proyecto. Ordenadas por impacto:

| # | Ausencia | Efecto observado en StoryPlots |
|---|---|---|
| 1 | **Roadmap fasado** (qué se construye en qué orden, con exit criteria por fase) | Ciclos 0001-0031 inventaron secuencia ciclo a ciclo → scope creep (0027), iteración redundante (0028-0031), ciclo 0025 fantasma, renumeración retroactiva (0070 shifteó todo +1) |
| 2 | **Rúbrica explícita de tres artefactos por fase** (requirements.md + plan.md + validation.md separados) | Tus `plans/NNNN-slug.md` mezclan los tres en un archivo. `Verification` se apendiza **después** de implementar → es check retroactivo, no puerta de merge. Por eso necesitas tu propia aprobación — no hay gate objetivo |
| 3 | **Tech-stack.md como artefacto aparte** con sección "What we are NOT using" | `architecture.md` mezcla stack + responsabilidades + límites. Sin prohibiciones explícitas ("no React Native, no Docker, no ORM"), Claude queda libre de sugerir ampliaciones que tú después tienes que bloquear |
| 4 | **CHANGELOG.md automatizado separado del handoff** | `SESSION_HANDOFF.md` creció a 665 líneas / 116 KB porque hace de log + roadmap + convención + onboarding a la vez. Actualizarlo a mano al final de cada ciclo es fricción; y es difícil de escanear al inicio de sesión |
| 5 | **Skeleton bootstrap (Fase 0) con repo pre-configurado** | Ciclo 0001 tuvo que scaffoldear desde cero (auth + RLS + primera ruta). Un skeleton listo (package.json, folder layout, migración inicial, un test de humo) habría empezado en "Fase 1" real en lugar de Fase 0 implícita |
| 6 | **Resumibilidad entre sesiones como propiedad de diseño** | Tu flujo exige leer `SESSION_HANDOFF.md` + `CLAUDE.md` + el ciclo anterior + el seed antes de empezar. Una semilla v2 bien hecha hace que **la única lectura obligatoria sea roadmap.md + la fase actual + su validation.md** |
| 7 | **Dev runbook — Claude no manejaba los servers** | Claude Code no arrancaba ni reiniciaba backend/frontend; el creador los levantaba manualmente. Loop de feedback código→error→fix lento porque Claude no veía logs. La semilla nunca dijo "usa `run_in_background` + `BashOutput` + `KillShell` así" |

**La rúbrica también faltó** (tu segunda intuición en la respuesta es correcta). La combinación **roadmap + rúbrica** es lo que convierte un seed en un motor autónomo: roadmap decide el orden, rúbrica decide cuándo una fase está realmente hecha. Sin rúbrica, el criterio de "hecho" es "el creador aprueba" — eso es lo que te mantuvo en el loop.

---

## 2. Lo que tu semilla hace bien (conservar y replicar en v2)

Esto es lo que **no** hay que cambiar. Tu seed está en el 90 percentil entre los seeds que he visto:

| Elemento | Archivo | Por qué funcionó |
|---|---|---|
| **Vision de alta autoridad** | `Seed/creator-vision.md` §1, §8 | 614 líneas explícitas con no-negotiables (agent isolation, grammar off-by-default, per-conversation Lorebook, edit-as-trim, branching-copies, snapshot immutability, SSE, BYOK, plain-text reply path). Esos invariants aguantaron los 72 ciclos sin violarse |
| **Precedencia documental numerada** | `README.md` (11 niveles + PersonaLLM #12) | Elimina "qué documento gana si se contradicen"; resuelve conflictos de manera determinística |
| **Prohibición de invención + registro de ambigüedad** | `open-questions.md` (append-only) + rule 5 en greenfield_seed_instructions | Capturó decisiones pendientes sin que Claude las fabricara. Evidence: §5.9.1 escaló un hallazgo de plan 0007 de vuelta al seed |
| **Referencia secundaria con provenance explícita** | `Seed/PersonaLLM-Reference/` (12 archivos, precedencia #11-12) | "Replicar comportamiento observado no es invención" — desatoró decisiones donde el seed era fino |
| **User stories como flows críticos con acceptance criteria** | `user-stories.md` §6 (F1-F7 no-negociables) | Dio smoke tests reales, no narrativos |
| **Schema con isolation rules explícitas** | `schema.md` + RLS per-user / per-conversation | Ningún ciclo violó isolation — el RLS doctrine pegó desde el día 1 |
| **Non-omission rule** | `ux.md` §10 + greenfield_seed_instructions rule 6 | Previno drop silencioso de pantallas / estados |
| **Design system escalado en fase de overhaul** | `DesignSystem/` (introducido ciclo 0066, tokens CSS + SKILL.md + ui_kits JSX reference) | Cuando el overhaul visual llegó, la decisión de hacerlo autoritativo para visual (pero no para behavior) evitó conflicto con seed |
| **Plugin discipline (code-review + code-simplifier + playwright + context7 + serena)** | `CLAUDE.md` § Installed plugins | Cada plugin tiene condiciones claras de uso. Mandatory passes previenen regresión |

**Conclusión:** la materia prima de especificación está bien. El problema no es lo que tienes — es lo que **no pusiste entre la semilla y la implementación**.

---

## 3. Lo que le faltó — con evidencia

### 3.1 Roadmap fasado (el gap más grande)

**Qué falta:** un documento `roadmap.md` en el mismo nivel de autoridad que `creator-vision.md` que diga:

> Fase 1 — Auth + empty shell + rutas declaradas (placeholders)
> Fase 2 — Characters CRUD
> Fase 3 — Conversations (send + stream)
> Fase 4 — Grammar Agent (opt-in)
> Fase 5 — Lorebook + Author's notes
> Fase 6 — Memory/RAG
> Fase 7 — Visual roleplay
> Fase 8 — Grammar dashboard
> Fase 9 — Settings + Data & Security
> Fase 10 — Design overhaul
> ...

Cada fase con: scope, no-scope, user stories cubiertas (F1-F7), exit criteria objetivos.

**Evidencia del drift sin roadmap:**

- **Ciclo 0027** (AI Character Import) tituló "V1/V2/V3 + LLM refinement + avatar handling" — tres features top-level en un solo ciclo. Plan.md explícitamente dice "Follow-up session will consolidate avatar handling logic." Sin roadmap predefinido, Claude no sabía que "V3 + refinement + avatar" eran **tres fases** distintas.
- **Ciclos 0028-0031** son iteración sobre 0014-0026 (Visual Roleplay + Memory). Cuatro ciclos para re-hacer lo que ciclos anteriores sub-especificaron. Con roadmap, el orden habría sido Memory (fundamento) → Visual Roleplay (features visuales encima), no al revés.
- **Ciclo 0025 fantasma**: no existe archivo plan. Entre 0024 (Export/Import) y 0026 (Writing Styles) hay un hueco. Hipótesis: false start que no se formalizó. Con roadmap + `phase-NN-slug/` convention, un false start habría sido un folder con `status: abandoned`, no un número desaparecido.
- **Ciclo 0070 renumerado retroactivamente**: en pleno overhaul visual, el creator notó que "Global chrome reset" (inputs, scrollbars, links) tenía que ir antes que Chat-periphery y CharacterForm. Se insertó como 0070, shifteando los originales 0070→0071 y 0071→0072. SESSION_HANDOFF documenta el shift. **Con roadmap, Global Chrome habría sido Fase 10a antes de Fase 10b desde el día 1 — o, mejor, habría caído naturalmente en una Fase 2 de "layout/structure desde día 1" antes de cualquier polish.**
- **El roadmap real apareció en Sesión 6** (hoy): `SESSION_HANDOFF.md` §"Fase actual: Diseño visual / Sub-fases" tiene la lista 0066-0083 con un one-liner por ciclo. Es la primera vez que hay secuencia pre-escrita. Apareció **después** del drift, no antes.

**Por qué importa para tu goal de autonomía:** sin roadmap, Claude en cada ciclo tiene que **tomar decisión de producto** ("¿qué construyo ahora?"). Esa decisión requiere tu aprobación porque es scope-level. **Con roadmap, la decisión ya está hecha** — Claude sólo necesita aprobación si emerge una ambigüedad específica dentro de la fase, lo cual es mucho menos frecuente.

### 3.2 Rúbrica explícita de tres artefactos por fase (requirements / plan / validation)

**Qué falta:** el curso spec-driven obliga a tres archivos separados por fase:

- `requirements.md` — scope, decisiones, out-of-scope, stakeholders. **Antes** de escribir código.
- `plan.md` — grupos de tareas numerados, ejecutables. Cada grupo es revisable por sí solo.
- `validation.md` — Definition of Done: typecheck, tests automatizados con casos específicos, smoke checklist manual. **Escrito junto con plan.md**, antes de implementar.

**Lo que tú tienes:** un solo archivo `plans/NNNN-slug.md` con frontmatter + Context + Shape + Implementation order + `## Verification` apendizado al final **después** de shipear. Ejemplo: plan 0072 tiene 493 líneas, 12 "Done when" checkboxes, 3 subtareas con Playwright gates — pero la sección Verification se agrega **tras** completar, no antes.

**Por qué importa:**

- Si `validation.md` existe **antes** de implementar, se vuelve una puerta objetiva. Typecheck + tests + smoke checklist — todo binario (pass/fail). No necesitas **tú** aprobar: la prueba pasa o falla. Claude puede iterar hasta que pase, luego pasar al siguiente requirement.
- Si la validación se apendiza **después**, es un post-hoc de lo que se hizo, no un gate de lo que debía hacerse. El gate se convierte en "el creador lee y dice sí" — lo cual **requiere creador-en-el-loop por definición**.
- Si `requirements.md` está separado, Claude puede usar AskUserQuestion **una vez al inicio de fase** sobre el scope ambiguo, y luego ejecutar sin más interrupciones.

**Evidencia en StoryPlots:**

- Plans 0001-0010: ~280 líneas, Verification es narrativa (qué se probó manualmente).
- Plans 0036 y otros polish cycles: 56 líneas, sin Playwright gates (cambios "demasiado pequeños" para gates).
- Plans 0066+: 300-500 líneas, gates sí son declarativos (CSS expectations con IDs GL-a..j), pero **siguen mezclando todo en un archivo**.

La asimetría Plans 0001 vs 0072 muestra que tu workflow fue descubriendo el gate-declarativo a medida que pasaban ciclos. Una semilla v2 **lo tiene desde el ciclo 1**.

### 3.3 Tech-stack.md como artefacto separado

**Qué falta:** un archivo que:

1. Liste cada layer (language, runtime, framework, DB, testing, tooling) con **rationale breve** por elección.
2. Tenga una sección **"What We Are Not Using"** explícita.

**Lo que tú tienes:** `architecture.md` §1 consolida "React + Vite + FastAPI + Supabase" del antiguo `stack-decisions.md`, pero:

- No hay rationale por elección ("por qué FastAPI y no Hono" — Claude no lo sabe).
- No hay prohibiciones ("no usar ORM", "no agregar Redis a menos que roadmap lo pida", "no introducir Next.js si Vite ya está").
- No hay dependencias explícitas (versiones pinneadas, `package.json` inicial).

**Por qué importa:**

- Sin prohibiciones, Claude sugiere **ampliaciones plausibles** que después tienes que bloquear manualmente. Cada bloqueo es fricción.
- Sin versiones pinneadas, Claude puede introducir breaking changes (ej: Supabase SDK major version bump) sin darse cuenta hasta que algo rompe.
- Sin rationale, si una decisión se cuestiona en el ciclo 40, hay que re-debatirla. Con rationale, hay argumento archivado.

**Ejemplo del curso (Lesson 05 `tech-stack.md`):**

```markdown
## What We Are Not Using
- No React, Vue, or Svelte — server-side rendering keeps the stack simple
- No ORM — SQL is sufficient at this scale
- No Docker — not yet; that's a later phase concern
```

Tres líneas que ahorran 20 discusiones a lo largo del proyecto.

### 3.4 CHANGELOG.md separado del handoff

**Qué falta:** un CHANGELOG.md auto-generado desde `git log` (como el skill de Lesson 09 que corre `python3 scripts/changelog.py`), editado a mano mínimamente, commiteado junto al merge de cada fase.

**Lo que tú tienes:** `SESSION_HANDOFF.md` (665 líneas, 116 KB) mezcla:

- Narrativa de ciclos (10 KB — "Estado actual")
- Roadmap planeado (8 KB — sub-fases del overhaul)
- Convenciones (12 KB — cycle workflow checklist, plugin playbook, migraciones)
- Onboarding a próxima sesión (3 KB — "Cómo arrancar")
- Referencia de test data + proveedores + configs (15 KB)

**Por qué importa para resumibilidad:**

- Al abrir una sesión nueva, Claude **tiene** que leer SESSION_HANDOFF (si no lo hace, no sabe dónde quedó). 665 líneas = ~50K tokens = significativo pero manejable. El problema no es el tamaño: es la **densidad irregular**. 60% son convenciones que ya viven en CLAUDE.md + DesignSystem; 30% es un log narrativo del pasado; sólo 10% es "qué sigue".
- Con un CHANGELOG.md (log inmutable de qué se hizo, una línea por commit, reverse-chron) + un `specs/roadmap.md` con check marks de fases shippeadas, el "estado actual" es derivable en 2 archivos de <100 líneas cada uno. Claude no necesita prosa narrativa para entender dónde está.

### 3.5 Skeleton bootstrap (Fase 0)

**Qué falta:** un directorio `skeleton/` o una primera fase explícita "Fase 0 — Bootstrap" que entregue **antes del primer feature**:

- `package.json` con deps pinneadas (las de `tech-stack.md`)
- Folder layout estándar (`frontend/src/`, `backend/`, `db/migrations/`, `plans/`, `specs/`)
- Migración inicial vacía (tabla `_migrations` + 1 user table con RLS)
- Un smoke test que pasa: "servidor arranca, responde 200 en `/`, DB conecta"
- `.env.example`, `.gitignore`, `README.md` mínimo
- CI mínimo (typecheck + lint + vitest/playwright install)

**Por qué importa:**

- Ciclo 0001 en StoryPlots fue "Auth + RLS + primera ruta" — mezcló bootstrap + feature. Con skeleton, Ciclo 0001 habría sido feature limpia porque el bootstrap ya estaría resuelto.
- Hace resumibilidad más fácil: al abrir sesión, el repo ya tiene estructura; Claude solo lee `roadmap.md` + fase actual.
- Permite **validar la semilla** antes de construir: si Claude arranca la Fase 0 y pasa el smoke test, la semilla es ejecutable. Si falla, hay un bug en la semilla antes de invertir 30 ciclos.

### 3.6 Resumibilidad entre sesiones

**Tu palabra exacta en la respuesta:** "que cada cierto rato pueda cambiar de sesión y solo continuar porque hay una guía clara y no hace falta cargar contexto."

**Esto es una propiedad de diseño**, no un archivo. Se logra combinando los anteriores:

1. **`roadmap.md`** tiene check marks — Claude ve "Fase 1-3 ✅ shipped, Fase 4 in progress".
2. **`specs/phase-04-lorebook/requirements.md + plan.md + validation.md`** — Claude lee solo la fase actual. Tres archivos de 50-150 líneas cada uno.
3. **`CHANGELOG.md`** — si Claude necesita contexto histórico, escanea una línea por commit.
4. **`CLAUDE.md`** — convenciones estáticas; cambia rara vez.
5. **`SESSION_HANDOFF.md` (opcional, slim)** — sólo "qué estaba a medio hacer en el último commit, si algo". Máximo 100 líneas.

**Métrica objetivo:** al abrir sesión nueva, Claude puede producir el próximo paso útil tras leer <10K tokens de contexto (vs. los ~50K de tu SESSION_HANDOFF actual).

### 3.7 Dev runbook — Claude no manejaba los servers (gap operacional)

**Tu observación, textual:** *"claude code no levantó el server del backend y frontend, así que yo lo hacía, eso hizo que fuera más lento, [...] en el proceso se tenía que reiniciar varias veces y es mejor que el mismo sistema lleve control de eso, así puede ver logs y otras cosas que les dé feedback de los problemas, además de ser más rápido."*

**Qué falta:** un archivo chico (20-40 líneas, no más) que sea el **runbook de desarrollo local**: qué comandos arrancan qué, en qué puerto, cómo verificar que están vivos, cómo reiniciar. Combinado con una convención en `CLAUDE.md` que diga **"los servers los maneja Claude, no el creador, y para hacerlo usa estos tools específicos"**.

**Por qué pasó en StoryPlots:**

Claude Code **tiene** los tools para manejar servers:

- `Bash(command, run_in_background=true)` — arranca un proceso sin bloquear la conversación, devuelve un `bash_id`.
- `BashOutput(bash_id)` — lee stdout/stderr del proceso en background desde el último check.
- `KillShell(bash_id)` — lo detiene limpiamente.
- `Monitor(bash_id)` — streaming de logs en vivo si se necesita.

Lo que **no tenía** era la instrucción de usarlos. Sin esa instrucción, Claude defaultea a "el creador maneja su entorno, yo sólo edito archivos". Tú tuviste que:

- Levantar `pnpm dev` y `uvicorn` manualmente cada sesión.
- Reiniciar tras cada cambio problemático.
- Copiar y pegar stack traces de vuelta al chat para que Claude los viera.
- Bajar y re-levantar servers cuando los puertos quedaban stuck.

Esto triplicó o cuadruplicó el tiempo de cada ciclo de feedback **código → error → fix**.

**Por qué es gap de semilla, no bug de herramienta:**

Es exactamente la misma naturaleza que los otros 6 gaps. La herramienta existe; lo que falta es **una convención explícita y un archivo de referencia**. Sin decirle a Claude "mira, tú corres los servers en background, usas `BashOutput` para ver logs, `KillShell` para reiniciar, y estos son los comandos exactos", Claude no sabe que ese es el contrato.

**Propuesta en v2 — un solo archivo + una sección en CLAUDE.md:**

`specs/dev-runbook.md`:

```markdown
# Dev Runbook

## Servidores (Claude los maneja, no el creador)

| Servicio | Comando | Puerto | Health check |
|---|---|---|---|
| Frontend (Vite) | `cd frontend && pnpm dev` | 5173 | `curl -s localhost:5173 \| head -1` devuelve `<!doctype html>` |
| Backend (FastAPI) | `cd backend && uvicorn app.main:app --reload --port 8000` | 8000 | `curl -s localhost:8000/health` devuelve `{"status":"ok"}` |

## Cómo Claude arranca el stack al empezar una sesión

1. `Bash("cd frontend && pnpm dev", run_in_background=true)` → anota `frontend_id`
2. `Bash("cd backend && uvicorn app.main:app --reload --port 8000", run_in_background=true)` → anota `backend_id`
3. Espera 5 segundos
4. `curl` los dos health checks; si ambos 200, reporta "stack up"
5. Si falla uno, `BashOutput(id)` del que falló para leer stack trace → diagnostica → arregla → reinicia

## Cómo reiniciar

1. `KillShell(bash_id)` del proceso existente
2. Re-ejecuta paso de arranque

## Port stuck de sesión previa

`Bash("lsof -ti:5173 -ti:8000 | xargs -r kill -9")` → re-arranca

## Cosas que Claude NO maneja (las hace el creador)

- Supabase setup (crear proyecto, pegar anon keys en .env) — una vez al inicio
- Migraciones en prod (creador las corre en Supabase SQL editor)
- Deploy a Vercel (creador)
- `.env` con secretos (creador llena; Claude nunca commitea)

## Reglas

- **Servers siempre en background.** Foreground bloquea la conversación.
- **Claude lee sus propios logs.** Si algo rompe, `BashOutput(id)`, no "pégame el error".
- **Tras 3 reinicios sin arreglar, escalar.** No entrar en bucle.
```

Y en `CLAUDE.md` una sección de convenciones:

```markdown
## Dev environment management

- Start all dev servers with `Bash(command, run_in_background=true)`; never foreground.
- After start, wait 5s then verify with `curl` per health checks in `specs/dev-runbook.md`.
- For log inspection during debug, use `BashOutput(bash_id)` — do not ask the creator to paste stack traces.
- To restart: `KillShell(bash_id)` + re-run. Do not escalate unless 3 restarts fail.
- The creator handles: Supabase setup, prod migrations, deploy, secrets in .env.
```

**Impacto esperado en el loop de feedback:**

| Paso | Sin runbook (StoryPlots actual) | Con runbook (v2) |
|---|---|---|
| Error runtime aparece | Creador lo ve en terminal manual | Claude lee vía `BashOutput` |
| Diagnóstico | Creador copia stack trace al chat | Claude lee + diagnostica directamente |
| Fix aplicado | Claude edita archivo | Claude edita archivo |
| Verificar fix | Creador reinicia server + re-prueba | Claude `KillShell` + re-run + `curl` health |
| Total | ~3-5 min por iteración | ~30-60 seg por iteración |

Esto también conecta con el gap 2 (validation.md objetivo): los health checks del runbook son parte de validation.md de Fase 0 y siguientes. La validation.md dice "backend responde 200 en `/health`"; el runbook dice "para levantarlo, corre X"; Claude ejecuta sin intermediación.

**Nota sobre minimalismo:** tu reclamo *"no quiero tener archivos por tener"* es válido. Este runbook debe ser **un archivo chico, command-ful, casi sin prosa**. Si crece a 100+ líneas algo está mal — es un cheat sheet, no documentación. Si el setup es muy simple (ej: un `pnpm dev` único), puede vivir como sección dentro de `specs/tech-stack.md` en lugar de archivo aparte. Regla de dedo: si el runbook necesita >40 líneas para describir el arranque, el stack probablemente es más complicado de lo que debería.

---

## 4. La tensión filosófica: tu instrucción original prohibía roadmap

Esto es importante sacarlo: `greenfield_seed_instructions.md` líneas 7 y 582-586 **explícitamente prohíben** roadmap y sprint tickets:

> The seed is not a sprint backlog.
> However, do not include: sprint tickets, exhaustive file-by-file implementation plans, speculative long-term roadmap details that are not foundational.

La filosofía era: **la semilla describe qué es el producto; un planner (/ultraplan) lo sequencia dinámicamente por ciclo**.

**Esta decisión, combinada con el objetivo de autonomía, es la raíz del drift.** Si la secuencia se decide por ciclo, el creador debe aprobar cada decisión de secuencia. Si la secuencia está pre-decidida en la semilla, Claude ejecuta sin preguntar.

**La resolución correcta:** un roadmap de fases **es foundational truth**. No es un sprint backlog (tareas) ni un tracker de tickets. Es **una decisión de producto** sobre qué se construye primero y en qué orden — eso **pertenece al seed**. El curso spec-driven lo pone ahí con razón.

**Revisión propuesta** a `greenfield_seed_instructions.md` para v2:

> The seed is not a sprint backlog of tickets. But the seed **is** the roadmap of phases — each phase is a shippable slice with scope and exit criteria. The per-phase implementation plan (`plan.md`) is *not* in the seed; it is generated inside `specs/phase-NN-slug/` when work on that phase begins.

Esto conserva el espíritu (no tracker de tickets) pero admite que **el orden de construcción es parte de la identidad del producto**.

---

## 5. Propuesta — Shape v2 de tu semilla

### 5.1 Arquitectura de tres capas

```
Capa 1 — Constitución (aprueba UNA vez, cambia raro)
   ├── Seed/                 — qué es el producto (lo que ya tienes)
   ├── specs/roadmap.md      — en qué orden se construye (NUEVO)
   ├── specs/tech-stack.md   — con qué se construye + qué NO usar (NUEVO)
   └── DesignSystem/         — visual tokens (cuando aplique; opcional)

Capa 2 — Specs por fase (una carpeta por fase; aparece cuando la fase arranca)
   └── specs/phase-NN-slug/
       ├── requirements.md   — scope + decisiones + out-of-scope
       ├── plan.md           — grupos de tareas numerados
       └── validation.md     — Definition of Done objetiva

Capa 3 — Registro (append-only, automático cuando se pueda)
   ├── CHANGELOG.md          — una línea por commit, reverse-chron (auto desde git)
   └── SESSION_HANDOFF.md    — slim, <100 líneas, sólo WIP entre sesiones
```

### 5.2 Árbol de archivos del seed v2

```
ProyectoNuevo/
├── CLAUDE.md                       — convenciones del harness, precedencia, plugins
├── README.md                       — cómo arrancar el repo
├── CHANGELOG.md                    — auto desde git (skill /changelog)
├── SESSION_HANDOFF.md              — slim; sólo WIP y notas intra-sesión
│
├── Seed/                           — tu semilla actual se mantiene tal cual
│   ├── README.md
│   ├── creator-vision.md           — equivalente a mission.md del curso, pero con más fuerza
│   ├── product.md
│   ├── user-stories.md
│   ├── domain.md
│   ├── architecture.md             — RESTRUCTURA: sólo responsabilidades + flows, no stack details
│   ├── schema.md
│   ├── ux.md
│   ├── design.md
│   ├── open-questions.md
│   └── (opcional) Reference/        — evidencia secundaria observada
│
├── specs/                           — NUEVA CARPETA (capa 1 + capa 2)
│   ├── roadmap.md                   — NUEVO (fases 1-N con scope + exit criteria)
│   ├── tech-stack.md                — NUEVO (sacado de architecture.md §1, + "What NOT to use")
│   ├── dev-runbook.md               — NUEVO (comandos para arrancar stack, Claude los maneja)
│   ├── feature-spec-template.md     — NUEVO (plantilla que /feature-spec usa)
│   │
│   ├── phase-00-bootstrap/          — NUEVO (Fase 0 skeleton)
│   │   ├── requirements.md
│   │   ├── plan.md
│   │   └── validation.md
│   │
│   └── phase-NN-slug/               — creado dinámicamente al arrancar cada fase
│       ├── requirements.md
│       ├── plan.md
│       └── validation.md
│
├── skeleton/                        — NUEVO (starter repo del Bootstrap)
│   ├── package.json                 — deps pinneadas desde tech-stack.md
│   ├── tsconfig.json
│   ├── frontend/src/
│   ├── backend/
│   ├── db/migrations/001_init.sql
│   └── .env.example
│
└── design-system/                   — implementación visual (opcional)
```

**Cambios clave vs. tu semilla actual:**

1. Agrega `specs/roadmap.md`, `specs/tech-stack.md`, `specs/dev-runbook.md`, `specs/feature-spec-template.md`, `specs/phase-00-bootstrap/`, `skeleton/`, `CHANGELOG.md`.
2. Slimea `SESSION_HANDOFF.md`.
3. Restructura `architecture.md` para que **no duplique** tech-stack (el stack vive en `specs/tech-stack.md`; architecture sólo tiene responsabilidades, subsistemas, flows).
4. El ciclo 0001 del repo **no** es auth-scaffold — es Fase 0 Bootstrap, pre-definida.
5. `CLAUDE.md` agrega sección "Dev environment management" con el contrato de que Claude maneja servers (runbook + tools de background).

### 5.3 Contenido mínimo de cada archivo nuevo

#### `specs/roadmap.md`

```markdown
# Roadmap

Las fases son rebanadas shippables. Cada fase tiene scope acotado, exit criteria
objetivos (typecheck + tests + smoke), y un spec folder con tres artefactos.

Status: ⏳ en progreso · ✅ shipped · 🔒 bloqueada · ⏭️ deferida

---

## Fase 0 — Bootstrap 🔒
- Skeleton repo con deps pinneadas (de specs/tech-stack.md)
- Folder layout: frontend/src/, backend/, db/migrations/
- Migración vacía + tabla users con RLS
- Smoke test: servidor arranca, DB conecta, GET / devuelve 200
- Playwright instalado, un test noop que pasa
- **Exit**: validation.md de phase-00-bootstrap pasa

## Fase 1 — Auth + empty shell ⏳
- Supabase auth (email/password + magic link)
- User persona CRUD (primera creación forzada on first login)
- Shell navegable: Home + Characters + Conversations + Settings rutas con placeholders
- Se cubren user stories: US-01, US-02, US-03 (referir por ID a user-stories.md)
- Flows: F1 parcial (first-run hasta el shell, sin chat aún)
- **Exit**: validation.md de phase-01-auth-shell pasa

## Fase 2 — Characters CRUD ⏳
- Crear, editar, listar, borrar characters
- Character form con todos los campos del schema
- Avatar upload (URL por ahora, no generación)
- **Exit**: flows F1 completo (first-run termina con character creado)

## Fase 3 — Conversations core (send + stream) ⏳
- Crear conversation desde character
- Chat UI: input + message list
- Backend: POST /chat con SSE streaming
- BYOK: usuario pega API key en Settings
- **Exit**: flow F2 (chat end-to-end con respuesta en stream)

## Fase 4 — Grammar Agent (opt-in) ⏳
- Toggle grammar per-conversation
- Grammar Agent isolated (nunca en Conversation prompt)
- Dashboard mínimo: listado de correcciones
- **Exit**: flow F3 + non-negotiable "grammar never leaks into conversation" verified

## Fase 5 — Lorebook + Author's Notes ⏳
...

## Fase 10 — Design polish ⏳
- Sólo cuando Fases 1-9 estén shipped
- DesignSystem/ toma precedencia visual
- No reestructura layout — sólo re-skin
- **Exit**: todas las pantallas cumplen DesignSystem tokens, Playwright visual reg pass

---

## Fuera de roadmap (explícito, para que no se propongan)
- Mobile native
- Multi-tenant
- Admin panel
- Analytics dashboard
```

**Puntos clave:**

- Cada fase tiene **scope acotado**, user stories referidas por ID, flows referidos por ID, exit criteria.
- Las fases **empiezan por structure/layout** (Fase 1 shell navegable) y **terminan con polish/design** (Fase 10). Esto matchea tu preferencia: "el layout debe irse haciendo porque sino luego le cuesta los cambios".
- "Fuera de roadmap" es explícito — previene que Claude proponga features fuera de alcance.

#### `specs/tech-stack.md`

```markdown
# Tech Stack

## Core
| Layer | Choice | Version | Rationale |
|---|---|---|---|
| Language | TypeScript | 5.6.x | Strict mode end-to-end |
| Frontend framework | React + Vite | react@18.3, vite@5.4 | SPA con HMR rápido |
| Backend | FastAPI | 0.115 | Python async, tipado, docs auto |
| DB | Supabase (PostgreSQL) | SDK 2.45 | Auth + RLS + realtime en uno |
| Styling | CSS custom properties | — | Sin build de CSS |

## Testing
- Vitest (frontend unit)
- pytest (backend)
- Playwright (e2e, requerido por ciclo que toque UI)

## Tooling
- pnpm (lockfile estricto, deps pinneadas)
- tsc --noEmit para typecheck
- prettier + ruff

## What We Are NOT Using
- No Next.js (Vite es suficiente; SSR no es requisito)
- No ORM (queries directas vía supabase-js)
- No Redux (contexto + React Query si hace falta)
- No React Native / mobile (roadmap "Fuera de alcance")
- No Docker (deploy directo a Vercel + Supabase hosted)
- No GraphQL (REST + SSE es suficiente)
- No Tailwind (CSS custom properties + DesignSystem tokens)
```

**Por qué la sección "NOT Using" es crítica:** cuando Claude ve un problema, su primer impulso es "¿qué herramienta resuelve esto?". Si ya le dijiste "no Redux", no te va a proponer un refactor a Redux en el ciclo 30 cuando el state management se pone complicado — va a proponer una solución dentro de lo permitido.

#### `specs/feature-spec-template.md`

```markdown
# Feature Spec Template

Cuando una fase arranca, Claude crea `specs/phase-NN-slug/` con tres archivos.

## 1. requirements.md

\`\`\`markdown
# Requirements — Fase NN: {{slug}}

## Scope
- Lista bullet de qué se entrega en esta fase.
- User stories cubiertas: US-XX, US-YY (link a user-stories.md)
- Flows cubiertos: F1 (parcial), F2 (completo) (link a user-stories.md §6)

## Out of Scope
- Lista explícita de qué NO está en esta fase (aunque se relacione).
- Features que caen en fases posteriores.

## Decisions
- Decisión técnica 1 (con rationale breve si no es obvio desde tech-stack)
- Decisión UX 1 (con referencia a ux.md)

## Domain Invariants Check
- Listar invariantes de domain.md que esta fase toca
- Para cada uno: cómo se preserva

## Open Questions
- Listar preguntas que quedaron ambigüas del seed (si hay)
- Para cada una: propuesta de default + request de confirmación
\`\`\`

## 2. plan.md

\`\`\`markdown
# Plan — Fase NN: {{slug}}

Grupos de tareas numerados. Cada grupo es revisable independientemente.

## Group 1 — Skeleton del feature
1. Crear migración: db/migrations/NNN_{{slug}}.sql
2. Crear endpoint backend: POST /api/{{resource}}
3. Agregar type compartido frontend/backend

## Group 2 — UI básica
4. Crear componente {{X}}
5. Wiring a endpoint
6. Estado loading/error/empty

## Group 3 — Integration
7. Playwright test del flow F2 (pasos 1-5)
8. TypeScript passes

Cada task ≤2 horas. Si uno se siente >2h, splitearlo.
\`\`\`

## 3. validation.md

\`\`\`markdown
# Validation — Fase NN: {{slug}}

## Definition of Done — TODAS deben pasar antes de merge

### 1. TypeScript + backend typecheck
\`\`\`
pnpm typecheck
cd backend && mypy .
\`\`\`
Exit 0 ambos, sin warnings nuevos.

### 2. Unit tests
\`\`\`
pnpm test
cd backend && pytest
\`\`\`
Coverage nuevos ≥ 80% en archivos modificados.

### 3. Playwright e2e — flow específico
\`\`\`
pnpm playwright test tests/phase-NN-{{slug}}.spec.ts
\`\`\`
Escenarios cubiertos:
- Happy path (flow FX paso a paso)
- Edge case 1: {{descripción}}
- Error case 1: {{descripción}}

### 4. Manual smoke checklist (Playwright no cubre)
- [ ] En viewport L (1440×900), layout correcto
- [ ] En viewport S (375×812), layout correcto
- [ ] Accesibilidad keyboard: tab atraviesa controles en orden
- [ ] Un user story end-to-end desde la lista de F1-F7

### 5. Code-review + code-simplifier plugins
- [ ] code-review pass ejecutado, findings triaged en plan
- [ ] code-simplifier pass ejecutado, diff revisado

### 6. Non-negotiables check (creator-vision §8)
- [ ] Ningún invariant violado
- [ ] (Si aplica) Agent isolation preservado
- [ ] (Si aplica) Grammar off-by-default preservado
- [ ] ...

### 7. CHANGELOG + commit
- [ ] CHANGELOG.md actualizado (auto con /changelog skill)
- [ ] Commit con formato: "feat(phase-NN): {{slug}} — {{scope}}"
\`\`\`
```

**Punto clave de validation.md:** todo es objetivo o checkboxable. Claude puede auto-validar sin preguntarte. Solo escala si algo falla y no puede arreglarlo solo.

#### `specs/phase-00-bootstrap/`

Esta fase YA viene escrita en el seed (parte de la plantilla). Contenido:

```markdown
# Requirements — Fase 0: Bootstrap

## Scope
- Repo inicializado con skeleton/
- Deps pinneadas a las versiones de specs/tech-stack.md
- Folder layout: frontend/src/, backend/, db/migrations/
- Migración 000_init.sql: tabla _migrations + tabla users (RLS enabled)
- Smoke test: servidor arranca, DB conecta, GET / responde 200
- Playwright instalado, un test noop que pasa

## Out of Scope
- Auth (va en Fase 1)
- Cualquier feature de producto (Fases 1+)

## Decisions
- Usar pnpm (tech-stack.md)
- TypeScript strict desde línea 1
- Migraciones SQL planas, no ORM
```

El `plan.md` y `validation.md` de Fase 0 vienen pre-escritos en el seed.

### 5.4 Workflow autónomo con resumibilidad

#### Ceremonia 1: arranque de proyecto (creator hace esto UNA vez)

```
1. Creator: llena Seed/ (creator-vision + user-stories son high-authority inputs)
2. Claude (o creator): genera el resto del Seed siguiendo greenfield_seed_instructions v2
3. Creator: llena specs/roadmap.md (fases con scope + exit)
4. Creator: llena specs/tech-stack.md (stack + NOT-using)
5. Claude: escribe specs/phase-00-bootstrap/ a partir de la plantilla
6. Creator: revisa y aprueba Capa 1 completa
7. Creator: abre primera sesión de implementación
```

A partir de aquí, el creador **no aprueba nada más** hasta que una fase termina o algo se escala.

#### Ceremonia 2: arranque de sesión (cada vez que abres Claude Code)

```
Claude al arrancar:
1. Lee CLAUDE.md (convenciones, no cambian)
2. Lee specs/roadmap.md — ve check marks, identifica fase en progreso
3. Lee specs/phase-NN-slug/ (los tres archivos de la fase actual)
4. Si SESSION_HANDOFF.md existe y tiene WIP, lo lee (debería ser <100 líneas)
5. Propone el próximo grupo de tareas de plan.md
6. Si creator no interrumpe, empieza a ejecutar
```

Observa: **Claude NO lee** el SESSION_HANDOFF histórico ni los ciclos anteriores. Sólo lee lo mínimo necesario para retomar. CHANGELOG está ahí si necesita histórico, pero no es lectura obligatoria.

#### Ceremonia 3: bucle por fase

```
Para cada fase en roadmap.md (en orden):

A. Setup de fase (al arrancar la fase):
   - Claude lee Seed/ relevante para la fase (sólo las secciones que la fase toca)
   - Claude lee PersonaLLM-Reference homólogo (si aplica)
   - Claude escribe specs/phase-NN-slug/requirements.md
   - Si hay ambigüedad high-impact: AskUserQuestion UNA vez
   - Claude escribe specs/phase-NN-slug/plan.md y validation.md
   - Claude hace commit con los 3 archivos: "docs(phase-NN): spec de {{slug}}"

B. Ejecución (sin intervención del creator):
   Para cada grupo de tareas en plan.md:
     - Claude implementa
     - Claude corre los sub-checks del grupo (typecheck parcial si aplica)
     - Si falla algo: Claude intenta fix. Si no puede en 3 intentos: escala con mensaje
     - Commit por grupo: "feat(phase-NN): group N — {{brief}}"

C. Validación (al terminar todos los grupos):
   - Claude corre validation.md top-to-bottom
   - Todo check: pass
   - Si algo falla: fix (bucle hasta pasar, máximo N intentos)
   - Si no puede pasar solo: escala

D. Cierre de fase:
   - Claude corre /changelog skill → actualiza CHANGELOG.md
   - Claude hace commit final: "feat(phase-NN): SHIP {{slug}}"
   - Claude marca fase ✅ en roadmap.md
   - Claude actualiza SESSION_HANDOFF.md con 5-10 líneas: "Fase NN shipped; next: fase NN+1"
   - Claude para y dice "Fase NN completa. ¿Arranco fase NN+1?"

E. Próxima fase: repite desde A.
```

**Intervención del creator en este workflow:**

- **Planeada:** sólo entre fases (E → A siguiente). Creador confirma "sí, arranca" o redirige.
- **Reactiva:** si Claude escala (Step B/C falla N veces).
- **Opcional:** si creador quiere revisar algo a mitad de fase, puede — pero no es parte del flujo.

**Cambio de sesión mid-fase:**

- Claude al cerrar sesión: actualiza SESSION_HANDOFF.md con "Fase NN en progreso, Group N terminado, Group N+1 siguiente, no hay bloqueos".
- Siguiente sesión: Claude lee SESSION_HANDOFF (5 líneas) + specs/phase-NN-slug/ + continúa en Group N+1.
- **Sin sincronizar manualmente 665 líneas de narrativa.**

### 5.5 Nomenclatura: Constitution, Seed, Specs — qué nombre usar

Tu pregunta: *"vi que en spec kit eso es como el constitution, no sé qué nombre es mejor."* Resumen honesto:

**No existe una convención unificada.** El término "constitution" viene de dos lugares distintos:

- **El curso que tomaste** (spec-driven development) usa "constitution" **informalmente** para referirse al trío `mission.md + roadmap.md + tech-stack.md` en `specs/`. No es un nombre de folder ni de archivo — es una etiqueta conceptual para "las cosas que no cambian y guían todo lo demás".
- **GitHub Spec Kit** (proyecto separado, similar en filosofía) sí usa literalmente un archivo `memory/constitution.md` con reglas/principios del proyecto.

**Lo que los dos comparten:** la idea de que hay un **layer inmutable de reglas + decisiones estratégicas** que se aprueba una vez y gobierna todo el resto. El nombre es secundario.

**Mi recomendación para tu v2** (sin crear archivos por crear):

| Nombre | Qué contiene | Por qué este nombre |
|---|---|---|
| **`Seed/`** | creator-vision, product, domain, user-stories, schema, ux, design, open-questions, reference/ | Ya tienes este nombre. Funciona. Describe "material fundacional del producto". No lo cambies. |
| **`specs/`** | roadmap.md, tech-stack.md, dev-runbook.md, feature-spec-template.md + phase-NN-slug/ subfolders | "Specs" es el término que el curso usa. Neutral, claro. Contiene tanto foundational (top-level) como por-fase (subfolders). |
| **"La Constitución"** | Concepto, no folder: la unión de `Seed/` + los top-level de `specs/` (roadmap + tech-stack + dev-runbook) | Etiqueta conceptual — **el conjunto que el creador aprueba una vez y Claude consulta como fuente inmutable**. Puede mencionarse en `CLAUDE.md` como "the constitution = Seed + specs top-level", sin ser un folder. |

**Regla de dedo que matchea tu principio de "no archivos por tener":**

Un archivo existe si:
1. **Cambia por razones distintas** al resto. (roadmap cambia cuando el creador re-scopea fases; tech-stack cambia cuando se añade/quita una dep; dev-runbook cambia cuando el stack cambia. Son vectores diferentes.)
2. **Tiene un audience distinto** de lectura. (Claude al arrancar fase lee roadmap + phase actual; Claude al arrancar sesión lee dev-runbook + CLAUDE.md; Claude al investigar domain lee Seed/. Son momentos distintos.)
3. **Se consulta aisladamente** sin leer el resto. (No tiene sentido leer validation.md sin leer requirements.md primero, pero sí tiene sentido leer dev-runbook.md sin leer user-stories.md.)

Si un archivo no cumple ninguno de los tres, fusionarlo con el más cercano. Ejemplo: si tu stack es tan simple que dev-runbook son 5 líneas, fúndelo como sección en `tech-stack.md`. Si tu roadmap es de 3 fases, fúndelo en `README.md`. No inflar estructura.

**Lo que NO recomiendo:**

- Llamar `Seed/` "Constitution/" — cambia el nombre sin cambiar nada sustantivo.
- Crear un archivo `constitution.md` aparte que repita principios ya en `creator-vision.md` — duplica sin añadir.
- Meter roadmap/tech-stack dentro de `Seed/` — pierde la separación entre "spec de producto" (estable) y "plan de ejecución" (puede evolucionar).

**El nombre importa menos que la disciplina:** lo que previene drift es **la disciplina de aprobar un conjunto de archivos antes de empezar a implementar, y no modificarlos casualmente después**. El nombre es etiqueta. Tu `Seed/` funciona; quédate con él.

#### Ceremonia 4: escalation

Cuando Claude escala (Step B o C no se puede resolver solo):

- Mensaje al creator con: qué grupo falló, qué intentos se hicieron, qué hipótesis de root cause, qué ayuda pide.
- Creator responde en chat — sin tocar el seed a menos que sea un bug foundational.
- Si es bug foundational: creator aprueba append a `Seed/open-questions.md`, Claude continúa con default + flag.

---

## 6. Cómo cada adición cierra un gap concreto de StoryPlots

| Gap observado en StoryPlots | Cierre en v2 |
|---|---|
| Ciclo 0027 scope bloat (3 features en 1 ciclo) | `roadmap.md` tiene una fase por feature; scope en `requirements.md` no es negociable sin re-aprobar roadmap |
| Ciclos 0028-0031 iteración sobre 0014-0026 | Orden de fases en `roadmap.md` pone fundaciones primero (memory antes que visual roleplay) |
| Ciclo 0025 fantasma | Con `specs/phase-NN-slug/` carpetas, un false-start tiene archivo con `status: abandoned` en frontmatter — nada desaparece |
| Renumeración retroactiva 0070 | `roadmap.md` incluye "Fase 10a Global chrome" como decisión foundational antes de polish |
| Approval por-ciclo | `validation.md` objetivo reemplaza "creator lee y dice sí" con typecheck + tests + smoke pass/fail |
| SESSION_HANDOFF 665 líneas | CHANGELOG.md (auto) + roadmap.md (check marks) + SESSION_HANDOFF slim (<100 líneas) |
| Ciclo 0032 docs-only retroactivo | Workflow checklist vive en `CLAUDE.md` + `feature-spec-template.md` desde día 1 |
| /ultraplan kickoff invoca spec engine en cada ciclo | Roadmap + feature-spec-template reemplazan /ultraplan como motor de planeación. /ultraplan se elimina del critical path (ver §14.8 — se pega, no confiable, cubierto por plantilla markdown) |
| "Layout sufre cambios después" | Fase 1 del roadmap es "Empty shell navegable con layout correcto desde día 1" — layout no se toca en fases de feature |
| "Claude no levantaba los servers" | `specs/dev-runbook.md` + convención en `CLAUDE.md` de que Claude maneja servers con `run_in_background` + `BashOutput` + `KillShell` — el creador sólo hace Supabase/deploy/secrets |
| "Loop código→error→fix lento" | Claude lee sus propios logs vía `BashOutput` en lugar de pedirle al creador que pegue stack traces |

---

## 7. Cómo la v2 satisface tu goal de resumibilidad

Tu palabra: *"cada cierto rato pueda cambiar de sesión y solo continuar porque hay una guía clara y no hace falta cargar contexto."*

Traducción a métricas:

| Propiedad | StoryPlots actual | Seed v2 |
|---|---|---|
| Lectura obligatoria al arrancar sesión | CLAUDE.md (700 lines) + SESSION_HANDOFF (665 lines) + ciclo anterior + seed relevante ≈ 80K tokens | CLAUDE.md (conventions only, ~200 lines) + roadmap.md (100 lines) + phase-NN-slug/ (300 lines total) + SESSION_HANDOFF slim (<100 lines) ≈ 15K tokens |
| "¿Dónde quedé?" | Requiere leer narrativa de Estado actual | Check mark en roadmap.md + grupo en-progreso en plan.md |
| "¿Qué hago a continuación?" | Requiere interpretar conversación pasada | El siguiente grupo no-shipped de plan.md |
| "¿Está terminada esta fase?" | Requiere review creativo del creator | validation.md: todos los checks pass |
| Cambio de sesión intra-fase | Requiere update manual de SESSION_HANDOFF | Un append de 3 líneas al final de session |

Tu intuición original estuvo cerca: **el potencial de /ultraplan tuvo que estar antes, haciendo un roadmap.** En v2 eso se formaliza: `/ultraplan` para secuenciar es reemplazado por `roadmap.md` (pre-escrito) + `feature-spec-template.md` (instancia por fase). `/ultraplan` **se elimina del v2** porque en tu experiencia se pegaba / ocupaba browser / no era confiable (ver §14.8 para la curación completa de plugins).

---

## 8. Trade-offs y riesgos

### Trade-off 1: Autonomía vs. flexibilidad de scope
- **Con roadmap fasado:** menos flexible. Si en fase 3 descubres que la fase 5 debería ser diferente, hay fricción para cambiar roadmap.
- **Mitigación:** `roadmap.md` es append-only + mutable-con-aprobación, igual que `open-questions.md`. Cambios se loguean. Si una fase se re-scopea, se crea nueva entrada y la vieja queda marcada `superseded`.

### Trade-off 2: Validation.md pre-escrita puede ser incompleta
- Si validation.md se escribe junto con plan.md, antes de código, puede olvidar edge cases que sólo aparecen al implementar.
- **Mitigación:** validation.md es editable durante la fase. Si Claude descubre un edge case, agrega el check a validation.md + lo implementa. El gate se mantiene pre-code-finish, no pre-code-start.

### Trade-off 3: Skeleton puede bakear decisiones equivocadas
- Skeleton con deps pinneadas puede envejecer mal (Supabase SDK saca v3, por ej).
- **Mitigación:** Fase 0 bootstrap incluye un check de "deps outdated > 6 months" y se re-versiona. Skeleton es semilla, no concreto.

### Trade-off 4: Más archivos = más mantenimiento
- v2 agrega roadmap + tech-stack + 3 archivos por fase + CHANGELOG.
- **Mitigación:** la mayoría se generan una vez y cambian raro. CHANGELOG es auto. Feature spec template es boilerplate. La carga total es menor que mantener un SESSION_HANDOFF de 665 líneas sincronizado.

### Riesgo 1: Claude sigue escalando demasiado
- Incluso con validation.md objetivo, Claude puede ser tímido y escalar cosas que debería resolver solo.
- **Mitigación:** en `CLAUDE.md`, política de escalation: "intenta resolver 3 veces antes de escalar; si el fix es obvio (formatting, import missing, typo), no escales".

### Riesgo 2: Roadmap mal diseñado rompe todo
- Si roadmap tiene fases mal ordenadas (feature antes que su fundamento), v2 propaga el error.
- **Mitigación:** Fase 0 Bootstrap valida que el skeleton funcione antes de cualquier feature. Roadmap review con el plugin `feature-dev` o equivalent puede validar DAG de dependencias.

---

## 9. Qué conservar idéntico de tu enfoque actual

No todo cambia. Estas piezas del StoryPlots seed se mantienen tal cual en v2:

- **Document precedence numerada** (tu sistema de 11 niveles + PersonaLLM-Reference #12).
- **Non-negotiables en creator-vision §8** — estos son foundational truth, no de fase.
- **Non-invention + non-omission rules** — ambos siguen siendo guardarraíles.
- **Open-questions.md append-only** — sigue siendo el registro de ambigüedad.
- **PersonaLLM-Reference pattern** — si tu proyecto clona un app observado, la separación "observed vs. extended" vale.
- **Plugin discipline** (code-review, code-simplifier, playwright mandatory, context7 para libraries, serena para semantic nav).
- **CLAUDE.md como harness-level doc** — sigue siendo el tablero central de convenciones.
- **Seed/ frozen durante implementación, open-questions append-only como excepción** — mismo principio.

---

## 10. Cambios sugeridos a `greenfield_seed_instructions.md` para soportar v2

Si vas a usar greenfield_seed_instructions como prompt para generar semillas v2 de proyectos futuros, editas:

1. **Líneas 7-10** (quitar la prohibición absoluta de roadmap): cambiar a *"The seed is not a sprint backlog of tickets. The seed IS the phased roadmap; per-phase plans are generated into specs/phase-NN-slug/ when work begins."*
2. **Líneas 72-86** (seed folder structure): agregar `specs/` al lado de `Seed/`, con roadmap.md + tech-stack.md + feature-spec-template.md.
3. **Líneas 407-429** (architecture.md section): mover stack a `specs/tech-stack.md`; architecture queda solo con subsystems + flows + responsabilidades.
4. **Líneas 582-586** (lo que no incluir): mantener "no sprint tickets" pero eliminar "no roadmap"; agregar "roadmap.md es foundational".
5. **Nueva sección** después de línea 660: *"# Phased roadmap requirement"* explicando que roadmap.md debe cubrir todas las user stories Critical + High en fases ordenadas, y que cada fase tiene scope + exit objetivos.
6. **Nueva sección**: *"# Per-phase spec template requirement"* describiendo requirements/plan/validation como obligatorios.
7. **Nueva sección**: *"# Skeleton bootstrap requirement"* — Fase 0 con repo ejecutable antes de features.

---

## 11. Decisiones que aún me faltan para concretar más (si quieres)

Estas las puedo proponer pero ameritan tu input antes de convertirlas en un seed template real:

1. **¿Qué contenido mínimo debe tener `specs/roadmap.md`** para un StoryPlots v2? Puedo proponer las ~10 fases basándome en user-stories.md actual, pero tú decides el orden.
2. **¿`specs/feature-spec-template.md` debería ser un skill de Claude** (como el `/changelog` del curso), o un plain markdown que Claude copia?
3. **¿`CLAUDE.md` del proyecto v2 debe ser manual o generado?** Si es generado, podría usar `greenfield_seed_instructions.md` v2 como fuente.
4. **¿Validación de roadmap**: antes de arrancar Fase 0, ¿quieres que Claude haga un dry-run de roadmap.md (checando que cada fase tenga exit criteria, user stories cubiertas, no-gaps entre fases)?
5. **¿Plugins obligatorios en v2**: los 7 de StoryPlots (feature-dev, frontend-design, code-review, code-simplifier, context7, playwright, serena) mantenerlos, o curar?

---

## 12. Verification — cómo comprobar que la semilla v2 funciona

Este documento es análisis, no implementación — pero si quisieras validar el diseño antes de re-hacer StoryPlots:

**Test A (mini greenfield):** elige un producto toy de 5-6 fases (ej: un clon de Linktree con auth). Autor la semilla v2 siguiendo este documento. Arranca Claude con la ceremonia 1 + 2. Mide:

- ¿Cuántas veces Claude pide aprobación en fases 1-3?
- ¿Cuánto contexto (tokens) lee al arrancar cada sesión?
- ¿Cuántos grupos de tareas de plan.md fallaron validation.md al primer intento?
- ¿Cuántas veces Claude escaló por ambigüedad no prevista?

**Criterio de éxito:** Claude completa las primeras 3 fases con ≤2 aprobaciones y ≤10K tokens de lectura por arranque de sesión.

**Test B (retrofitting StoryPlots):** tomar StoryPlots actual, escribir `specs/roadmap.md` retroactivamente (marcando 0001-0072 como shipped), y arrancar la Fase 11 (siguiente feature real). Mide si la siguiente sesión arranca sin leer SESSION_HANDOFF.

**No-requirement:** no hace falta validar antes de decidir. La propuesta es lo suficientemente específica para arrancar una semilla v2 de un proyecto real y aprender empíricamente.

---

## 13. Resumen ejecutivo (para que le muestres a tu yo de dentro de 2 meses)

- Tu hipótesis del **routemap** era correcta — pero no única. Son **7 gaps**, y los tres más importantes después del roadmap son: (a) la **rúbrica pre-escrita requirements/plan/validation** por fase, (b) **tech-stack.md aparte con "What NOT to use"**, y (c) **dev-runbook.md + convención de que Claude maneja los servers** (eso solo triplicaba la velocidad del loop).
- Tu semilla actual tiene excelente contenido foundational (invariants, precedencia, open-questions, PersonaLLM-Reference). Eso se mantiene.
- Lo que falta es: (1) la **capa de secuenciación** (roadmap), (2) la **capa de gates objetivos** por fase (los 3 archivos), y (3) la **capa de operación** (dev-runbook + contrato de que Claude corre servers). Las tres combinadas habilitan autonomía + resumibilidad.
- Una semilla v2 tiene: **Seed/** (tal cual) + **specs/roadmap.md + specs/tech-stack.md + specs/dev-runbook.md + specs/phase-NN-slug/{requirements,plan,validation}.md + specs/feature-spec-template.md** + **skeleton/** + **CHANGELOG.md (auto)** + **SESSION_HANDOFF.md slim**.
- El workflow cambia de "creator aprueba cada ciclo + levanta servers manualmente" a "creator aprueba capa 1 una vez + maneja sólo Supabase/deploy/secrets; Claude ejecuta fase-a-fase, maneja servers, lee sus propios logs, valida objetivo, escala sólo si falla".
- Tu instrucción original en `greenfield_seed_instructions.md` explícitamente prohibía roadmap — esa es la decisión filosófica a cambiar en v2.
- Layout/estructura pertenece a Fase 1 (no a pulido); design polish va en última fase. Eso matchea tu preferencia explícita.
- Sobre nombres: "Constitution" es etiqueta conceptual del curso/spec-kit, no nombre de archivo. Mantén `Seed/` como está. `specs/` es el folder donde viven roadmap + tech-stack + runbook + phase-NN subfolders. La unión = "la Constitución" (que el creador aprueba una vez).
- **Framing clave (ver §15):** no estás construyendo un framework de greenfield, estás definiendo un **estándar de seed portable**. El framework lo pone el downstream que elijas (spec-kit / ECC / vanilla Claude Code + plugins). Tu v2 mapea casi 1-to-1 a spec-kit, es ortogonal a ECC, y es exactamente lo que hiciste con vanilla Claude Code. Nombre formal del estándar: **"Seed Standard v2"**.
- **Experimento comparativo (ver §16):** el goal no es ganarle a los frameworks sino medir que **un seed robusto reduce la varianza entre ellos**. Corre el mismo Seed v2 en vanilla/spec-kit/ECC sobre las Fases 0-3 de StoryPlots, captura 11 métricas por corrida, y decide con evidencia. Métrica principal: cuán pequeña es la diferencia entre A, B y C — si es pequeña, el seed es bueno y puedes elegir framework por gusto sin ansiedad.

---

## 14. Estructura final, nombres y matriz de propiedad

Esta sección consolida el shape para que la puedas usar como plantilla. Tres piezas:

1. **Árbol final con nombres fijos** (copiar-pegar).
2. **Convenciones de naming** (por qué cada elección).
3. **Matriz de propiedad**: qué archivo tiene autoridad sobre qué + qué **NO** debe contener (para evitar duplicación).

### 14.1 Árbol final (copiar-pegar para un proyecto nuevo)

```
ProyectoNuevo/
│
├── CLAUDE.md                           — convenciones del harness Claude Code
├── README.md                           — onboarding humano al repo
├── CHANGELOG.md                        — log auto-generado desde git
├── HANDOFF.md                          — WIP intra-sesión, <100 líneas
│
├── Seed/                               — PRODUCT SPEC (qué es el producto)
│   ├── README.md                       — índice de Seed/ (solo links + 1 línea)
│   ├── creator-vision.md               — intent creador + no-negociables
│   ├── product.md                      — scope + MVP + out-of-scope + users
│   ├── user-stories.md                 — stories + flows F1..FN + priority
│   ├── domain.md                       — modelo conceptual + invariants + términos
│   ├── schema.md                       — forma de datos + RLS + aislamiento
│   ├── ux.md                           — screens + states + modals + flows
│   ├── design.md                       — principios visuales + anti-patterns
│   ├── architecture.md                 — responsabilidades + subsistemas + flows técnicos
│   ├── open-questions.md               — ambigüedad append-only
│   └── reference/                      — evidencia observada (opcional)
│
├── specs/                              — EXECUTION SPEC (cómo + en qué orden)
│   ├── roadmap.md                      — fases 0..N con scope + exit + check marks
│   ├── tech-stack.md                   — libs + versiones + "What NOT using"
│   ├── dev-runbook.md                  — comandos + puertos + health checks
│   ├── feature-spec-template.md        — plantilla de los 3 archivos de fase
│   │
│   └── phase-NN-slug/                  — uno por fase; creado al arrancar la fase
│       ├── requirements.md             — scope + decisiones + out-of-scope
│       ├── plan.md                     — grupos numerados de tareas
│       └── validation.md               — DoD objetivo (pass/fail)
│
├── skeleton/                           — starter repo (se consume en Fase 0 y desaparece)
│   ├── package.json
│   ├── tsconfig.json
│   ├── frontend/
│   ├── backend/
│   ├── db/migrations/000_init.sql
│   └── .env.example
│
└── design-system/                      — implementación visual (opcional)
    ├── README.md
    ├── tokens.css                      — colores, typography, spacing, radii
    ├── preview/                        — HTML cards de componentes
    └── ui-kits/                        — JSX reference (si aplica)
```

**No hay carpeta `plans/`.** En v2 todo lo per-cycle vive en `specs/phase-NN-slug/`. La carpeta `plans/` de tu StoryPlots actual queda eliminada.

### 14.2 Convenciones de naming — por qué cada elección

| Regla | Aplica a | Razón |
|---|---|---|
| **PascalCase** | `Seed/` únicamente | Señaliza **espec inmutable** (frozen durante implementación). Se distingue visualmente de mutables |
| **lowercase-kebab** | `specs/`, `skeleton/`, `design-system/`, `reference/`, `phase-NN-slug/` | Estándar de filesystems/tooling; mutable-durante-implementación |
| **Archivos .md kebab-case** | `creator-vision.md`, `tech-stack.md`, `dev-runbook.md`, `feature-spec-template.md`, `open-questions.md` | Legible, sin ambigüedad de separadores |
| **UPPERCASE.md en root** | `CLAUDE.md`, `README.md`, `CHANGELOG.md`, `HANDOFF.md` | Convención GitHub + Claude Code. Visibles al abrir repo |
| **Fase con zero-padding** | `phase-00-bootstrap/`, `phase-01-auth-shell/`, `phase-10-design-polish/` | Ordenamiento alfabético = ordenamiento cronológico. NN de 2 dígitos aguanta hasta fase 99 (suficiente) |
| **Slug descriptivo** | `phase-04-grammar-agent`, no `phase-04` | Se lee de un vistazo qué hace la fase sin abrir el folder |

**Renombramientos desde StoryPlots actual:**

- `SESSION_HANDOFF.md` → `HANDOFF.md` (más corto, mismo rol)
- `DesignSystem/` → `design-system/` (consistencia lowercase)
- `PersonaLLM-Reference/` → `reference/` (o mantener nombre específico si clonas un app puntual)
- `plans/` → **eliminar**; equivalente vive en `specs/phase-NN-slug/`

### 14.3 Matriz de propiedad — qué contiene cada archivo y qué NO

La regla: **cada hecho vive en exactamente un archivo**. Si dos archivos hablan del mismo tema, uno es autoritativo y el otro linkea.

| Archivo | Propósito (1 línea) | Autoridad (OWNS) | NO contiene (prohibido duplicar) |
|---|---|---|---|
| **`CLAUDE.md`** | Convenciones runtime del harness | Precedencia documental, plugins + cuándo usarlos, dev-env convention, cycle workflow, escalation policy | Contenido de producto (vive en `Seed/`); roadmap (vive en `specs/roadmap.md`); histórico (vive en `CHANGELOG.md`) |
| **`README.md` (root)** | Onboarding humano al repo | Install quickstart, links a `Seed/README.md` + `specs/roadmap.md` + `CLAUDE.md` | Spec de producto; workflow; precedencia |
| **`CHANGELOG.md`** | Log inmutable de lo shipped | Una línea por commit, reverse-chron por fecha, auto-generado por `/changelog` skill | Roadmap pendiente; WIP; narrativa de decisiones |
| **`HANDOFF.md`** | WIP intra-sesión (<100 líneas) | Último commit + grupo en progreso + bloqueos si hay | Convenciones (CLAUDE.md); roadmap (specs/); histórico (CHANGELOG.md); seed content |
| **`Seed/README.md`** | Índice de Seed/ | Lista de los 10 archivos de Seed/ con 1 línea de propósito cada uno | Precedencia (CLAUDE.md); workflow; contenido de los archivos que lista |
| **`Seed/creator-vision.md`** | Highest-authority creator intent | No-negociables, identidad del producto, principios conceptuales | Implementación; stack; screens; schema |
| **`Seed/product.md`** | Qué producto es | Scope, MVP cutline, out-of-scope, success criteria, target users, constraints | Stack técnico; screens específicos; detalles de schema; secuencia de build |
| **`Seed/user-stories.md`** | Qué necesitan hacer los usuarios | Stories con priority + AC + flows F1..FN + related-screens/entities | Implementación; layouts exactos; schema físico |
| **`Seed/domain.md`** | Modelo conceptual | Entidades, relaciones, lifecycle, invariants conceptuales, terminología canónica | Schema físico (Seed/schema.md); UI; comportamiento backend |
| **`Seed/schema.md`** | Forma de datos + aislamiento | Tablas + columns + RLS + scoping + unique/FK constraints + migraciones del spec | Invariants conceptuales (Seed/domain.md); UI; business logic |
| **`Seed/ux.md`** | Contrato de pantallas y flujos | Sitemap, screen inventory, modal registry, required states, non-omission, flows end-to-end | Visual tokens (Seed/design.md + design-system/); backend behavior |
| **`Seed/design.md`** | Visual north star | Principios visuales, anti-patterns, palette baseline textual, typography baseline textual | **Tokens concretos** (viven en `design-system/tokens.css`); screens (Seed/ux.md) |
| **`Seed/architecture.md`** | Responsabilidades técnicas | Frontend/backend split, subsistemas, integration boundaries, flows técnicos | **Stack concreto con versiones** (vive en `specs/tech-stack.md`); comandos (specs/dev-runbook.md); schema físico |
| **`Seed/open-questions.md`** | Registro de ambigüedad | Preguntas abiertas, decisiones pendientes, contradicciones, asunciones temporales | Respuestas confirmadas (se mueven a su seed file cuando se resuelven) |
| **`Seed/reference/`** | Evidencia secundaria (opcional) | Screenshots, notas del app observado, audits, diagramas | Nada autoritativo — siempre secundaria al Seed |
| **`specs/roadmap.md`** | Secuencia de fases | Fase 0..N con scope + user stories cubiertas + flows + exit criteria + check marks de status | Tareas atómicas (viven en `specs/phase-NN-slug/plan.md`); contenido de acceptance (validation.md) |
| **`specs/tech-stack.md`** | Stack concreto + "What NOT" | Libs + versiones pinneadas + rationale + "NOT using" list explícita | Comandos de run (dev-runbook); arquitectura conceptual (Seed/architecture.md); migraciones |
| **`specs/dev-runbook.md`** | Cómo correr el stack local | Comandos concretos + puertos + health checks + reglas de "Claude maneja servers" | Stack elegido (tech-stack.md); tools del harness (CLAUDE.md); secretos |
| **`specs/feature-spec-template.md`** | Plantilla de fase | Shape de requirements/plan/validation que Claude copia al arrancar fase nueva | Contenido de fase específica |
| **`specs/phase-NN-slug/requirements.md`** | Scope de esta fase | Stories cubiertas (referencia por ID), decisiones, out-of-scope, open-qs locales | Tareas de ejecución (plan.md de la misma fase); gates (validation.md) |
| **`specs/phase-NN-slug/plan.md`** | Ejecución en grupos | Grupos numerados de tareas (≤2h cada una), cada grupo revisable independiente | Scope (requirements.md); gates (validation.md) |
| **`specs/phase-NN-slug/validation.md`** | Definition of Done | Typecheck + tests + smoke + non-negotiables check + CHANGELOG update | Pasos de ejecución (plan.md); scope (requirements.md) |
| **`skeleton/`** | Starter repo para Fase 0 | `package.json` pinneado, folder layout, migración inicial, `.env.example`, smoke test base | Features concretas (vienen en Fases 1+); contenido real de la app |
| **`design-system/`** | Implementación visual concreta | Tokens CSS (`tokens.css`), previews HTML, ui-kits JSX | Principios (Seed/design.md); screens (Seed/ux.md); behavior |

### 14.4 Duplicaciones resueltas

Problemas que tu StoryPlots actual tiene (o riesga tener) y cómo v2 los elimina:

| Duplicación | StoryPlots actual | v2 |
|---|---|---|
| **Precedencia documental** | En `CLAUDE.md` + `Seed/README.md` | **Solo en `CLAUDE.md`**. `Seed/README.md` es índice puro, sin reglas |
| **Stack técnico** | `Seed/architecture.md` §1 tiene stack + `stack-decisions.md` era fuente previa | **Solo en `specs/tech-stack.md`**. `Seed/architecture.md` queda con responsabilidades + flows, sin versiones/libs |
| **Convenciones del harness** | CLAUDE.md + SESSION_HANDOFF.md repetían cycle workflow, plugin playbook, precedence rules | **Solo en `CLAUDE.md`**. HANDOFF.md es WIP puro |
| **Estado del proyecto** | SESSION_HANDOFF.md mezclaba shipped log + roadmap planeado + onboarding + convenciones (665 líneas) | **Split en 3:** `CHANGELOG.md` (shipped), `specs/roadmap.md` (pending con check marks), `HANDOFF.md` (WIP actual <100 líneas) |
| **Visual: principios vs. tokens** | `Seed/design.md` tenía palette + DesignSystem/ tiene tokens | **`Seed/design.md` solo principios + anti-patterns textuales**. `design-system/tokens.css` tiene hex/rem/números. Nunca duplican |
| **Domain invariants vs. schema** | Potencial overlap en domain.md + schema.md | `domain.md` dice **por qué** ("Lorebook es per-conversation, no global"); `schema.md` dice **cómo** ("FK conversation_id + RLS `user_id = auth.uid()`"). Invariant vive en domain; implementación en schema |
| **Per-cycle plans** | `plans/NNNN-slug.md` mezclaba scope + execution + verification | **Split en 3 archivos dentro de `specs/phase-NN-slug/`** |
| **Skeleton vs. código real** | Todo scaffoldeó en ciclo 0001 (mezcla de bootstrap + feature) | **`skeleton/` separado**, consumido y eliminado en Fase 0 |

### 14.5 Migración mínima desde tu StoryPlots actual (si decidieras aplicar v2 retroactivamente)

No necesitas hacer esto — pero si quisieras:

**Conservar tal cual:**
- `Seed/creator-vision.md`, `Seed/product.md`, `Seed/user-stories.md`, `Seed/domain.md`, `Seed/schema.md`, `Seed/ux.md`, `Seed/design.md`, `Seed/open-questions.md`
- `CLAUDE.md`
- `README.md`

**Renombrar:**
- `SESSION_HANDOFF.md` → `HANDOFF.md` (y reducir a <100 líneas)
- `DesignSystem/` → `design-system/`
- `Seed/PersonaLLM-Reference/` → `Seed/reference/` (opcional; si prefieres mantener el nombre porque es específico, OK)

**Agregar (crear desde cero):**
- `specs/roadmap.md` — puedes escribirlo retroactivamente marcando 0001-0072 como shipped y listando fases pendientes
- `specs/tech-stack.md` — sacar §1 de `Seed/architecture.md`; agregar "What NOT using" con lo que ya descartaste
- `specs/dev-runbook.md` — comandos para levantar frontend/backend + convención Claude-maneja-servers
- `specs/feature-spec-template.md` — la plantilla de 3 archivos
- `CHANGELOG.md` — correr el skill una vez, genera desde git todo el histórico

**Modificar:**
- `Seed/architecture.md` — remover §1 (stack); dejar solo responsabilidades + subsistemas + flows
- `Seed/README.md` — reducir a índice puro (links + 1 línea c/u); mover precedencia a `CLAUDE.md` si no está ya ahí

**Eliminar:**
- Carpeta `plans/` (al archivar en rama o borrar; reemplazada por `specs/phase-NN-slug/` para fases nuevas)

**Esfuerzo estimado:** 2-4 horas de reorganización + 2-3 horas de redactar roadmap retroactivo + tech-stack. Luego la siguiente fase ya arranca sobre v2.

### 14.6 Orden de lectura al arrancar una sesión (con presupuesto de tokens)

Cuando Claude abre una sesión nueva, lee en este orden. Para cuando tenga lo que necesita:

| # | Archivo | Tokens aprox. | Por qué |
|---|---|---|---|
| 1 | `CLAUDE.md` | 3-5K | Convenciones del harness: cómo usar plugins, precedencia, dev-env rules |
| 2 | `HANDOFF.md` | 0-1K | Si existe WIP, retoma ahí. Si no, salta |
| 3 | `specs/roadmap.md` | 2-3K | Check marks → identifica fase en curso o siguiente |
| 4 | `specs/phase-NN-slug/*.md` (los 3) | 3-5K | Los tres archivos de la fase activa |
| 5 | `specs/dev-runbook.md` | 0.5K | Si necesita levantar stack |
| 6 | `Seed/*.md` selectivo | 2-10K | Solo las secciones que la fase toca (no folder entero) |

**Total obligatorio para arrancar: 8-15K tokens.** Comparado con los ~80K que tu `SESSION_HANDOFF.md` + ciclo anterior + seed relevante requerían en StoryPlots.

**Lo que Claude NO lee al arrancar:**
- `CHANGELOG.md` — solo si el usuario pregunta histórico
- Fases pasadas (`specs/phase-NN-slug/` de NN shipped) — solo si investiga decisión específica
- `Seed/reference/` — solo si Seed es silent en un detalle
- `design-system/` — solo si la fase toca visual
- `README.md` root — solo si es primera vez que abre el repo

### 14.7 Regla de decisión para futuras adiciones

Si en el futuro aparece la tentación de agregar un archivo nuevo, aplicar las tres reglas de §5.5:

1. ¿Cambia por razones distintas al resto? (Si sí, archivo nuevo justificado.)
2. ¿Tiene audience/momento-de-lectura distinto? (Si sí, archivo nuevo justificado.)
3. ¿Se consulta aisladamente sin leer otros? (Si sí, archivo nuevo justificado.)

Si no cumple **ninguna** de las tres → fusionar con el archivo más cercano. Ejemplos:

- "Guía de estilo de commits" → no cumple ninguna → va como sección en `CLAUDE.md`
- "Lista de environment variables" → cumple 2 (diferente audience) → va como sección en `specs/tech-stack.md`
- "Playbook de incidentes" → cumple 1 y 2 → archivo propio `specs/incident-runbook.md` (solo cuando haya producción)

### 14.8 Plugins y skills — qué quitar, qué mantener, qué es opcional en v2

**Tu observación:** *"los ultra plan no son muy efectivos, a veces se pegan, ocupan el browser, no me sirvieron"* + el goal de evitar herramientas que hagan casi lo mismo.

**Reconocimiento honesto:** en mi propuesta anterior dejé `/ultraplan` como "opcional para sub-planear dentro de fase". Tu crítica es correcta — si se pega y ocupa browser, no debería estar en el critical path **ni siquiera como opción**. Lo quito.

#### Por qué `/ultraplan` ya no es necesario en v2

Los tres roles que `/ultraplan` jugaba en StoryPlots están cubiertos por otras piezas sin necesidad de un skill que pueda colgarse:

| Rol de `/ultraplan` en StoryPlots | Cómo se cubre en v2 |
|---|---|
| Generar el plan del ciclo | `specs/feature-spec-template.md` — Claude copia la plantilla y escribe los 3 archivos con Read/Write/Edit. Cero dependencia externa |
| Forzar citas al seed | La plantilla de `requirements.md` tiene campos explícitos ("User stories cubiertas: US-XX", "Domain invariants: …"). Claude los llena leyendo `Seed/`. No hace falta un skill que lo policie |
| Disciplina non-omission + non-invention | `validation.md` objetivo (typecheck + tests + smoke) + non-negotiables check en CLAUDE.md. Gate automático verificable, no check humano interpretativo |

**Recomendación explícita:** `/ultraplan` **eliminado del v2**. No aparece en `CLAUDE.md`, no aparece en el roadmap, no se menciona como backup. Si un día vuelve a funcionar bien, puede ser convenience tool para "pensar en voz alta" en un problema complejo — pero nunca bloqueante.

#### Sobre tu pregunta del slash (`/ultraplan` vs `ultraplan`)

En Claude Code hay tres formas de invocar capabilities — útil distinguirlas porque el comportamiento cambia:

| Forma | Cómo se hace | Cuándo aplica |
|---|---|---|
| **Slash command del usuario** | Tipeas `/name` en el chat | Es skill invocado **por ti**. El harness lo procesa y se lo pasa a Claude como instrucción |
| **Skill tool (programático)** | Claude llama `Skill(skill: "name", args: "…")` — sin slash | Claude invoca el skill internamente. Mismo efecto que el slash, pero disparado por Claude |
| **MCP tool directo** | Claude llama `mcp__plugin_X__tool_Y(...)` | Cuando el plugin expone tools específicos (ej. `mcp__plugin_playwright_playwright__browser_snapshot`). No pasa por el mecanismo de skill |

El flaky-behavior que describes (se pega, ocupa browser) probablemente viene de **cómo el skill está implementado internamente** (cloud session que se cuelga, dependencia de browser session), no de cómo se invoca. Cambiar `/ultraplan` → `ultraplan` no arregla el problema raíz. La solución es **no depender de él**.

#### Curación de plugins para v2 — criterio y lista final

De los 7 plugins que usa StoryPlots, aplicar estos tres filtros:

1. **¿Entrega output concreto verificable?** (playwright → screenshot real; code-review → findings diffable; /ultraplan → prosa variable)
2. **¿Es reemplazable por tools base de Claude si se cae?** (code-simplifier → Claude revisa diff; playwright → no, es único; serena → sí, Grep+Read)
3. **¿Bloquea una fase si se cae?** (playwright en fase UI → sí, bloqueante; serena → no; /ultraplan → no)

**Resultado para v2:**

| Plugin/skill | Rol | Status v2 | Si se cae |
|---|---|---|---|
| **context7** | Docs actualizados de libs externas | **Load-bearing**. Respaldo a "non-invention" en APIs de terceros | WebFetch + docs oficiales |
| **playwright** | E2E verification en fases UI | **Load-bearing**. Es el gate objetivo de validation.md | Sin playwright no se puede validar UI — bloquea fase hasta reponer |
| **code-review** | Pass pre-merge | **Load-bearing**. Mandatory en validation.md | Claude hace revisión inline leyendo diff |
| **code-simplifier** | Podar especulación/abstracciones prematuras | **Útil, no crítico**. Validation.md ya cubre scope; esto es extra hygiene | Claude revisa diff bajo principio non-invention |
| **frontend-design** | Generación creativa en design cycles | **Opcional**. Solo fase polish visual; reemplazable por DesignSystem + Seed/design.md | Claude lee design-system/ directamente |
| **serena** | Navegación semántica por símbolos | **Opcional**. Útil en repos grandes (>200 archivos) | Grep + Read |
| ~~`/ultraplan`~~ | ~~Generar plan por ciclo~~ | **Eliminado**. Cubierto por feature-spec-template | N/A — no se usa |
| ~~`storyplots-design` skill~~ | ~~Priming design rules específico proyecto~~ | **Específico a StoryPlots**. En v2 aplicaría equivalente solo si el proyecto tiene un DesignSystem complejo | Leer design-system/README.md directamente |

**Set mínimo para v2:** `context7` + `playwright` + `code-review`. Con esos tres funcionas. Los demás son aceleradores, no requeridos.

#### Regla práctica para el futuro

**Si un plugin se ha pegado 2+ veces en tu experiencia real, en v2 no está en el critical path.** Como máximo convenience tool, nunca gate obligatorio. Los gates obligatorios son **archivos** (validation.md) + **tools base** (Bash, Read, Edit) + **plugins con track record de confiabilidad** (playwright y context7 en tu caso).

Esto también aplica al principio de "no cosas que hagan casi lo mismo": si `/ultraplan` y `feature-spec-template.md` cubren el mismo rol (producir un plan por fase), quédate con el que no se pega. La plantilla markdown nunca falla.

---

## 15. El seed como estándar portable (framework-agnostic)

**Recalibración importante** que emerge de tu clarificación: lo que estás construyendo **no es un framework de greenfield**. Es un **estándar de seed** — un formato portable de especificación que cualquier downstream framework puede consumir.

Esta distinción importa porque cambia el scope de la propuesta:

- **Framework de greenfield:** definirías CLI, slash commands, pipeline de ejecución, memoria del agent, observers, etc. (lo que hacen spec-kit y ECC). Scope enorme.
- **Estándar de seed:** defines **qué archivos, qué contenido, qué precedencia, qué naming**. El framework lo pones tú eligiendo un downstream. Scope acotado y reusable.

Tu goal es el segundo. El resto de este documento ya converge hacia eso — esta sección lo explicita y mapea tu seed a los 3 downstream que tienes en la mesa.

### 15.1 Los tres downstream frameworks y qué son

| Framework | Qué es | Qué provee | Link |
|---|---|---|---|
| **GitHub Spec-Kit** | Herramienta open-source de spec-driven development. CLI `specify` + slash commands `/speckit.constitution`, `/speckit.specify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.implement`. Agnóstica de agente (soporta Claude, Copilot, Cursor, Codex) | Workflow de spec→plan→tasks→implement + convenciones de folders | github.com/github/spec-kit |
| **Everything Claude Code (ECC)** | "Performance optimization system for AI agent harnesses." Cross-harness (Claude Code, Codex, Cursor, OpenCode, Gemini). 38 agents + 156 skills + hooks + observers | Optimizaciones de harness: token optimization, memory persistence, continuous learning, security scanning | github.com/affaan-m/everything-claude-code |
| **Vanilla Claude Code + plugins** | Claude Code base + plugins instalados localmente (feature-dev, code-review, playwright, context7, serena). `CLAUDE.md` como convención del harness | Workflow convencional + plugins curados. Lo que hiciste en StoryPlots | anthropic.com/claude-code |

**Los tres son opciones válidas de ejecución del seed.** Ninguno reemplaza al seed; cada uno es cómo el AI agent consume el seed para producir código.

### 15.2 Mapeo del v2 seed a spec-kit (casi 1-to-1)

Spec-kit es el downstream más alineado con tu v2 — su mental model es el mismo (constitution + specs per feature):

| Tu v2 seed | Spec-kit equivalent | Nota |
|---|---|---|
| `Seed/creator-vision.md` + principios §8 | `memory/constitution.md` | Spec-kit llama "constitution" a lo que tú llamas "creator-vision + principles". Mismo rol |
| `Seed/product.md` + `Seed/user-stories.md` + `Seed/ux.md` | Input a `/speckit.specify` (el "what" y "why") | Tu seed es más rico (separas product de stories de ux); spec-kit los consume juntos |
| `Seed/domain.md` + `Seed/schema.md` | No tiene equivalente explícito — se expresa dentro de specify/plan | Tu separación es más rigurosa; spec-kit no la fuerza pero la acepta |
| `specs/tech-stack.md` | Input a `/speckit.plan` | Idéntico concepto |
| `specs/dev-runbook.md` | No tiene equivalente nativo | Es una extensión tuya. Va como anexo al plan |
| `specs/roadmap.md` | Spec-kit no tiene roadmap nativo | **Extensiones community lo añaden** (ej: "AIDE — AI-Driven Engineering" listado en el catálogo de spec-kit). Tu roadmap.md pega tal cual como extensión |
| `specs/phase-NN-slug/requirements.md` | `specs/NNN-feature/spec.md` | Mismo rol |
| `specs/phase-NN-slug/plan.md` | `specs/NNN-feature/tasks.md` | Spec-kit llama al plan "tasks". Nombre distinto, contenido igual |
| `specs/phase-NN-slug/validation.md` | No lo separa — se incluye dentro de spec.md o tasks.md | **Tu separación es mejora opcional.** Puedes mantenerla sin romper compatibilidad con spec-kit; solo queda como archivo extra |
| `Seed/open-questions.md` | No tiene nativo | Extensión tuya. Compatible |
| `Seed/reference/` | No tiene nativo | Extensión tuya. Compatible |

**Veredicto:** tu v2 seed es **superset** compatible con spec-kit. Podrías instalar spec-kit en un proyecto nuevo (`specify init .`) y luego pegarle tu `Seed/` como material complementario. Los slash commands `/speckit.*` seguirían funcionando; tus archivos extra (open-questions, reference, validation separada, roadmap) quedan como valor agregado.

### 15.3 Mapeo del v2 seed a vanilla Claude Code + plugins

**Exactamente lo que hiciste en StoryPlots.** Sin CLI especial, sin slash commands de framework. Claude Code base + `CLAUDE.md` como convenciones + plugins (context7, playwright, code-review).

- `Seed/` + `specs/` son la fuente de verdad de producto y ejecución
- `CLAUDE.md` enchufa las convenciones del harness a esos archivos
- Los plugins son herramientas ad-hoc que Claude invoca durante el trabajo

**No hay mapeo que hacer** — el seed vive directamente en el repo y Claude lo lee. Es el path más simple, el que ya dominas.

### 15.4 Mapeo del v2 seed a Everything Claude Code (ECC)

**ECC es ortogonal al seed, no un reemplazo.** ECC se enfoca en **cómo el agente ejecuta**, no en **qué ejecuta**.

- El seed sigue siendo `Seed/` + `specs/`
- ECC se añade como capa de harness por encima
- Los skills de ECC (ej. `typescript-reviewer`, `python-patterns`) complementan tus plugins de vanilla
- Los hooks de memory persistence de ECC pueden mejorar la resumibilidad entre sesiones
- Los observer loops pueden auto-capturar patrones como skills nuevos

**No hay conflicto con el seed.** Si adoptas ECC, tu `Seed/` + `specs/` viven igual; ECC solo añade optimizaciones de performance al harness. Es la opción "vanilla + ECC" — compatible con la opción 3.

### 15.5 El contrato mínimo del seed para ser framework-agnostic

Para que tu seed sea portable a cualquiera de los tres (y a otros que salgan después), debe cumplir estas condiciones mínimas:

1. **Archivos en markdown plano** — sin dependencia de plantillas de framework específico
2. **Precedencia declarada** (en `CLAUDE.md`) — el downstream sabe qué archivo gana en conflicto
3. **Naming consistente** (§14.2) — el downstream puede parsear el shape sin heurísticas
4. **Separación semilla/ejecución** — `Seed/` (inmutable) vs `specs/` (mutable) le dice al downstream qué aprobar una vez vs qué iterar
5. **Ninguna dependencia de slash commands o plugins específicos** — el contenido debe ser legible por cualquier LLM, no solo Claude
6. **Principios non-invention + non-omission + non-ambiguity** — guardarraíles universales, no specific-to-framework

Tu v2 cumple los 6. Eso es lo que hace el seed **portable**.

### 15.6 La "guía" que quieres — qué debe ser y qué no

Dijiste: *"no quiero poner más archivos de la cuenta, o cosas que hacen casi que lo mismo... eso sí con una guía correcta, que es la que quiero tener."*

**La guía NO es un archivo nuevo del seed.** Es una sección dentro de `README.md` (root) que:

1. Dice **qué downstream framework usa este proyecto** (spec-kit, ECC, vanilla — uno y solo uno)
2. Linkea a la docs de ese framework
3. Indica cómo el `Seed/` + `specs/` se enchufa con ese framework
4. Da el comando de arranque ("para continuar, abre Claude Code y lee CLAUDE.md + specs/roadmap.md")

Plantilla mínima (30-50 líneas):

```markdown
# Nombre del Proyecto

## Seed Standard compliance

Este proyecto sigue el **Seed Standard v2**. El `Seed/` contiene la espec de producto
(inmutable durante implementación); `specs/` contiene ejecución (roadmap + tech-stack
+ per-phase specs).

## Downstream framework en uso

Este proyecto se ejecuta con **{Vanilla Claude Code + plugins | GitHub Spec-Kit | ECC}**.

- Docs del framework: {link}
- Cómo arranca una sesión: leer `CLAUDE.md` → `specs/roadmap.md` → fase actual
- Plugins/skills instalados: ver `CLAUDE.md` § Installed plugins

## Cómo contribuir cambios

- Seed/: solo cambia con aprobación del creador (append-only en open-questions.md es excepción)
- specs/: fases nuevas se añaden cuando arrancan; las shipped se marcan en roadmap.md
- Dev environment: ver `specs/dev-runbook.md`

## Para continuar el trabajo

Abre Claude Code y tipea: "Lee CLAUDE.md y continúa desde la fase actual en specs/roadmap.md"
```

**Nada más.** No es un framework-picking guide de 500 líneas. Es un punto de entrada que dice "aquí hay un seed compatible con X, cámbialo siguiendo Y".

### 15.7 Sobre el nombre "Seed" — mi recomendación formal

Preguntaste si otro nombre sería más correcto. Mi respuesta: **quédate con "Seed"**. Razones concretas:

| Alternativa | Por qué no |
|---|---|
| "Constitution" | Spec-kit ya tomó este nombre y lo usa para principios solamente (no para user-stories/schema/ux). Colisiona |
| "Project charter" | Corporate, suena a documento único. Tu Seed/ es multi-archivo estructurado |
| "Blueprint" | Connotación arquitectónica técnica; amarra a un dominio que no es necesariamente el tuyo |
| "Spec bundle" | Genérico, no transmite portabilidad ni prioridad de aprobación |
| "Greenfield kit" | Amarra al caso greenfield. Tu seed podría aplicar a brownfield con ajustes menores |
| "Genesis" / "Foundation" | Metafóricos pero no estándar; confunden |

**"Seed" funciona porque:**

- No colisiona con ningún downstream (ninguno de los tres usa "seed" como término interno)
- La metáfora es acertada: **seed = material genético portable**; el downstream es el **suelo + agua** que lo hace crecer
- Ya lo usas con consistencia
- Es corto, memorable, no-jerga

**Nombre formal del estándar:** `Seed Standard v2` (o `Seed Spec Standard v2`, si prefieres más formal). Un proyecto puede declarar "cumple Seed Standard v2" en su README y eso es suficiente.

### 15.8 Qué hacer ahora — path recomendado

No hace falta escoger downstream hoy. Lo que sí conviene hacer si vas a empezar un proyecto nuevo con esta semilla v2:

1. **Definir "Seed Standard v2" como tu formato personal** — este documento ya lo hace; puedes copiar §14 como anexo a tu README en la plantilla
2. **Mantener flexibilidad de downstream** — no hardcodees "spec-kit" ni "ECC" en el seed; deja al README del proyecto nuevo decir cuál se usa
3. **Empezar con vanilla Claude Code + plugins** (lo que ya dominas) — y probar spec-kit o ECC en proyectos posteriores para validar portabilidad
4. **Si probar spec-kit:** `specify init new-project --ai claude` y luego pegar tu `Seed/` en paralelo a `memory/constitution.md`. Spec-kit funcionará; tu seed queda como spec más rica
5. **Si probar ECC:** instalar el plugin de ECC encima de vanilla. No requiere cambios al seed

**Valor de haber hecho este ejercicio:** ahora cuando elijas un downstream, sabes exactamente **qué archivos de tu seed ceden terreno al framework y cuáles se mantienen**. Eso es lo que un estándar portable te da.

---

## 16. El experimento comparativo — protocolo para medir ventaja del seed

**Tu plan explícito:** tomar el Seed Standard v2 (ya mejorado con los 7 gaps resueltos) y ejecutar el mismo scope de StoryPlots desde cero con cada downstream framework. Comparar cuál converge mejor al mismo resultado.

Esto es un experimento controlado válido. El goal **no** es ganarle a los frameworks — es **medir qué ventaja te da un seed más robusto independientemente del framework que use**. Si el seed es bueno, las tres corridas convergen con menos drift, menos intervención, y el variance entre frameworks disminuye. **Eso es la ventaja del seed: reduce el coupling entre "qué framework elijo" y "qué termino construyendo".**

### 16.1 Lo que el experimento mide

Dos preguntas separables:

1. **¿El seed v2 es mejor que el seed v1 (el original de StoryPlots)?**
   Se mide comparando cualquier corrida del experimento vs. tu histórico de 72 ciclos. Si con v2 llegas al mismo punto (MVP con F1-F3 shippeable) en **menos ciclos + menos intervenciones + menos drift**, la v2 es mejor. Esta es la pregunta principal.

2. **¿Qué framework ejecuta mejor MI seed?**
   Se mide comparando las 3 corridas entre sí. La diferencia entre ellas te dice **qué framework se alinea con tu estilo de trabajo**. Esta es la pregunta secundaria.

Si tu seed es genuinamente robusto, la respuesta a (1) debería ser "sí" en las tres corridas, y la respuesta a (2) debería ser "las tres llegan a un resultado similar, con diferencias en velocidad y en granularidad de intervención". **Ese es el signal de un buen estándar de seed.**

### 16.2 Setup — qué necesitas tener listo antes de arrancar

Antes de la primera corrida:

1. **Seed v2 completo y congelado** — los archivos de Capa 1 del §14.1 (Seed/ + specs/roadmap.md + specs/tech-stack.md + specs/dev-runbook.md + specs/feature-spec-template.md + skeleton/) todos escritos y revisados
2. **Scope del experimento acotado** — NO rebuildes los 72 ciclos. Define un punto de parada claro:
   - Recomendación: **Fase 0 (Bootstrap) + Fase 1 (Auth shell) + Fase 2 (Characters CRUD) + Fase 3 (Conversations core con SSE + BYOK)**. Eso stress-testea los 7 gaps sin que el experimento se eternice. ~3-4 fases = 1-2 sesiones por framework
3. **Repo base con el seed** — un directorio plantilla que copias 3 veces (uno por framework)
4. **Mismo LLM y mismo budget por corrida** — mismo modelo (ej. Claude Sonnet 4.6 o Opus 4.7), mismo límite de tokens por sesión, mismo número de sesiones permitido
5. **Hoja de métricas vacía** — una tabla para ir anotando (§16.5)

### 16.3 Constantes (lo que NO cambia entre corridas)

Si alguno de estos cambia entre corridas, invalidas el experimento:

- El contenido de `Seed/` — idéntico byte a byte
- `specs/roadmap.md` y `specs/tech-stack.md` y `specs/dev-runbook.md` — idénticos
- `skeleton/` — idéntico
- El scope del experimento (Fase 0-3, criterio de parada)
- El LLM subyacente
- Las validation.md de cada fase (criterio de "done" objetivo)
- Las user stories cubiertas en las fases evaluadas
- Tu nivel de intervención — si en una corrida das feedback detallado y en otra solo "sí/no", falseas la comparación

### 16.4 Variable (lo que cambia)

Solo **el downstream framework**:

| Corrida | Framework | Setup específico |
|---|---|---|
| **A** | Vanilla Claude Code + plugins curados | Lo que ya conoces: `CLAUDE.md` + context7 + playwright + code-review instalados |
| **B** | GitHub Spec-Kit | `specify init . --ai claude`; tu seed queda en paralelo a `memory/constitution.md`; usas slash commands `/speckit.*` |
| **C** | Everything Claude Code (ECC) encima de vanilla | Instalar ECC plugin; mantener tu seed + CLAUDE.md; aprovechar ECC skills + hooks |
| **D** (opcional) | Otro que aparezca | Por si surge un 4º interesante mientras preparas el experimento |

Puedes agregar una corrida de control:

- **Corrida 0 (baseline):** vanilla Claude Code **sin** el seed v2 — solo con el seed original de StoryPlots (v1). Esto es tu baseline histórico (ya lo tienes documentado en los 72 ciclos). No hace falta re-correrlo, pero los números de StoryPlots actual sirven de punto de comparación.

### 16.5 Métricas a capturar por corrida

Para cada corrida anota en una tabla:

| Métrica | Cómo medir | Qué te dice |
|---|---|---|
| **Tiempo total hasta F1 working** | Desde "arranca Fase 0" hasta "F1 smoke test pasa" | Velocidad de convergencia |
| **Número de sesiones** | Cada vez que cambias de sesión de Claude | Resumibilidad real en contexto |
| **Intervenciones creator requeridas** | Cuenta veces que tuviste que aprobar, decidir, o corregir. Separa "aprobación planeada" (entre fases) vs "intervención reactiva" (Claude se atoró) | Autonomía real |
| **Ambigüedades emergentes** | Cuenta entries añadidos a `open-questions.md` durante la corrida | Completitud del seed |
| **Drift events** | Cuenta veces que Claude inventó scope, omitió required surface, o propuso cosas fuera de roadmap | Fuerza de los guardarraíles |
| **validation.md pass rate al primer intento** | De los gates de validation.md, cuántos pasaron sin retry | Calidad del plan.md + seed |
| **Tokens leídos al arrancar cada sesión** | Mide con `/tokens` o similar al inicio | Resumibilidad operativa |
| **Cost en API tokens total** | Al final del experimento | Eficiencia |
| **Commits totales** | `git log --oneline` count | Granularidad del trabajo |
| **Tiempo en que Claude maneja servers vs tú** | Observación cualitativa | Efectividad del dev-runbook (gap 7) |
| **Code quality final** | Typecheck + tests pass + code-review findings | Qué tan similar es el output final |

### 16.6 Hipótesis a validar (las 7 del seed v2)

Para cada gap del §1 TL;DR, el experimento debería confirmar o refutar una hipótesis:

| Gap | Hipótesis con seed v2 | Cómo se valida en el experimento |
|---|---|---|
| 1 — Roadmap | Cero reordenamientos retroactivos entre corridas | No aparece un "insert cycle 0070" style shift |
| 2 — Rúbrica 3-artefactos | validation.md pasa al primer intento >70% del tiempo | Métrica pass-rate en §16.5 |
| 3 — Tech-stack aparte | Claude nunca propone dep fuera del "What NOT using" | Drift events con tipo "dep-creep" = 0 |
| 4 — CHANGELOG separado | `HANDOFF.md` en cada corrida se mantiene <100 líneas | Wc al final de cada sesión |
| 5 — Skeleton | Fase 0 completa en <1h sin intervención | Métrica de tiempo Fase 0 |
| 6 — Resumibilidad | Tokens al arrancar sesión N+1 ≤15K | Métrica de tokens-read |
| 7 — Dev runbook | Claude nunca pide al creator "pega el stack trace" | Observación cualitativa |

Si las 7 hipótesis se confirman en las 3 corridas → **el seed v2 es framework-agnostic robusto**. Si alguna falla solo en una corrida → el seed ok, pero el framework tiene una limitación específica. Si alguna falla en las 3 corridas → el seed necesita iteración (el gap no quedó bien resuelto).

### 16.7 Protocolo paso-a-paso

Para cada corrida (A, B, C):

1. **Crear directorio** `experiment-{A|B|C}/` con copia limpia del seed v2
2. **Wiring específico del framework** (dependiendo de A/B/C)
3. **Abrir Claude Code** (o el agente correspondiente) y dar instrucción inicial:
   > "Lee CLAUDE.md + specs/roadmap.md. Arranca Fase 0 (Bootstrap) siguiendo el workflow del seed. Para entre fases para mi aprobación, no entre grupos de tareas dentro de una fase."
4. **Ejecutar Fase 0** — anotar métricas
5. **Al terminar Fase 0, aprobar y arrancar Fase 1** — anotar métricas
6. **Continuar hasta Fase 3 done** (F1 smoke test pasa)
7. **Cerrar corrida** — anotar totales en hoja de métricas

**Regla de oro:** no mezcles aprendizajes entre corridas. Si en corrida A descubres un bug del seed, anótalo pero **no lo arregles antes de correr B y C**. El seed tiene que ser idéntico en las 3 para que la comparación sea válida. Los fixes van a v3 del seed después del experimento.

### 16.8 Qué hacer con los resultados

Al final tienes una tabla 3×11 (3 corridas × 11 métricas). Posibles patrones:

- **Las 3 corridas tienen métricas similares → el seed es robusto.** El framework importa menos de lo que pensabas. Elige el framework que más te guste por razones tácitas (familiaridad, UX, ecosistema) sin ansiedad de "perderte algo".

- **Una corrida es claramente mejor en casi todas las métricas → ese framework tiene ventaja real para tu stack/estilo.** Adóptalo. Los otros dos quedan documentados como "probados y descartados con evidencia".

- **Cada framework gana en algunas métricas, pierde en otras → hay trade-offs claros.** Ejemplo: spec-kit podría ganar en estructura de specs pero perder en resumibilidad; ECC podría ganar en observers pero perder en setup simplicity. Elige el que gane en **las métricas que más te duelen**.

- **Las 3 corridas fallan en alguna métrica común → el seed todavía tiene un gap.** Identifica cuál, escribe seed v3 con ese gap resuelto, y puedes hacer mini-experimento solo con ese gap.

### 16.9 Qué NO hacer

- **No cambies el seed a mitad del experimento.** Si encuentras un bug del seed, anótalo y termina las 3 corridas antes de arreglar.
- **No intervengas "un poco más" en la corrida del framework que te gusta.** Igual nivel de intervención en las 3 o el experimento no vale.
- **No midas "calidad estética" del código.** Es subjetivo. Quédate con métricas binarias (typecheck pass/fail, tests pass/fail) y conteos (commits, intervenciones, tokens).
- **No intentes reproducir los 72 ciclos de StoryPlots.** Son demasiados para 3 corridas. Fases 0-3 son suficientes stress test.
- **No arranques el experimento sin haber completado el Seed Standard v2 primero.** Si el seed cambia durante la preparación, arrancas de cero las 3 corridas.

### 16.10 Valor del experimento más allá de elegir framework

Aún si las 3 corridas terminan empatadas y tú sigues sin poder decidir — el ejercicio tiene valor por sí mismo:

- **Validación de portabilidad.** Confirmar que el seed funciona con 3 downstream diferentes prueba que el Seed Standard v2 es genuinamente framework-agnostic.
- **Documentación comparativa.** Sales con una tabla real (no hipotética) que puedes publicar o compartir.
- **Identificación de próxima iteración del seed.** Los gaps residuales del v2 se vuelven concretos — base para v3.
- **Disciplina de execución.** Haber corrido el mismo scope 3 veces con métricas te da calibración real de qué tan bien funciona **cualquier** futuro greenfield con un seed similar.

**Resumen de 1 línea:** el experimento no es para ganar, es para saber. Un buen seed **reduce la varianza** entre frameworks; un mal seed **amplifica** las diferencias. Tu métrica de éxito principal es cuán pequeña sea la diferencia entre A, B y C.

---

## Anexo — Lo que este plan NO propone

Para que quede claro:

- **No propone cambiar StoryPlots actual.** StoryPlots se queda como está. Los ciclos 0073+ siguen su flujo actual. La propuesta es para un próximo proyecto (nuevo greenfield o re-hacer StoryPlots desde cero).
- **Elimina `/ultraplan` del critical path de v2.** Su rol lo cubre `feature-spec-template.md` (plantilla markdown que no se cuelga). Si quieres, puede quedar como convenience tool opcional — pero nunca bloqueante, nunca requerido. Ver §14.8.
- **No propone escribir código.** Es un análisis + plantilla de diseño. Si quieres, el próximo paso es autorear una semilla v2 de ejemplo para un proyecto toy, o escribir `roadmap.md` para un StoryPlots v2.
- **No propone cambiar tu Seed/ existente hoy.** Si quisieras aplicar la idea de roadmap a StoryPlots, sería un ejercicio de retrofitting (Test B arriba), no una reescritura.
