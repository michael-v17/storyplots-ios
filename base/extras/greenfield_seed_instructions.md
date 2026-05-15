You are helping create a **high-authority Greenfield seed** for a new project.

Your goal is to generate or refine a `Seed/` folder that acts as the **bootstrap source of truth** for the project, so that later systems such as Claude Code, Spec Kit, ECC, or other AI-assisted workflows can build from a much clearer foundation with less ambiguity, less hallucination, and less omission.

This seed must guide a Greenfield project from idea to a strong initial implementation baseline.

The seed is not a sprint backlog.
The seed is not a task tracker.
The seed is not a giant random documentation dump.
The seed is a **foundational project harness**.

Its job is to make the project difficult to misinterpret across:
- creator intent
- product scope
- user outcomes
- domain structure
- architecture
- schema boundaries
- UX coverage
- design direction
- unresolved decisions

---

# Workflow assumption

This workflow assumes that the **user already provides** these two files first:

- `Seed/creator-vision.md`
- `Seed/user-stories.md`

These are the strongest inputs for the rest of the seed.

The system should use those two files as the main anchor to generate or refine the remaining seed files.

So the intended Greenfield flow is:

1. User creates or reviews `creator-vision.md`
2. User creates or reviews an initial `user-stories.md`
3. System generates the remaining seed files from those inputs
4. User reviews the generated files
5. Unclear or conflicting areas are recorded in `Seed/open-questions.md`
6. The seed becomes the bootstrap foundation for implementation

This means `creator-vision.md` and `user-stories.md` should be treated as especially important.

---

# Core philosophy

This seed follows a strict rule:

**If the project does not explicitly define important behavior, structure, or boundaries, AI systems will invent them incorrectly.**

Therefore:
- omission is dangerous
- ambiguity is a defect
- foundational explicitness is better than fake simplicity
- structured clarity is preferred over shallow brevity

The seed should be:
- explicit
- modular
- structured
- high-signal
- hard to misinterpret
- rich enough to reduce hallucination
- limited to foundational truth, not full lifecycle planning

---

# Seed folder structure

The seed uses this structure:

Seed/
├── README.md
├── creator-vision.md
├── product.md
├── user-stories.md
├── domain.md
├── architecture.md
├── schema.md
├── ux.md
├── design.md
└── open-questions.md

Optional supporting material may exist in a separate folder:

Seed/PersonaLLM-Reference/
├── raw-notes.md
├── screenshots/
├── prototype-audit.md
├── legacy-analysis.md
├── competitor-notes.md
├── figma-notes.md
├── diagrams/
└── other-supporting-material/

The `Seed/PersonaLLM-Reference/` folder is optional.
It is not required for every project.

---

# What the system should generate

Assume that these files are already provided or already exist:

- `Seed/creator-vision.md`
- `Seed/user-stories.md`

Your main job is to generate or refine the rest:

- `Seed/README.md`
- `Seed/product.md`
- `Seed/domain.md`
- `Seed/architecture.md`
- `Seed/schema.md`
- `Seed/ux.md`
- `Seed/design.md`
- `Seed/open-questions.md`

You may also:
- suggest improvements to `creator-vision.md`
- suggest improvements to `user-stories.md`
- use optional `Seed/PersonaLLM-Reference/` material when available

But treat `creator-vision.md` and `user-stories.md` as high-authority creator-provided inputs unless the creator explicitly asks for major rewriting.

---

# Document precedence

Use this exact precedence order for **authoritative seed files**:

1. `creator-vision.md`
2. `README.md`
3. `product.md`
4. `user-stories.md`
5. `domain.md`
6. `architecture.md`
7. `schema.md`
8. `ux.md`
9. `design.md`
10. `open-questions.md`

Interpretation rules:
- `creator-vision.md` = highest-authority creator intent
- `product.md` = product boundaries and intended shape
- `user-stories.md` = user-centered behavior and priority outcomes
- `domain.md` = conceptual hierarchy and object relationships
- `architecture.md` = technical structure and constraints
- `schema.md` = data shape, scoping, and isolation rules
- `ux.md` = screens, sections, interactions, states, and flows
- `design.md` = visual direction and anti-drift rules
- `open-questions.md` = unresolved ambiguity register

If any lower-priority file conflicts with a higher-priority one, the higher-priority one wins.

If conflict remains unresolved, record it in `open-questions.md`.

Do not silently average conflicting documents into a vague compromise.

---

# Optional reference inputs

In addition to the core seed inputs, the creator may provide optional supporting reference materials.

These may include:
- raw notes
- screenshots
- app audits
- old prototypes
- Figma explorations
- diagrams
- competitor analysis
- migration notes
- legacy product documentation
- schema sketches
- flow notes
- conversation transcripts
- copied UI references
- screen inventories from previous attempts
- screenshots of apps the creator wants to replicate structurally or partially

These references may be useful when they help clarify:
- creator intent
- missing product details
- user flows
- domain boundaries
- UX structure
- architectural constraints
- migration context
- visual structure
- screen composition
- interaction clues

However, these references are **supporting inputs**, not primary source of truth.

They must not silently override:
- `creator-vision.md`
- `product.md`
- `user-stories.md`
- or any higher-priority seed file

If a reference appears to conflict with higher-priority seed files:
- do not silently merge the conflict
- identify it explicitly
- follow seed precedence
- record the issue in `open-questions.md` if needed

If a reference reveals a likely omission in the seed:
- surface it clearly
- suggest where it belongs in the seed
- do not treat it as canonical unless the creator confirms it

Important principle:
**References inform interpretation; seed files determine truth.**

---

# Special importance of the first two files

## `creator-vision.md`
This is the most important file in the seed.

It contains:
- what the creator really means
- the conceptual identity of the product
- non-negotiable principles
- product truths that should not be lost even if the rest of the seed is still rough

This file must be treated as the highest-authority statement of intent.

## `user-stories.md`
This is the second key anchor for generation quality.

It contains:
- the most important user outcomes
- the flows that matter most
- the practical meaning of the product from the user’s point of view
- the highest-value acceptance framing

This file should strongly influence:
- `product.md`
- `ux.md`
- `domain.md`
- `architecture.md`

It should help prevent a common failure mode where the system understands pages and architecture but does not understand what users are actually trying to accomplish.

---

# Quality standard

The seed should be considered excellent only if it:
- preserves creator intent
- defines product scope clearly
- explains what users need to do
- defines the domain model clearly
- establishes a sane technical foundation
- prevents incomplete frontend output
- reduces structural hallucination
- reduces omitted screens, states, and flows
- is still maintainable as a foundational artifact

A weak seed is:
- vague
- generic
- shallow
- contradictory
- overly aesthetic but behaviorally weak
- technically plausible but product-wrong
- full of mood but missing real UX coverage
- missing scoping rules or isolation rules
- missing user-centered behavioral priorities

---

# Required content by file

## 1. `Seed/README.md`
Purpose: index, ownership map, precedence, and usage guide.

It must contain:
- what the seed is
- why it exists
- when it should be used
- what each seed file owns
- precedence rules
- what is not source of truth
- how to handle ambiguity
- how the seed should evolve without turning into a dump

It must explicitly state that the highest-authority files for project intent are:
1. `creator-vision.md`
2. `product.md`
3. `user-stories.md`

And it should explain that:
- `creator-vision.md` defines what the creator means
- `product.md` defines what product is being built
- `user-stories.md` defines what users must actually be able to do

All lower-level seed files must align with them.

It should also explain the role of `Seed/PersonaLLM-Reference/`:
- optional
- supporting
- useful for interpretation
- not authoritative unless explicitly confirmed by the creator

## 2. `Seed/creator-vision.md`
Purpose: highest-priority creator intent.

Assume this file is user-provided and already exists.

If you detect weaknesses, gaps, or contradictions, you may:
- suggest improvements
- identify ambiguities
- ask clarifying questions when needed

But do not silently reinterpret, weaken, or replace it.

## 3. `Seed/product.md`
Purpose: product definition.

It must contain:
- product vision
- problem statement
- target users
- key user outcomes
- MVP scope
- out-of-scope boundaries
- product principles
- success criteria
- major constraints
- high-level priorities

It should define what kind of product is being built, for whom, and what the first meaningful version must accomplish.

It should be generated primarily from:
- `creator-vision.md`
- `user-stories.md`

And secondarily from any useful reference material.

## 4. `Seed/user-stories.md`
Purpose: user-centered glue between vision, product, and implementation.

Assume this file is user-provided or user-reviewed and already exists.

It should contain:
- purpose of the user story document
- story-writing rules
- prioritization rules
- grouped core user stories
- acceptance criteria
- related screens
- related domain entities
- important non-negotiable flows
- story gaps or unclear user needs

Every user story should include:
- Title
- Priority
- As a / I want / So that
- Why it matters
- Acceptance criteria
- Related screens
- Related domain entities
- Constraints / notes

Priority should be explicit:
- Critical
- High
- Medium
- Low

This file should emphasize the highest-value user outcomes.

If the file appears weak, generic, incomplete, or inconsistent with `creator-vision.md`, surface that clearly.

## 5. `Seed/domain.md`
Purpose: conceptual domain model.

It must contain:
- domain hierarchy
- major objects/entities
- relationships between them
- lifecycle of important objects
- ownership boundaries
- public vs private distinctions
- invariants
- terminology definitions

Use this especially when the product has a non-trivial custom model that AI may flatten incorrectly.

Generate this file primarily from:
- `creator-vision.md`
- `user-stories.md`
- `product.md`

And secondarily from references if they help clarify the domain model.

## 6. `Seed/architecture.md`
Purpose: technical foundation.

It must contain:
- stack and frameworks
- system overview
- frontend/backend responsibilities
- key subsystems
- integration boundaries
- durable technical decisions
- infrastructure assumptions
- technical constraints
- undecided technical areas

It may include high-level architecture flows if they are foundational.
Do not turn this into a full implementation plan.

Generate this file from:
- creator intent
- user stories
- product shape
- domain structure
- relevant references when useful

## 7. `Seed/schema.md`
Purpose: structural data truth.

It must contain:
- high-level data model
- important entities and fields
- relationships
- uniqueness constraints
- scoping rules
- isolation rules
- important storage boundaries
- records that must not bleed into one another
- stateful object shape where relevant

Use structured artifacts when useful:
- table sketches
- JSON-like structures
- type-like structures
- ERD-style summaries
- state objects

Generate this file especially carefully when:
- memory must be scoped correctly
- relationships must be isolated correctly
- entity boundaries are easy to get wrong
- the same object can exist in multiple contexts with different state

References may help here, especially:
- old schema notes
- data sketches
- reverse-engineering notes
- migration notes

But they are still secondary to the seed.

## 8. `Seed/ux.md`
Purpose: UX and interaction contract.

It must contain:
- sitemap / route map
- navigation model
- screen inventory
- screen-by-screen contracts
- modal and overlay registry
- required states
- critical flows
- error/recovery expectations
- non-omission rules

For each screen, define:
- Route
- Purpose
- Entry points
- Must-have sections
- Optional sections
- Primary actions
- Secondary actions
- Interactions
- Opens
- Required states
- Critical edge cases
- Must not omit
- Notes / assumptions

This file should be strongly shaped by:
- high-priority user stories
- creator vision
- product boundaries

References may help here, especially:
- screenshots
- flow diagrams
- Figma notes
- app audits
- screen-by-screen analyses
- reverse-engineered UI breakdowns

But references must not silently override the seed.

## 9. `Seed/design.md`
Purpose: visual baseline.

It must contain:
- visual north star
- design principles
- aesthetic constraints
- base palette
- typography baseline
- spacing / radius / density
- component feel
- anti-patterns
- optional references
- fixed vs flexible design rules

This should guide visual interpretation but should not become an oversized design system unless that is foundational.

Its job is to reduce visual drift and prevent the product from collapsing into generic defaults.

References may help here, especially:
- screenshots
- Figma explorations
- visual audits
- style notes
- comparative UI references

But they remain supportive, not authoritative.

## 10. `Seed/open-questions.md`
Purpose: ambiguity register.

It must contain:
- open product questions
- open user story questions
- open domain questions
- open technical questions
- open UX questions
- pending decisions
- temporary assumptions
- contradictions to resolve
- discoveries that must flow back into the seed

This file exists so ambiguity is captured explicitly instead of silently invented away.

It should be updated whenever important uncertainty is discovered during generation.

It should also capture:
- reference conflicts
- unclear reference interpretations
- likely omissions revealed by supporting material

---

# Rules for structured artifacts

The seed may include structured artifacts if they help reduce hallucination.

Good examples:
- schema sketches
- domain hierarchies
- route maps
- screen inventories
- modal registries
- state models
- lifecycle diagrams
- settings matrices
- public/private boundary tables
- isolation rules
- event flow summaries

Do not reject structure merely because it is detailed.

However, do not include:
- sprint tickets
- exhaustive file-by-file implementation plans
- speculative long-term roadmap details that are not foundational
- giant repetitive explanations with no added clarity

Rule:
Include it if it reduces foundational ambiguity.

---

# Working rules

## 1. Creator-vision rule
`creator-vision.md` has the highest priority.
If it conflicts with another seed file, it wins.

## 2. User-story authority rule
`user-stories.md` has high authority.
It should strongly influence how the system interprets:
- user value
- primary flows
- priority behavior
- what must feel complete
- what must not be simplified away

It does not override `creator-vision.md` or `product.md`, but it should have higher interpretive weight than lower-level structural files when deciding what matters most in practice.

## 3. Input-first generation rule
Assume that `creator-vision.md` and `user-stories.md` are the primary inputs.
The remaining seed files should be generated from them, not independently guessed from generic product assumptions.

## 4. Reference-awareness rule
If optional `Seed/PersonaLLM-Reference/` materials exist, use them as supporting interpretive inputs.

Use them to:
- understand the creator’s intent more deeply
- identify likely omissions
- recover structural hints
- improve UX accuracy
- improve visual and architectural alignment

But do not treat them as authoritative unless the creator explicitly says so.

## 5. Non-invention rule
If something important is not clearly defined:
- do not silently invent it as final truth
- identify the gap
- record it in `open-questions.md`
- if useful, propose options explicitly

## 6. Non-omission rule
Do not omit:
- required screens
- required sections
- required user flows
- required states
- required entities
- required schema boundaries
- required creator principles
- required high-priority user outcomes

## 7. Foundation-first rule
The seed is for foundational truth.
It should define the initial project shape, not become an operational backlog system.

## 8. Explicit-priority rule
The seed must make clear what is:
- critical
- high-priority
- secondary
- unresolved

This is especially important for user stories, flows, and constraints.

## 9. Hybrid-format rule
Use prose where interpretation matters.
Use structured formats where precision matters.
Hybrid seed documents are encouraged.

## 10. Alignment rule
All seed files must align with each other.
Lower-level files must not quietly drift away from higher-priority intent.

If a lower-level file seems technically correct but contradicts creator intent, product scope, or high-priority user stories, it must be corrected.

## 11. Creator clarification rule
If, while generating or refining the seed, you detect a high-impact ambiguity, contradiction, or missing foundational decision, do not silently invent the answer.

Instead:
- identify the issue clearly
- explain why it matters
- ask the creator for clarification

This should only happen when the ambiguity materially affects:
- product identity
- product scope
- core user outcomes
- domain hierarchy
- architecture boundaries
- schema scoping or isolation
- required screens, sections, or flows
- critical state behavior
- permissions, privacy, or safety rules
- creator non-negotiable principles

Do not ask unnecessary questions for low-impact or cosmetic gaps.

Use this decision model:
- low-impact gap → reasonable assumption allowed
- medium-impact gap → assumption allowed, but record it in `open-questions.md`
- high-impact gap → ask the creator before treating it as resolved

The creator is the final authority on intent.

## 12. Contradiction escalation rule
If `creator-vision.md` conflicts with other seed files, do not try to reconcile the conflict silently.

Treat `creator-vision.md` as authoritative.
If the conflict changes the meaning of the system in an important way, surface it explicitly to the creator.

## 13. Reference conflict rule
If a reference suggests something that conflicts with the authoritative seed:
- do not silently merge it
- do not treat the reference as canonical
- identify the tension explicitly
- preserve seed precedence
- record the issue in `open-questions.md` if it matters

## 14. Review-aware rule
Assume the user will review the generated files.
Therefore:
- optimize for readability and inspectability
- make important assumptions visible
- avoid hiding critical interpretation inside vague prose
- make it easy for the creator to verify whether the seed is aligned with their intent

---

# Output expectations

When generating or refining the seed, produce documents that:
- are internally consistent
- align with creator intent
- reinforce product boundaries
- clearly show the user-centered behavior of the product
- reduce ambiguity in domain structure
- reduce ambiguity in schema and state handling
- reduce ambiguity in UX coverage
- reduce visual drift
- preserve unresolved issues explicitly

The seed should help a Greenfield project begin with:
- stronger direction
- better alignment
- fewer hallucinations
- fewer omissions
- more complete implementation outcomes

---

# Final instruction

Generate or refine the seed as a **high-authority Greenfield foundation**.

Assume the creator provides:
- `creator-vision.md`
- `user-stories.md`

Optionally, the creator may also provide:
- screenshots
- raw notes
- old analyses
- diagrams
- Figma explorations
- audits
- other supporting reference material

Use the first two as the primary source for generating the remaining seed files.
Use the optional references only as supporting material.

Do not optimize for minimalism.
Do not optimize for speed over clarity.
Do not flatten complex creator intent into generic product templates.

Optimize for:
- clarity
- fidelity
- interpretability
- strong initial project shape
- reduced hallucination risk
- reduced omission risk
- stronger alignment between idea and implementation