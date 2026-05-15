# Seed — StoryPlots v0 (SingleNPCInteractionVersion)

> **Seed version:** v0.2 (modified 2026-05-07, cycle 0106). Changes from v0.1: §"Session model" guest mode and `User.byok_keys` anonymous-User clauses deprecated — v0.2 is registered-only. The link-flow code path is dormant pending future free-tier demo mode. See [creator-vision.md](creator-vision.md) §"User fields" and §"Session model" for the canonical update.
>
> **Scope label:** `SingleNPCInteractionVersion`. This seed is the foundational harness for **StoryPlots v0** — a web chat app where the user holds 1:1 conversations with AI Characters, with an opt-in Grammar Module layered on top.
>
> **Authority:** this folder is the high-authority Greenfield seed. Downstream AI-assisted build systems (vanilla Claude Code, spec-kit, ECC, and any other) consume it unchanged and are expected to produce code from it without silently inventing missing foundational truth.

---

## 1. What this seed is

A **foundational project harness** for a Greenfield build of StoryPlots v0. Its job is to make the project hard to misinterpret across:

- creator intent
- product scope and positioning
- user-centered outcomes
- domain structure
- technical architecture
- schema and isolation rules
- UX surface coverage
- visual direction
- unresolved decisions

Seed philosophy, reused verbatim from [creator-vision.md](creator-vision.md) §Seed philosophy:

> If behavior is not explicitly defined in the seed, downstream AI will invent it incorrectly. Better slightly verbose than ambiguous. Omission is not simplification — it is an invitation for hallucinated behavior.

## 2. What this seed is NOT

- **Not code.** No TypeScript types, no SQL DDL, no runtime snippets. Those are downstream outputs.
- **Not a sprint backlog.** No tickets, no estimates, no deadlines.
- **Not a full lifecycle plan.** It defines the initial project shape; it does not plan operations.
- **Not a spec-kit or ECC deliverable.** The seed is downstream-agnostic; it must read the same to every generator.
- **Not a design system.** [design.md](design.md) prevents drift; it does not aim to be exhaustive.
- **Not a dump.** Reference material lives in [PersonaLLM-Reference/](PersonaLLM-Reference/) and [../References/](../References/). The seed files themselves stay tight.

---

## 3. Top authorities

The three files that define **project intent** and bind everything else:

1. **[creator-vision.md](creator-vision.md)** — what the creator means. Highest-authority statement of intent. Non-negotiable principles, v0 identity, anti-goals, tech-stack direction, open questions.
2. **[product.md](product.md)** — what product is being built. Vision, problem, users, outcomes, MVP cutline, out-of-scope, principles, success criteria, constraints, priorities.
3. **[user-stories.md](user-stories.md)** — what users must actually be able to do. 52 stories across 11 sections, 7 non-negotiable flows, explicit MVP cutline, architectural invariants repeated as bold acceptance criteria.

All lower-priority seed files align with these three. Any conflict is resolved in favor of the higher file and, if material, recorded in [open-questions.md](open-questions.md).

---

## 4. Document precedence

The precedence order below mirrors [../greenfield_seed_instructions.md](../greenfield_seed_instructions.md) exactly.

| # | File | Owns |
|---|---|---|
| 1 | [creator-vision.md](creator-vision.md) | Creator intent, v0 identity, anti-goals, non-negotiables, tech direction |
| 2 | [README.md](README.md) | This file — index, precedence, ownership, usage |
| 3 | [product.md](product.md) | Product definition: vision, users, outcomes, MVP, scope boundaries, principles |
| 4 | [user-stories.md](user-stories.md) | User-centered behaviors, prioritized, with acceptance criteria and invariants |
| 5 | [domain.md](domain.md) | Conceptual hierarchy, entities, relationships, lifecycles, invariants, terminology |
| 6 | [architecture.md](architecture.md) | Stack, subsystems, agents, streaming, auth, BYOK, SFW, design disciplines |
| 7 | [schema.md](schema.md) | Data shape, scoping rules, isolation invariants, cascade rules, branching semantics |
| 8 | [ux.md](ux.md) | Sitemap, screen contracts, modal registry, states, flows, non-omission rules |
| 9 | [design.md](design.md) | Visual north star, typography, palette, component feel, anti-patterns |
| 10 | [open-questions.md](open-questions.md) | Unresolved ambiguity register |

**Conflict rules:**

- A lower-priority file never silently overrides a higher-priority one.
- If a conflict cannot be reconciled, record it in [open-questions.md](open-questions.md) and preserve the higher-priority reading.
- Do not average conflicting documents into a vague compromise.

---

## 5. Reference material (supporting, not authoritative)

### [PersonaLLM-Reference/](PersonaLLM-Reference/)
Evidence-first reference of the observed PersonaLLM iOS app. Treated as **authoritative for PersonaLLM behavior that v0 is preserving**; **interpretive only** everywhere else. Never overrides the seed files above.

| File | Purpose in the seed |
|---|---|
| [00-index.md](PersonaLLM-Reference/00-index.md) | Canonical name glossary — reused for v0 entity names |
| [01-overview.md](PersonaLLM-Reference/01-overview.md) | What PersonaLLM is; v0 scope cuts vs keeps |
| [02-information-architecture.md](PersonaLLM-Reference/02-information-architecture.md) | PersonaLLM route map; v0 trims Community and Credits |
| [03-data-model.md](PersonaLLM-Reference/03-data-model.md) | Entity field sets inferred from screenshots |
| [04-screens/*](PersonaLLM-Reference/04-screens/) | Per-screen UI contracts preserved where v0 inherits them |
| [05-flows.md](PersonaLLM-Reference/05-flows.md) | Observed end-to-end journeys |
| [06-chat-interaction-model.md](PersonaLLM-Reference/06-chat-interaction-model.md) | Chat anatomy, actions, state transitions, typography convention |
| [07-prompts-and-llm-touchpoints.md](PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md) | 11-position prompt assembly + 12th Author's Notes injection |
| [08-generation-parameters.md](PersonaLLM-Reference/08-generation-parameters.md) | Sampling / generation controls |
| [09-design-system.md](PersonaLLM-Reference/09-design-system.md) | Visual language, component inventory |
| [10-non-functional.md](PersonaLLM-Reference/10-non-functional.md) | Tone, copy patterns, privacy posture, a11y notes |
| [11-web-adaptation-notes.md](PersonaLLM-Reference/11-web-adaptation-notes.md) | iOS → web adaptation patterns, breakpoints, routes |
| [99-open-questions.md](PersonaLLM-Reference/99-open-questions.md) | Ambiguities from the reference pass; some resolved by v0 divergence |

### [../References/](../References/)
- **[../References/GeneralDocuments/stack-decisions.md](../References/GeneralDocuments/stack-decisions.md)** — authoritative ADR for stack choices (React + Vite, Python + FastAPI + LangGraph, Supabase, SSE, BYOK). [architecture.md](architecture.md) and [creator-vision.md](creator-vision.md) §11 consolidate it; the ADR has the full rationale.
- **[../References/PersonaLLM/](../References/PersonaLLM/)** — raw screenshots and extra documents from the reference app.
- **[../References/GeneralDocuments/portrait_anime.json](../References/GeneralDocuments/portrait_anime.json)** — sample ComfyUI workflow payload, illustrative only.

### [../creator-vision-for-multiinteractions.md](../creator-vision-for-multiinteractions.md)
Successor vision covering multi-NPC / Story / Scenario / Quest / Master Agent. **Out of scope for v0.** Referenced only when v0 inherits a narrow detail from it (e.g., Grammar Module behavior sourced from §5.1, §5.3, §5.5, §5.6).

### [../user_stories_instructions.md](../user_stories_instructions.md)
Methodology file used to generate [user-stories.md](user-stories.md). Useful for evaluating story shape; not authoritative for content.

---

## 6. How to use this seed

**When starting a Greenfield build:**

1. Read [creator-vision.md](creator-vision.md) fully.
2. Read [product.md](product.md) and [user-stories.md](user-stories.md) fully.
3. Skim the other seed files in precedence order before generating anything.
4. Consult [PersonaLLM-Reference/](PersonaLLM-Reference/) when a seed file points to it for preserved behavior.
5. Treat [open-questions.md](open-questions.md) as mandatory: never silently invent an answer to an item listed there.

**When the seed disagrees with itself:** higher-priority file wins (§4). Log the tension in [open-questions.md](open-questions.md) if it is material.

**When the reference disagrees with the seed:** the seed wins. Log the tension in [open-questions.md](open-questions.md) if it matters.

**When you encounter an ambiguity the seed does not resolve:** use the decision model in §7.

---

## 7. Ambiguity decision model

Copied from [../CLAUDE.md](../CLAUDE.md) for this seed's consumers:

- **Low-impact gap** → reasonable default allowed, no ceremony.
- **Medium-impact gap** → default allowed, but record it in [open-questions.md](open-questions.md).
- **High-impact gap** → stop and ask the creator before treating it as resolved.

"High-impact" means the ambiguity materially affects:

- product identity or scope
- core user outcomes
- domain hierarchy or ownership
- architecture boundaries (especially agent isolation)
- schema scoping or isolation rules
- required screens, sections, or flows
- critical state behavior (edit-as-trim, branching-copies, reinforcement cap)
- permissions, privacy, or safety rules (SFW, 18+, RLS)
- creator non-negotiable principles ([creator-vision.md](creator-vision.md) §8)

---

## 8. Observed vs v0 Extension discipline

This seed keeps **"Observed in PersonaLLM"** and **"v0 Extension"** separated wherever both appear in the same file. Never silently merge them. If a v0 decision diverges from PersonaLLM, it is labeled `v0 Extension` or `Changed in v0` with a one-line reason.

Examples already committed in the seed:

- **Lorebook scoping** — PersonaLLM: per-Character. v0: **per-Conversation** (diverged, recorded in [creator-vision.md](creator-vision.md) §3 + §9).
- **Character editor** — loses the Lorebook section; gains the **English Style** dropdown (v0 Extension).
- **Authentication** — PersonaLLM: Verify-with-Apple. v0: **Supabase Auth** (email/pw, Google, GitHub, anonymous).
- **Monetization** — PersonaLLM: Credits. v0: **none** (BYOK-only; Credits entity dropped).

---

## 9. Canonical naming

Canonical entity and screen names come from [PersonaLLM-Reference/00-index.md](PersonaLLM-Reference/00-index.md) and are re-used verbatim everywhere in this seed.

**v0 additions to the glossary:**

- `GrammarCorrection` — one row per user Message that produced a correction.
- `GrammarAggregate` — per-user pre-computed rollups for Home widget and Grammar Dashboard.
- `Character.english_style` — enum: `formal_american` / `neutral_american` (default) / `casual_american`.
- `User.byok_keys` — encrypted blob holding the user's BYOK API keys.
- `User.sfw_disabled` — boolean; flipping to true requires authenticated User + 18+ confirmation.

**v0 removals from the glossary:**

- `Credits`, `CreditsAccount`, `CreditsTransaction` — v0 has no monetization.
- `CommunityCharacter`, `Creator`, `Follow`, `Favorite`, `Like`, `Download`, `Flag`, `Leaderboard` — v0 has no Community surface.

---

## 10. How this seed should evolve

- **Update in place.** Prefer editing the existing seed file over creating new ones. Filenames must stay exactly as listed in §4.
- **Keep diffs small and reviewable.** One file or one section at a time.
- **Update [open-questions.md](open-questions.md) whenever a new unresolved item surfaces.** Do not paper over it in a lower file.
- **Propagate high-priority changes downward.** A change to [creator-vision.md](creator-vision.md) or [product.md](product.md) frequently invalidates material in lower files; review the precedence ladder and sweep for drift.
- **Do not grow the seed into a dump.** If a new file is genuinely needed, first check whether it belongs in [PersonaLLM-Reference/](PersonaLLM-Reference/), [../References/](../References/), or [open-questions.md](open-questions.md).
- **Preserve the Observed / v0-Extension separation** whenever edits touch behavior that has a PersonaLLM counterpart.

---

## 11. Downstream-agnostic stance

This seed is consumed by at least three downstream build systems (vanilla Claude Code, spec-kit, ECC). The seed must read the same to every one of them. Therefore:

- No spec-kit `.spec`-shaped YAML, no ECC-specific directives, no Claude-Code-only prompt tricks inside seed files.
- No assumption that the downstream system will perform a particular planning pass.
- Structural artifacts (route maps, domain hierarchies, screen inventories, schema sketches, state models, boundary tables) are encouraged; downstream-specific scaffolding is not.
