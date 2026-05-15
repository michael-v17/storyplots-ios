# Generation Guide: seed/roadmap.md

## 1. When to include

**Always. It is the last file to be generated.** The roadmap is what turns the seed into an autonomous engine: it defines the construction order and the objective completeness criteria per phase. Without it, the AI must sequence phases in every session — which produces scope creep and inconsistency.

> **Absolute rule:** do not open this session until schema, ux, and tech-stack are approved. The roadmap needs all three to sequence phases correctly. Opening it before that produces phases out of sync with the actual seed content.

---

## 2. Prerequisites

These must exist and be **approved** before opening this session:

- [ ] `seed/user-stories.md` — flows F1..FN are the delivery units
- [ ] `seed/schema.md` ✓ approved
- [ ] `seed/ux.md` ✓ approved *(if UI project)*
- [ ] `seed/tech-stack.md` ✓ approved — needed for executable exit criteria
- [ ] `seed/references/[AppName]/` — to contextualize the phase sequence

Optional but valuable if they exist:
- [ ] `seed/product.md` — anti-goals go to "Out of roadmap"
- [ ] `seed/domain.md` — lifecycles help order entities by phase
- [ ] `seed/open-questions.md` — to avoid inventing answers to known gaps

---

## 3. Session opening prompt

Paste this text at the start of the dedicated session:

```
We are going to generate seed/roadmap.md. This is the last file in the seed — it defines
in what order we build the product and when each phase is complete.

Read the following files in this order before starting:
1. seed/user-stories.md          — flows F1..FN are the minimum delivery units
2. seed/schema.md                — which entities are prerequisites of others
3. seed/ux.md                    — which screens depend on which flows
4. seed/tech-stack.md            — testing stack for executable exit criteria
5. seed/creator-vision.md        — §8 non-negotiables that must pass in each relevant phase
6. seed/references/[AppName]/    — project complexity context

Produce seed/roadmap.md with this structure:
- Phase 0: skeleton/infrastructure (NEVER features in Phase 0)
- Phase 1..N: feature phases, each covering complete or partial flows from F1..FN
- For each phase: scope, user stories covered, flows covered, explicit out-of-scope,
  executable exit criteria as commands (not narratives), non-negotiables check
- Status of each phase: ⏳ pending / 🔒 ready to start / ✅ shipped
- Section "Out of roadmap": features discarded or deferred indefinitely

CRITICAL RULE — executable exit criteria:
Each phase MUST have criteria written as commands that can be run and verified.
NOT: "the authentication feature works correctly"
YES:
  pnpm typecheck → 0 errors
  vitest run → all pass
  playwright: navigate to /login, fill credentials, submit → redirect to /home
  curl localhost:3000/health → {"status":"ok"}

If you do not know exactly what command to run to verify something → write it as
playwright: [flow description] → [expected result]
or as: manual: [observable description]
But NOT as a narrative of "it works".

Do not invent phases for features that are not in user-stories or creator-vision.
If there is ambiguity about the order → record in open-questions.md and assume the
most conservative order (prerequisites first).
```

---

## 4. Extraction map

### From `seed/user-stories.md`
- Flows F1..FN (§6 or equivalent section) → these are the **delivery units**; each flow must be covered in some phase
- Stories grouped by area → suggest natural phase groupings
- Priority of each story (Critical / High / Medium / Low) → orders what comes first
- Acceptance criteria of each story → feed into the exit criteria of the phase

### From `seed/schema.md`
- Dependencies between entities (what requires what) → if B has an FK to A, A comes before B
- Business Rules / Invariants → what must be verified in exit criteria of each relevant phase
- Entities by complexity → simpler entities go in earlier phases

### From `seed/ux.md`
- Screens that depend on flows → a "Conversation" screen cannot be shipped without the Messages flow
- End-to-end flows → flows are the natural granularity of phases
- Required states → empty/loading/error/success must be in exit criteria if that screen is shipped

### From `seed/tech-stack.md`
- Testing stack → the unit runner and e2e tool determine the format of exit criteria
  - e.g.: "vitest run" vs "pytest" vs "jest"
  - e.g.: "playwright" vs "cypress"
- Layer responsibilities → what can be verified with typecheck vs test vs playwright vs curl

### From `seed/creator-vision.md`
- §8 non-negotiables → each non-negotiable has a natural phase where it must be green
  - e.g.: "agent isolation" → must pass in the phase that ships the first agent
  - e.g.: "BYOK" → must pass in the settings/auth phase
- Any mention of explicit order ("before X, Y must be ready")

### From `seed/product.md` (if it exists)
- Anti-goals and out-of-scope → go to the "Out of roadmap" section

---

## 5. Required output structure

### 5.1 Phase 0 — Skeleton / Infrastructure
**Purpose**: the first implementation cycle must not spend time on scaffolding. Phase 0 delivers a repo with structure, tooling, and a functional smoke test.

Typical content:
- Repo layout and package.json with pinned dependencies
- DB connection + first migration (structure only, no feature data)
- Basic auth (if the project requires auth)
- Dev server running + health endpoint
- Basic CI (typecheck + lint)

Phase 0 exit criteria:
```
pnpm install → no errors
pnpm typecheck → 0 errors  
pnpm dev → server starts on port X
curl localhost:X/health → {"status":"ok"}
```

**Do not include in Phase 0**: product features, user flows, feature UI.

### 5.2 Phase 1..N — Feature phases

Each phase must contain:

**Scope** (bullets):
- What this phase delivers in terms of visible behavior
- Granularity: a phase covers 1-3 complete flows (F1, F3) or part of one (F2 partial: send only, without stream)

**User stories covered** (by ID: S01, S12, etc.):
- Lists the IDs from `user-stories.md` that this phase completes
- Partially covered stories are noted as "S05 (partial: AC1-AC3)"

**Flows covered** (F1..FN):
- If a flow is fully covered: `F2 — Send message (complete)`
- If partially covered: `F3 — Grammar (partial: opt-in only; correction display in Phase N+2)`

**Explicit out-of-scope** (what this phase does NOT touch and which phase it goes to):
- "Grammar display → Phase 5"
- "Lorebook UI → Phase 6"
- "No branching in this phase → Phase 7"

**Executable exit criteria**:
```
pnpm typecheck → 0 errors
vitest run → all pass
playwright: [exact description of the flow to test] → [observable result]
playwright: [critical edge case] → [observable result]
```

At least one playwright criterion per flow covered in this phase.

**Non-negotiables check** (list those that apply to this phase):
- "Agent isolation: verify that the Conversation Agent cannot read GrammarCorrections → playwright flow F3"
- If no non-negotiable applies to this phase: "N/A for this phase"

### 5.3 Status tracker

At the end or beginning of each phase:

```
Phase 0 — Skeleton           ⏳ pending
Phase 1 — Characters CRUD    ⏳ pending
Phase 2 — Conversations      ⏳ pending
...
```

Only one phase can be in `🔒 ready to start` or `✅ shipped` at a time. The framework updates this as it progresses.

### 5.4 "Out of roadmap" section

Features discarded or deferred indefinitely. For each one:
- Name of the feature
- Why it is out (anti-goal, deferred indefinitely, out-of-v0-scope)
- Reference to where the decision was documented (`creator-vision §X` or `product.md §Y`)

---

## 6. Quality gates before approving

- [ ] Every flow F1..FN from `user-stories.md` is covered in some phase (search for each F by number)
- [ ] Phase 0 exists and contains only infrastructure/skeleton, not features
- [ ] Each phase has at least one executable exit criterion as a command or playwright assertion
- [ ] No exit criterion is a narrative ("works correctly" → reject)
- [ ] Each phase has explicit out-of-scope with the destination phase
- [ ] All non-negotiables from `creator-vision.md` §8 appear in exit criteria of some phase
- [ ] The "Out of roadmap" section covers the anti-goals from `product.md` or `creator-vision.md`
- [ ] No phase touches more than 3 complete flows (if a phase has 4+, split it)
- [ ] The command versions in exit criteria match those in `tech-stack.md` (same runner, same e2e tool)

---

## 7. Common failure modes

**1. Narrative exit criteria** (the most costly failure according to the StoryPlots postmortem)
The AI writes "authentication works correctly" or "the user can send messages". Detect: search for criteria without a concrete command. Solution: rewrite as `playwright: [exact flow] → [observable result]` or as `curl endpoint → expected response`. A criterion without a command is invalid.

**2. Absence of Phase 0**
The AI starts with Phase 1 assuming the scaffold already exists. Result: the first implementation cycle wastes time on setup and delivers no features. Detect: verify that the first phase is explicitly infrastructure and does not include user flows. Solution: add Phase 0 with scope limited to repo setup + health check.

**3. Phases that are too large**
A phase covers 5+ flows simultaneously → the AI cannot complete it in one session → the phase becomes a macro-cycle with no natural close. Detect: count the flows per phase. If there are more than 3, propose to the creator how to split it. Solution: divide into more granular phases where each one has its own exit criteria.

**4. Omitting "Out of roadmap"**
The AI omits listing features explicitly outside the scope. Consequence: in future sessions, the AI "helps" by adding features the creator had discarded. Detect: verify that the section exists and covers the anti-goals from `creator-vision.md`. Solution: add it before approving.

**5. Non-negotiables not mapped to phases**
The invariants from `creator-vision.md` §8 exist but do not appear in any exit criterion. The AI implements the feature but never verifies the invariant. Detect: search for each non-negotiable in the roadmap's exit criteria — if it does not appear in any criterion, it is missing. Solution: add a specific exit criterion in the relevant phase.
