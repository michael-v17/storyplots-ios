# Generation Guide: seed/domain.md

## 1. When to include

**Conditional.** Include when at least one of these conditions is met:

- The project has non-obvious business invariants that are not evident from reading the schema alone (e.g. "editing a message destroys the subsequent history")
- Entities have complex lifecycles with non-trivial states and transitions
- There is domain terminology that two people might interpret differently without an explicit definition
- The project has ownership or isolation rules that cross multiple entities

**If the project is simple**: invariants go as a "Business Rules" section in `schema.md`, and the glossary goes there too. Do not generate `domain.md` for artificial simplicity.

---

## 2. Prerequisites

These must exist before opening this session:

- [ ] `seed/creator-vision.md`
- [ ] `seed/user-stories.md`
- [ ] `seed/references/[AppName]/03-data-model.md` *(or equivalent)*
- [ ] `seed/schema.md` ✓ approved — `domain.md` extends the schema conceptually; it must exist to avoid duplication

---

## 3. Session opening prompt

```
We are going to generate seed/domain.md. This is the conceptual domain model — it describes
the rules and vocabulary of the business. It is NOT a physical schema, NOT UI, NOT code.

Read the following files in this order before starting:
1. seed/references/[AppName]/03-data-model.md  — observed lifecycles and behavior
2. seed/creator-vision.md                       — §8 non-negotiable invariants
3. seed/user-stories.md                         — acceptance criteria that imply invariants
4. seed/schema.md                               — already-defined entities; domain.md describes them
                                                  conceptually without duplicating or contradicting them

Produce seed/domain.md with this structure:
- Entity catalog: per entity → purpose, key fields (conceptual), scope/isolation,
  lifecycle states, entity-specific invariants
- Ownership boundaries: which entity contains which other
- Lifecycle descriptions: states + transitions for entities with non-trivial lifecycles
- Consolidated invariants table: ALL invariants in the system, numbered 1..N
- Canonical glossary: canonical names with a 1-line definition

Rules:
- NEVER duplicate DDL fields from schema.md in domain.md
- Invariants from creator-vision §8 MUST appear in the consolidated table (do not invent more)
- If an observed lifecycle in the reference is modified by creator-vision → cite both sources
- Each invariant must be falsifiable: a statement that can be true or false in the system
- If there is ambiguity about a lifecycle → record it in open-questions.md, assume the
  most conservative behavior observed in the reference
```

---

## 4. Extraction map

### From `seed/references/[AppName]/03-data-model.md`
- Observed entity lifecycles (especially entities with states: conversations, messages, tasks, etc.)
- Observed ownership rules (what is "child" of what, and in what context)
- Behavior when deleting or editing entities (observed cascade)
- Domain-specific terminology from the reference app

### From `seed/creator-vision.md`
- §8 (non-negotiables) → each one is formalized as a numbered invariant
- Any mention of a lifecycle modified relative to the reference
- Isolation or scoping rules declared explicitly
- Vocabulary the creator uses to refer to entities (may differ from the reference)

### From `seed/user-stories.md`
- Acceptance criteria that imply invariants (e.g. "given that I edit a message, subsequent messages disappear" → edit-as-trim invariant)
- Constraints from each story → many are domain invariants
- Entity names used in flows → must match the glossary

### From `seed/schema.md`
- List of already-defined entities → domain.md describes them conceptually without duplicating fields
- Business Rules section (if invariants already exist in schema, reference them and do not duplicate)
- FK relationships → ownership boundaries in domain.md must be consistent

---

## 5. Required output structure

### 5.1 Entity catalog

One section per main domain entity. Each entry:

```markdown
### [EntityName]

**Purpose:** what it represents in the domain (2-3 lines)

**Key concepts:** the 3-5 most conceptually important attributes (NOT a list of DDL fields)

**Scope:** what this entity isolates (per-user, per-conversation, global, etc.)

**Lifecycle states:** list of possible states (can be trivial: "exists / deleted")
- State A: what it means
- State B: what it means
- Transitions: what causes the change from A to B

**Entity-specific invariants:**
- "Local invariant: [rule that can never be false for this specific entity]"
```

**Do not include** in the entity catalog: complete DDL fields (that is in schema.md), application logic, code.

### 5.2 Ownership boundaries

Table or section explaining the ownership hierarchy:

```markdown
## Ownership boundaries

User
  └── Character (owns N characters)
  └── Conversation (owns N conversations, each linked to 1 Character)
       └── Message (belongs to 1 Conversation)
       └── LoreEntry (scoped to 1 Conversation)

Deletion semantics:
- Deleting User → cascades to all Characters and Conversations (and their children)
- Deleting Conversation → cascades to Messages, LoreEntries
- Deleting Character → NOT cascaded to Conversations (Character is a template)
```

### 5.3 Lifecycle descriptions (only for entities with non-trivial lifecycles)

For entities with more than 2 states or with transitions that have rules:

```markdown
## Lifecycle: [EntityName]

States: [Draft] → [Active] → [Archived]

Transitions:
- Draft → Active: when [condition]
- Active → Archived: when [condition]; [consequences]
- Active → Draft: NOT POSSIBLE — [reason]

Invariants during lifecycle:
- "In Archived state, the [EntityName] cannot be modified. (creator-vision §X)"
```

### 5.4 Consolidated invariants table

**This is the most important section of the document.** Lists ALL invariants in the system, across all entities, in a single numbered table:

| # | Invariant | Source | Enforcement layer |
|---|---|---|---|
| 1 | A Message belongs to exactly one Conversation and cannot change. | creator-vision §8 | FK constraint + no update endpoint |
| 2 | Editing a Message deletes all subsequent Messages in that Conversation. | creator-vision §8 | Application layer (service) |
| 3 | ... | ... | ... |

- **#**: unique number, used for cross-referencing from other seed files
- **Invariant**: falsifiable statement in present indicative
- **Source**: `creator-vision §X`, `observed: reference §Y`, or `user-stories S##`
- **Enforcement layer**: where it is enforced (DB constraint, RLS policy, application service, AI prompt)

### 5.5 Canonical glossary

Table of canonical domain terms:

| Term | Definition | Used in |
|---|---|---|
| Conversation | A chat session between a User and a Character | schema, ux, architecture |
| ... | ... | ... |

Covers all domain nouns that could have multiple interpretations. If the reference uses a different name than the creator uses → document both (e.g. "Lorebook (a.k.a. 'World Info' in the reference)").

---

## 6. Quality gates before approval

- [ ] Each invariant from `creator-vision.md` §8 is in the consolidated table (verify one by one)
- [ ] Each entity has lifecycle states documented (even if trivial: "exists / deleted")
- [ ] Invariants are numbered, falsifiable, and have a cited source
- [ ] The glossary covers all technical terms used in user-stories and in schema
- [ ] There are no DDL fields in domain.md (search for types like `UUID`, `TEXT`, `TIMESTAMP` — if they appear as declared fields, it is DDL)
- [ ] Entity names in domain.md match exactly those in schema.md
- [ ] Lifecycle descriptions are consistent with cascade rules in schema.md
- [ ] Ownership boundaries are consistent with FK relationships in schema.md

---

## 7. Common failure modes

**1. Duplicating physical schema in domain**
The AI includes lists of fields with types (`id: UUID`, `created_at: timestamp`) in entity sections. This duplicates schema.md and creates drift when one changes. Detect: search for data types (`UUID`, `TEXT`, `TIMESTAMP`, `boolean`) in domain.md — if they appear in the context of "entity fields", it is DDL. Solution: replace with conceptual descriptions.

**2. Inventing invariants without a source**
The AI adds rules that sound reasonable but are not in creator-vision or in the observed reference. Detect: every invariant must have a source in the consolidated table — if it says "common sense" or has no source, it is an invention. Solution: remove it or move it to `open-questions.md` as a pending question.

**3. Omitting the consolidated invariants table**
The AI documents invariants per-entity but does not consolidate them. Consequence: the implementer cannot do a quick reference check of "did I implement all invariants?". Detect: verify that a `## Consolidated Invariants` section or equivalent exists with a numbered table. Solution: add the table before approving.

**4. Inconsistency between domain.md and schema.md**
The AI describes in domain.md that "when deleting a User, their Conversations are archived" but schema.md says "cascade delete". Detect: compare deletion semantics in ownership boundaries against the cascade rules table in schema. Solution: resolve the contradiction with creator-vision as arbitrator and update the lower-precedence file.

**5. Overly generic glossary**
The AI defines "User: a person who uses the system" — this adds no value beyond what any reader already knows. Detect: verify that each glossary definition includes the scope and behavior specific to the domain. Solution: rewrite with project-specific specificity (e.g. "User: an authenticated person who has Characters and Conversations; their identity isolates all their data on the platform").
