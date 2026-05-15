# Generation Guide: seed/schema.md

## 1. When to include

**Always.** It is one of the 5 spark files. Without schema, the roadmap cannot have executable exit criteria and the framework cannot generate migrations.

---

## 2. Prerequisites

These must exist and be approved before opening this session:

- [ ] `seed/creator-vision.md`
- [ ] `seed/user-stories.md`
- [ ] `seed/references/[AppName]/03-data-model.md` *(or the equivalent file that documents the reference app's data model)*

If the project has no reference, `creator-vision.md` and `user-stories.md` are the only inputs — but this implies greater risk of invention. Document in `open-questions.md` which entities are inferred vs observed.

---

## 3. Session opening prompt

Paste this text at the start of the dedicated session (adjust `[AppName]` and actual paths):

```
We are going to generate seed/schema.md for this project. This is a conceptual
data model specification file — NO DDL, NO migrations, NO code.

Read the following files in this exact order before beginning:
1. seed/references/[AppName]/03-data-model.md  — model observed in the reference app
2. seed/creator-vision.md                       — creator intent + non-negotiable invariants
3. seed/user-stories.md                         — flows and entities implied by the stories

Once all three are read, produce seed/schema.md following this structure:
- ERD diagram in ASCII (relationships between entities)
- Per entity: conceptual fields, FK relationships, uniqueness constraints,
  isolation/RLS rule, pending open questions
- Cascade rules table (what happens when the parent is deleted)
- "Business Rules / Invariants" section with rules numbered 1..N
- Glossary (canonical names with a 1-line definition)

Strict rules:
- NEVER use DDL (no CREATE TABLE, no NOT NULL, no PRIMARY KEY)
- If an entity is unclear in the inputs → record in open-questions.md, do not invent
- Invariants must come from creator-vision §8 or from observed behavior in the
  reference, never from speculation
- Cite the source of each decision: (creator-vision §X) or (observed: reference §Y)
```

---

## 4. Extraction map

### From `seed/references/[AppName]/03-data-model.md`
- List of all observed entities (canonical names)
- Observed fields per entity (with types if documented)
- FK relationships between entities
- Observed scoping rules (what is per-user, per-conversation, per-character, global)
- Observed cascade behavior (what happens when a conversation, user, etc. is deleted)
- Observed indexes or uniqueness constraints

### From `seed/creator-vision.md`
- §8 or equivalent "non-negotiables" section → each one maps to an invariant in schema
- Any mention of new entities that the reference does not have
- Explicit scoping rules ("Lorebook is per-Conversation, not global")
- Isolation preferences ("no cross-user leakage", "agent isolation")

### From `seed/user-stories.md`
- Each story that mentions a new entity or a new constraint
- Acceptance criteria that imply a business rule in data
- Flows F1..FN — each step that implies a data operation

---

## 5. Required output structure

### 5.1 ERD (relational diagram)
- ASCII tree or table showing entities and relationships
- Sufficient to understand who "owns" whom (ownership) without reading the detail sections
- Do not include fields — only entities and relationship type (1:N, N:N, etc.)

### 5.2 Per entity (one section per entity)
Each entity must have:
- **Purpose**: what it represents in the domain (1-2 lines)
- **Fields**: conceptual fields with type (string, uuid, timestamp, boolean, json) — NO DDL
- **Unique constraint**: which combination of fields is unique (or none)
- **FK relationships**: what references what, with cascade behavior
- **Isolation / RLS rule**: who can view/modify this entity (per-user, per-conversation, per-character, public, etc.)
- **Open questions**: gaps or ambiguities specific to this entity

**Do not include** in entity sections: narrative lifecycle states (that goes in domain.md), application logic, migration code.

### 5.3 Cascade rules (table)
A consolidated table:

| Parent entity deleted | Child entity | Behavior |
|---|---|---|
| User | Conversation | cascade delete |
| Conversation | Message | cascade delete |
| ... | ... | ... |

### 5.4 Business Rules / Invariants
Numbered list 1..N. Each rule:
- Is a **statement that can never be false** in the system
- Is **falsifiable** (can be verified by code or test)
- Cites its source: `(creator-vision §X)` or `(observed: reference §Y)`

Examples of well-written rules:
- "1. A Message belongs to exactly one Conversation; it cannot change Conversations. (creator-vision §8)"
- "2. Each Conversation has exactly one Character assigned at the moment of creation; this assignment is immutable. (observed: reference §3.2)"

**Do not include** ambiguous, aspirational, or application-logic-duplicating rules.

### 5.5 Glossary
Table of canonical names:

| Term | Definition |
|---|---|
| Conversation | A chat session between a User and a Character |
| ... | ... |

Covers all domain nouns that appear in the seed. Use the same names across all seed files.

---

## 6. Quality gates before approving

Verify each point before signing off on the document:

- [ ] Every entity mentioned in `user-stories.md` has its entry in schema
- [ ] Every non-negotiable from `creator-vision.md` §8 has an explicit enforcement mechanism (field, constraint, RLS rule, or numbered invariant)
- [ ] No entity uses DDL (`CREATE TABLE`, `NOT NULL`, `PRIMARY KEY`, `REFERENCES` with SQL syntax)
- [ ] Every entity has a defined isolation/RLS rule (even if "public read, authenticated write")
- [ ] The cascade rules table covers all parent-child relationships in the ERD
- [ ] Invariants are numbered, falsifiable, and cite their source
- [ ] The glossary covers all domain nouns used in user-stories
- [ ] Critical open questions are in `open-questions.md`, not silently resolved in the schema

---

## 7. Common failure modes

**1. Generating DDL instead of a conceptual schema**
The AI produces `CREATE TABLE users (id UUID PRIMARY KEY, ...)`. Detect: search for `CREATE TABLE`, `PRIMARY KEY`, `NOT NULL`, `REFERENCES` in SQL syntax. Solution: ask it to rewrite the entity sections in conceptual format (field name + semantic type + purpose).

**2. Omitting the isolation/RLS rule per entity**
The AI documents fields and relationships but does not say who can access what. Detect: search for `Isolation` or `RLS` in the document — if an entity does not have that line, it is missing. Solution: add an isolation rule line to each entity before approving.

**3. Mixing domain prose with schema**
The AI includes narrative lifecycle states ("a Conversation can be in Draft, Active, or Archived state") in entity sections. That content belongs in `domain.md`. Detect: search for "Lifecycle" or "States" sections in schema. Solution: extract to `domain.md` or, if there is no domain.md, add only the state field (e.g. `status: enum`) without the transition diagram.

**4. Non-falsifiable invariants**
The AI writes rules like "user data must be kept private" (aspirational) instead of "no query can return a User's Conversations to another User" (verifiable). Detect: invariants without a concrete enforcement mechanism. Solution: rewrite as a falsifiable statement referencing the layer that enforces it (RLS, constraint, etc.).

**5. Invented entities without evidence**
The AI adds entities that do not appear in the reference or in creator-vision (e.g. a notification system when nobody asked for it). Detect: compare each schema entity against the sources. Solution: remove entities without backing and record in `open-questions.md` if the creator wants to add them in the future.
