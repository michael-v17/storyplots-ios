# CLAUDE.md — StoryPlots v0 Implementation

## Estado actual

StoryPlots v0.1 beta — 89+ cycles shipped en main.

El proyecto se construyó como greenfield desde el Seed (Seed/, Seed/PersonaLLM-Reference/). Esa etapa terminó. Hoy estoy en fase de features nuevos, polish e iteración sobre el sistema completo.

- Seed/ es referencia histórica del origen del proyecto, no autoridad operativa diaria. Consultar solo si necesitás entender una decisión fundacional.
- Features y extras nuevos son válidos aunque no estén en el Seed. El creator los aprueba caso por caso.
- DesignSystem/ es autoridad visual sobre Seed cuando hay conflicto.

Cada feature nuevo sigue el workflow estándar: plan compacto antes de codificar, ejecución con verificación entre subtareas, code-review + code-simplifier al cerrar, Playwright gates para cualquier cambio UI. Los plugins instalados son la diferencia entre código que funciona y código review-ready — usalos activamente.

## Starting a new session — READ THIS FIRST

[SESSION_HANDOFF.md](SESSION_HANDOFF.md) is the **living state** of the project. Read it at the start of every new session — it has:

- Every cycle shipped to date (with scope + key files)
- Current architecture + memory flow + prompt-assembly positions
- Active provider configs + test data (characters, conversations, preferences)
- Project conventions (plans/, migrations manual, commit format, TS strict, etc.)
- User preferences (language, workflow style, default models)
- Roadmap / ideas pendientes (no compromises — the creator decides per session)

**At session close:** update SESSION_HANDOFF.md with any new cycles shipped, new test data, or changes to architecture / conventions. Never let it go more than one session stale.

## Purpose of this folder

This folder is the **implementation destination** for StoryPlots v0 using **vanilla Claude Code** driven by an in-repo plan-first workflow. All code, configs, migrations, and assets for the build live inside this directory.

## Source of truth

- [Seed/](Seed/) — the **frozen spec** for StoryPlots v0. Read it; do not modify it. It is the sole definition of product scope, domain, architecture, schema, UX, and design intent.
- [Seed/PersonaLLM-Reference/](Seed/PersonaLLM-Reference/) — **evidence-first documentation of the observed app that StoryPlots v0 is cloning.** The seed specifies the v0-specific implementation *on top of* this base; PersonaLLM-Reference documents the base behavior being replicated (screens, data model, flows, chat interaction model, 11-position prompt assembly, engine settings, design system). It is the **secondary source of truth**: lower precedence than seed files, but higher than invention. When the seed is silent or thin on a detail, consult the homologous PersonaLLM-Reference file before opening an open-question or asking the creator.
- [References/](References/) — broader background (tech-stack ADR, PersonaLLM raw assets/screenshots). Interpretive only; seed files and PersonaLLM-Reference determine truth.
- [greenfield_seed_instructions.md](greenfield_seed_instructions.md) — original seed-shape doc from project setup. Useful background; not an implementation spec.

Document precedence (higher wins on conflict):

1. [Seed/creator-vision.md](Seed/creator-vision.md)
2. [Seed/README.md](Seed/README.md)
3. [Seed/product.md](Seed/product.md)
4. [Seed/user-stories.md](Seed/user-stories.md)
5. [Seed/domain.md](Seed/domain.md)
6. [Seed/architecture.md](Seed/architecture.md)
7. [Seed/schema.md](Seed/schema.md)
8. [Seed/ux.md](Seed/ux.md)
9. [Seed/design.md](Seed/design.md)
10. [Seed/open-questions.md](Seed/open-questions.md)
11. [Seed/PersonaLLM-Reference/](Seed/PersonaLLM-Reference/) — observed-app base behavior; consulted when the seed above is silent, never to override it.
12. [References/](References/) — raw screenshots and background, interpretive only.

Homologous reference map (use the matching PersonaLLM-Reference file alongside each seed file):

| Seed file | Homologous PersonaLLM-Reference |
|---|---|
| [Seed/ux.md](Seed/ux.md) | [04-screens/](Seed/PersonaLLM-Reference/04-screens/), [02-information-architecture.md](Seed/PersonaLLM-Reference/02-information-architecture.md), [06-chat-interaction-model.md](Seed/PersonaLLM-Reference/06-chat-interaction-model.md) |
| [Seed/schema.md](Seed/schema.md), [Seed/domain.md](Seed/domain.md) | [03-data-model.md](Seed/PersonaLLM-Reference/03-data-model.md) |
| [Seed/architecture.md](Seed/architecture.md) | [07-prompts-and-llm-touchpoints.md](Seed/PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md), [08-generation-parameters.md](Seed/PersonaLLM-Reference/08-generation-parameters.md) |
| [Seed/user-stories.md](Seed/user-stories.md) | [05-flows.md](Seed/PersonaLLM-Reference/05-flows.md) |
| [Seed/design.md](Seed/design.md) | [09-design-system.md](Seed/PersonaLLM-Reference/09-design-system.md), [10-non-functional.md](Seed/PersonaLLM-Reference/10-non-functional.md), [11-web-adaptation-notes.md](Seed/PersonaLLM-Reference/11-web-adaptation-notes.md) |

Unresolved conflicts are logged in [Seed/open-questions.md](Seed/open-questions.md) — they are **not** resolved by invention in code. Before escalating an ambiguity as an open question, verify PersonaLLM-Reference does not already document the observed behavior. If an open question still blocks implementation, stop and ask the creator.

## Design system (visual source of truth for the UI overhaul phase)

[DesignSystem/](DesignSystem/) is the **authoritative implementation of [Seed/design.md](Seed/design.md)** — generated by Claude Design against the PersonaLLM-Reference screenshots and the seed itself. For the visual overhaul phase (starting Cycle 0066), it **wins on UI decisions**: colors, tokens, typography, radii, spacing, elevation, component shapes, iconography, animation curves. The seed complements it when the DesignSystem is silent (copy voice, behavior, states, flows, principles).

- [DesignSystem/README.md](DesignSystem/README.md) — voice, visual foundations, iconography rules, caveats.
- [DesignSystem/SKILL.md](DesignSystem/SKILL.md) — user-invocable skill `storyplots-design`. Invoke it via the Skill tool when working on any visual surface.
- [DesignSystem/colors_and_type.css](DesignSystem/colors_and_type.css) — the canonical token file (CSS custom properties). Frontend imports from here; **do not hardcode hues or type values**.
- [DesignSystem/preview/](DesignSystem/preview/) — 22 HTML cards rendering the tokens and components (buttons, chips, toggles, chat bubble, scenario, action rail, character card, inputs, slider/stepper). Read them before building a component that already exists.
- [DesignSystem/ui_kits/app/](DesignSystem/ui_kits/app/) — reference JSX for Home / Chat / CharacterInfo / CharacterEdit / NewPersona / Settings / AccentPicker / Icon + shared `components.jsx`. These are **reference implementations** — lift patterns and names, adapt to the production routes; do not copy verbatim.
- [DesignSystem/fonts/](DesignSystem/fonts/) — SF Pro family (Display/Text/Rounded). The production app uses SF Pro when available with a system fallback stack; no Google Fonts `<link>` to Inter.
- [DesignSystem/assets/](DesignSystem/assets/) — wordmark + mark SVG.

**Rules for the overhaul:**

1. **DesignSystem wins on visual tokens.** If `Seed/design.md` and `DesignSystem/` disagree on a color, radius, type size, or spacing step, DesignSystem wins — it is the concrete implementation. Non-visual principles (content voice, anti-patterns, non-omission) still come from the seed.
2. **Mobile-first kit, both-platform target.** The kit was authored at iPhone 402×874. Production targets **both desktop and mobile**: the desktop shell (sidebar in L, cycles 0051–0054) is preserved — the overhaul re-skins it with tokens, not restructures it. Mobile uses the single-column patterns from the kit. Both breakpoints must pass Playwright verification each cycle.
3. **Partial kit coverage is expected.** The kit explicitly scopes to Home, Chat, Character Info/Edit, New Persona, Settings. For screens outside the kit (Grammar dashboard, Memory viewer, Prompt Editor, Writing Styles, Image Engine, Gallery, Profile, Data & Security, etc.) **derive the skin from the kit's primitives** (tokens + shared components + `components.jsx` patterns). Document the derivation in the plan.
4. **Invoke the skill.** When starting any cycle that touches a visual surface, call the `storyplots-design` skill via the Skill tool before writing code — it primes the rules and points at the relevant preview/kit file.
5. **Tokens, not hex.** All new styling reads from `colors_and_type.css` custom properties (`--sp-bg`, `--sp-fg-1`, `--sp-accent-*`, `--char-accent`, etc.). Per-character accents are driven at runtime through `--char-accent`; components never hardcode a hue.
6. **Frontend-design plugin is mandatory for design cycles.** Cross-reference its output against this section AND `Seed/design.md` §13 anti-patterns AND `Seed/ux.md` §10 non-omission.
7. **DesignSystem is read-only during implementation.** The kit is the spec for this phase. If it genuinely needs a change, escalate to the creator with the same ritual used for seed modifications.

Precedence for the overhaul phase (higher wins on conflict):
1. Non-negotiables ([Seed/creator-vision.md](Seed/creator-vision.md) §8) — unchanged.
2. **Visual tokens & component shapes** → [DesignSystem/](DesignSystem/).
3. Content voice, states, flows, behavior → seed files per the main precedence table.
4. Observed-app behavior when seed is silent → [Seed/PersonaLLM-Reference/](Seed/PersonaLLM-Reference/).

## Implementation workflow — plan-first

For the step-by-step checklist that each cycle follows end-to-end (propose → save plan → implement → verify → append Verification → update SESSION_HANDOFF → commit), see [SESSION_HANDOFF.md "Cycle workflow — checklist"](SESSION_HANDOFF.md#cycle-workflow--checklist).

Every non-trivial change is planned in `plans/NNNN-slug.md` before code is written. The loop is:

1. **Read the relevant seed sections AND the homologous PersonaLLM-Reference file(s).** Never plan from memory — open the seed file and cite the exact section driving the plan. When the change touches a surface that PersonaLLM-Reference documents (see the homologous reference map above), open that file too: the seed specifies the v0-specific adaptation; the reference specifies the observed base behavior being replicated.
2. **Write the plan to `plans/NNNN-slug.md`** (4-digit zero-padded sequence, kebab-case slug; e.g. `plans/0007-conversation-edit-as-trim.md`). One plan per coherent change. The plan must:
   - list the seed sections it is satisfying (file + section number);
   - where applicable, cite the PersonaLLM-Reference section that documents the observed behavior being replicated (file + section), making the seed-vs-reference provenance explicit per principle 5;
   - enumerate user stories or flows being touched ([Seed/user-stories.md](Seed/user-stories.md) §5, §6);
   - flag every domain invariant ([Seed/domain.md](Seed/domain.md) §6, items 1–20) the change must preserve;
   - identify the schema scope / RLS rules at stake ([Seed/schema.md](Seed/schema.md) §5);
   - name the UX surfaces affected ([Seed/ux.md](Seed/ux.md));
   - call out any open questions it hits ([Seed/open-questions.md](Seed/open-questions.md) §1) — does not silently invent answers, and does not escalate as an open question anything PersonaLLM-Reference already documents;
   - enumerate an **Implementation order of 3-5 atomic subtasks, each with its own Playwright assertion** (or explicit non-UI verify step). Verification happens between subtasks, not only at the end — if a subtask's assertion fails, stop and fix before the next. If a subtask turns out too big, split it in the plan and continue. Single commit at the end with all gates green — no WIP commits.
3. **Get plan approval from the creator** before writing code, for anything beyond trivial fixes. A change is **trivial** only if **all** of the following hold: (a) ≤1 file touched, (b) ≤20 lines net diff, (c) does not touch [Seed/domain.md](Seed/domain.md), [Seed/schema.md](Seed/schema.md), the non-negotiables from [Seed/creator-vision.md](Seed/creator-vision.md) §8, or any prompt-assembly / agent-isolation / SSE code path, (d) does not introduce a new dependency or migration. If in doubt, it is not trivial — write a plan.
4. **Implement against the plan, verifying each subtask before the next.** Run the subtask's Playwright assertion (or non-UI verify) as soon as its code lands; do not start the next subtask until the previous one's gate is green. If reality diverges from the plan, update the plan; do not let the code silently drift.
5. **Verify before closing out.** Every change passes:
   - a self-check against the non-omission list in [Seed/ux.md](Seed/ux.md) §10 and the non-negotiables in [Seed/creator-vision.md](Seed/creator-vision.md) §8;
   - a `code-review` plugin pass;
   - a `code-simplifier` pass to prune speculative code;
   - for any change that touches a navigable UI surface, a `playwright` run exercising the relevant flows from [Seed/user-stories.md](Seed/user-stories.md) §6 and the required states from [Seed/ux.md](Seed/ux.md). Record in the plan which flows/states were exercised and the result.

Verification notes (which flows/states were exercised by Playwright, `code-review` findings, `code-simplifier` deltas) are appended to the same plan file under a `## Verification` section — not scattered into separate docs. Plans are working artifacts, not deliverables: keep them small, reviewable, and current.

## Installed plugins

The following Claude Code plugins are installed locally for this folder. Use them actively; they exist to reduce invention and catch drift. Prefer plugin entrypoints over raw MCP calls — plugins wrap the underlying tools with the right workflow prompts. See [SESSION_HANDOFF.md "Plugin playbook"](SESSION_HANDOFF.md#plugin-playbook) for a one-glance when-to-use table with skip conditions.

| Plugin | When to use |
|---|---|
| **`feature-dev`** | Primary driver for new feature work, used together with the in-repo plan. Start here for any change that spans more than one file. |
| **`frontend-design`** | Whenever the change touches UI. Cross-reference its output against [DesignSystem/](DesignSystem/) (tokens, previews, kit), [Seed/ux.md](Seed/ux.md) (screen inventory, modal registry, required states, §10 non-omission checklist) and [Seed/design.md](Seed/design.md) (§13 anti-patterns). **Mandatory during the design overhaul phase.** |
| **`storyplots-design` skill** | Every design-overhaul cycle (Cycle 0066+). Invoke via the Skill tool before writing code on a visual surface; it primes the tokens/components/copy rules and points at the relevant preview/kit file. |
| **`code-review`** | Mandatory pass before closing out a cycle. Its findings feed into the plan's verification step, not a new undocumented fix. |
| **`code-simplifier`** | Run after implementation to strip speculative abstractions, unused scaffolding, and premature generalizations — aligned with the non-invention guardrail. Does **not** override seed-required surfaces. |
| **`context7`** | Use when deciding or using external library APIs (Supabase, SSE libs, auth SDKs, model SDKs). Consult `context7` instead of guessing API shapes — matches the "non-invention" principle for third-party surfaces. |
| **`tavily` (MCP)** | **Default tool for any web search.** Whenever a task requires looking something up on the open web — current docs not covered by `context7`, recent releases, news, blog posts, error messages, library changelogs, model release info, third-party service status, comparison of options, "how do other people do X", verifying facts about external services — use the Tavily MCP tools (`mcp__tavily__*`) instead of the built-in `WebSearch`/`WebFetch`. Tavily returns ranked, summarized results with content extraction, which is more accurate and cheaper on context than fetching raw pages. Fall back to `WebFetch` only when you already have a specific URL and need its raw content, or when Tavily is genuinely unavailable. Library API/CLI/SDK docs still go to `context7` first (per its row above); Tavily is for everything else web-shaped. |
| **`playwright`** | End-to-end verification of UI. **Required** once a frontend surface is navigable: drive the browser through the 7 non-negotiable flows ([Seed/user-stories.md](Seed/user-stories.md) §6) and the required states ([Seed/ux.md](Seed/ux.md)) before declaring a plan complete. |
| **`serena`** | Semantic code navigation (symbol-level reads, references, targeted edits). **Preferred over reading whole files** once the codebase grows — use `find_symbol`, `get_symbols_overview`, and `find_referencing_symbols` to locate and edit by symbol rather than line range. Aligned with the non-invention principle: read only what the task requires. Do not use its memory features (`write_memory`, etc.) as a substitute for in-repo plans — plans live in the repo, not in Serena's memory store. |

Rules of use:

- **Plugins do not replace the plan.** A plan is still written first; plugins execute steps within it.
- **Playwright is a gating step, not optional polish.** A UI change without a Playwright verification run is incomplete. Record which flows/states were exercised in the plan's verification notes.
- **`code-review` and `code-simplifier` run on every cycle.** Findings that reveal seed misreads are fixed; findings that reveal seed ambiguities go to [Seed/open-questions.md](Seed/open-questions.md) via escalation, not silent resolution.
- **Plugin evidence is tool output, not truth.** Seed files still determine truth on conflict.
- **If a plugin is unavailable mid-task, stop and surface it** — do not silently substitute a weaker check.
- **Web search defaults to Tavily.** `WebSearch` is not the default — `mcp__tavily__*` is. If Tavily isn't loaded in the session (e.g. `TAVILY_API_KEY` wasn't exported before launching Claude Code), surface it instead of silently falling back; the user will reload. Library docs still default to `context7`.

## Non-negotiables (from [Seed/creator-vision.md](Seed/creator-vision.md) §8)

These bind every design and implementation choice:

- **Agent isolation** — per-Conversation Agent, no cross-Conversation state leakage.
- **Grammar Module default OFF** — never auto-enabled; opt-in per Conversation.
- **Per-Conversation Lorebook** — Lorebook entries are scoped to the Conversation, not global.
- **Edit-as-trim** — editing a message trims the Conversation to that point; it does not fork-in-place or mutate history silently.
- **Branching copies** — branching produces an independent Conversation copy; no shared mutable state.
- **Snapshot semantics** — snapshots are immutable point-in-time captures.
- **SSE for Agent replies**, **Supabase as source of truth**, **BYOK for model access**, **vendor-agnostic prompts**, **Conversation↔Agent reply path as plain text**.

If a plan or a piece of code would violate any of these, stop and surface the conflict.

## Core principles (preserved from the seed philosophy)

1. **Omission is dangerous; ambiguity is a defect.** Applies to plans and code equally.
2. **Non-invention.** Do not fabricate behavior, entities, fields, screens, or flows that neither the seed nor PersonaLLM-Reference states. Replicating behavior that PersonaLLM-Reference documents (the observed app being cloned) is **not** invention — it is the base the seed sits on top of. Invention is only when neither source covers it.
3. **Non-omission.** Required screens, states, entities, flows, and principles are not droppable.
4. **Evidence-first.** Every design decision in a plan traces to a specific seed section, and — when the decision replicates observed behavior — to the specific PersonaLLM-Reference section too.
5. **Observed vs. Extended separation.** Never silently merge PersonaLLM-observed behavior with v0 extensions — keep the provenance visible (cite seed vs. reference distinctly in plans and, where relevant, in code comments).
6. **Stable naming.** Use canonical names from [Seed/PersonaLLM-Reference/00-index.md](Seed/PersonaLLM-Reference/00-index.md) plus declared v0 additions; do not rename.
7. **Seed files determine truth on conflict; PersonaLLM-Reference is the secondary source when the seed is silent; References/ informs interpretation only.**

## Seed modification rules

The seed is **frozen** for this implementation run, with one explicit exception: [Seed/open-questions.md](Seed/open-questions.md) is **append-only** during implementation — new ambiguities discovered while planning may be added there (and only there) without breaking the freeze. Resolutions to those questions still require creator approval and the full modification ritual below.

If modification of any other seed file is genuinely required:

1. The creator must explicitly approve the change.
2. The change is made in the correct precedence-order file.
3. A version marker is bumped at the top of [Seed/README.md](Seed/README.md).
4. Any prior plans or in-progress work predicated on the old wording are re-checked against the new wording.

[Seed/PersonaLLM-Reference/](Seed/PersonaLLM-Reference/) is **never** modified during implementation — it documents observed behavior of the app being cloned and is a historical artifact, not a spec under negotiation.

If a system or an implementation difficulty seems to "demand" a seed change, assume by default that the implementation is wrong, not the seed. Escalate before editing the seed.

## Guardrails

- **Do not modify the seed to make implementation easier.** The seed is the spec.
- **Do not invent answers to open questions.** Surface them in the plan.
- **Do not skip the plan for non-trivial work.** The plan is the audit trail that prevents drift.
- **Do not read or write sibling comparison folders.** This folder is isolated by design.
- **Do not silently drop seed-required surfaces, states, or flows.** If one is genuinely out-of-scope for the current change, say so in the plan.
- **Do not introduce backwards-compatibility shims, speculative abstractions, or features the seed does not require.**

## Working-directory map

- [DesignSystem/](DesignSystem/) — visual source of truth for the UI overhaul phase (authoritative implementation of `Seed/design.md`). Read-only during implementation. See "Design system" section above.
- [Seed/](Seed/) — frozen spec. Read-only during implementation, except [Seed/open-questions.md](Seed/open-questions.md) which is append-only.
- [Seed/PersonaLLM-Reference/](Seed/PersonaLLM-Reference/) — **observed-app evidence** (the base StoryPlots v0 is cloning, derived from screenshot analysis of the source app — this artifact predates the seed chronologically and was its input). Read-only. **Secondary source of truth** at precedence #11: consulted whenever the seed is silent or thin on a detail the homologous reference map covers.
- [References/](References/) — raw background (screenshots, ADRs). Interpretive only; precedence #12.
- [greenfield_seed_instructions.md](greenfield_seed_instructions.md) — original seed-shape doc from project setup. Context, not implementation guidance.
- `plans/` — one file per change at `plans/NNNN-slug.md`. Created on demand.
- [dev-runbook.md](dev-runbook.md) — comandos para arrancar/parar backend, frontend, ComfyUI, tests. Consultar antes de asumir que un servicio está corriendo.
- _(to be created by implementation)_ — application code, migrations, configs, and tests.

## Collaboration style

- Ask targeted questions on ambiguity; do not guess.
- Keep plans small and reviewable; prefer one plan per coherent change.
- Make assumptions visible in the plan (e.g., "interpreting story 14 literally as X").
- One cycle at a time — finish the current plan's implementation and verification before opening the next.

## What NOT to do

- Do not modify the seed without explicit creator approval.
- Do not implement without a plan that cites seed sections.
- Do not silently resolve open questions in code.
- Do not ship anti-patterns called out in [Seed/design.md](Seed/design.md) §13.
- Do not add features, screens, entities, or flows the seed does not require.
- Do not reference or consume outputs from other downstream systems.
