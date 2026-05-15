# Generation Guide: seed/product.md

## 1. When to include

**Conditional.** Include when the project scope is complex enough that having out-of-scope in its own document adds real clarity. Signals that it is worth it:

- The creator mentions multiple functional areas with non-obvious cuts between MVP and v1+
- There are distinct stakeholders or multiple personas with needs that could generate scope creep
- The project has anti-goals that the AI could "reasonably" add without this document

**For simple projects**: out-of-scope lives in `roadmap.md` under "Out of roadmap" and in `creator-vision.md`. Do not generate `product.md` unnecessarily — it violates the one-file-one-purpose principle.

---

## 2. Prerequisites

These must exist before opening this session:

- [ ] `seed/creator-vision.md`
- [ ] `seed/user-stories.md`

`schema.md` and `ux.md` are not blocking prerequisites, but if they already exist they help formulate more precise success criteria.

---

## 3. Session opening prompt

```
We are going to generate seed/product.md. This is the product definition document —
scope, MVP, anti-goals, and success criteria. It is intentionally concise: it does not contain
tech stack, schema, or screen specs.

Read the following files in this order before beginning:
1. seed/creator-vision.md   — what the product IS, what it is NOT, personas, principles
2. seed/user-stories.md     — flows F1..FN (covering the MVP), personas §4, priorities

Produce seed/product.md with this structure:
- Problem statement (1 paragraph)
- Target users (named personas with minimal description)
- Key user outcomes (what the user achieves)
- MVP scope (bullets, each linked to F1..FN or story ID)
- Explicit out-of-scope / anti-goals (with rationale and destination: v1+, indefinitely deferred, out-of-product)
- Observable success criteria (testable at release time, not aspirational)
- High-level constraints

Rules:
- Success criteria MUST be observable/testable ("the user can do X → Y is shown")
- Not aspirational ("the app feels good" → reject)
- Anti-goals need explicit rationale ("no X because Y; if the creator decides to add it → Z")
- DO NOT include tech stack, screen layouts, or schema definitions here
- If a feature from user-stories is not in the MVP scope → it must appear in anti-goals or in
  "Deferred to v1+" with the exact roadmap phase where it goes
```

---

## 4. Extraction map

### From `seed/creator-vision.md`
- §1 or equivalent "what this IS and what this is NOT" section → problem statement + anti-goals
- §8 non-negotiables → reflected as success criteria ("the app never [violates the invariant]")
- Mentions of personas or target users
- Any mention of "v0 scope" vs "v1 scope" vs "maybe never"
- Declared product principles (e.g. "functionality first, design second", "the user owns their data")

### From `seed/user-stories.md`
- §4 personas → must match exactly with product.md personas
- §6 flows F1..FN → these are the minimum MVP scope; all must appear in product.md §MVP scope
- Priority of each story (Critical/High/Medium/Low) → Low priority may be deferred
- Stories explicitly marked as v1+ or out-of-scope in user-stories.md

---

## 5. Required output structure

### 5.1 Problem statement
One paragraph. Answers: what problem do users have, why current solutions are not sufficient, and what this product proposes differently. Does not mention technology.

### 5.2 Target users
List of personas with name and functional description:

```markdown
## Target users

**[Persona A name]:** [description in 2-3 lines — who they are, what they need, what frustrations they have]

**[Persona B name]:** [description in 2-3 lines]
```

Use the same names as `user-stories.md` §4. If there is a name discrepancy → resolve with creator-vision as the arbiter.

### 5.3 Key user outcomes
What users achieve when the product works well. Maximum 5 bullets. Oriented toward outcomes, not features:

```markdown
- Creators can explore characters in depth without technical interruptions
- Writers can maintain narrative consistency across sessions
```

### 5.4 MVP scope
Bullets of the v0 scope. Each bullet must link to F1..FN or story IDs for traceability:

```markdown
## MVP scope (v0)

- Character creation and editing (F1, S01–S05)
- Conversation with a single character, streaming replies (F2, S06–S10)
- Grammar correction as opt-in per conversation (F3, S25–S27)
- Lorebook entries scoped to a conversation (F4, S28–S32)
- [...]
```

### 5.5 Explicit out-of-scope / anti-goals
Three categories:

**Anti-goals (never in this product):**
- "No multi-character conversations in a single chat — StoryPlots is designed for 1-on-1 depth"
- "No social/community features — private creative tool"

**Deferred to v1+ (explicitly not in v0):**
- "Multi-NPC conversations → v1 (creator-vision: deferred)"
- "Local model support (MLX) → v1 (creator-vision: BYOK cloud first)"

**Out of v0 scope (may appear in roadmap phase N+):**
- "[Feature] → Phase N of roadmap, not Phase 0–5"

Each item must have rationale. Without rationale, the AI in future sessions does not know whether it can add the feature "because the creator did not say no".

### 5.6 Observable success criteria
A list of criteria that can be verified at release time. Not aspirational:

```markdown
## Success criteria (v0 release)

- [ ] F1–F7 flows pass Playwright smoke tests without errors
- [ ] No cross-user data leakage: RLS policies verified in code review
- [ ] Edit-as-trim: editing a message removes all subsequent messages (observable in DB)
- [ ] Grammar is opt-in: a new conversation has grammar disabled by default (observable in settings)
- [ ] Character accent colors persist across sessions (observable in UI)
- [ ] BYOK: the app never stores the user's API key in plaintext (observable in DB / logs)
```

Each criterion must be falsifiable: someone can verify it in < 5 minutes without interpretation.

### 5.7 High-level constraints
Constraints the creator cannot unilaterally change:

```markdown
## Constraints

- BYOK (Bring Your Own Key): users provide their own API keys; the app never holds them
- Single-NPC per conversation in v0
- Supabase as the only data store (no local DB, no file system state)
- Web-first (no native mobile app in v0)
```

---

## 6. Quality gates before approving

- [ ] Every flow F1..FN from `user-stories.md` appears in MVP scope (search for each F by number)
- [ ] Anti-goals have explicit rationale (search for bullets without "because Y")
- [ ] Success criteria are observable (search for criteria without an "observable verb" — see/verify/check)
- [ ] Personas match `user-stories.md` §4 (same name and consistent description)
- [ ] No tech stack, versions, commands, or schema definitions
- [ ] The "Deferred to v1+" section covers the features marked as out-of-scope in user-stories

---

## 7. Common failure modes

**1. Aspirational success criteria**
The AI writes "users will enjoy a smooth experience" or "the app has good performance". Detect: a success criterion without an observable verb and without a concrete subject is aspirational. Solution: rewrite as "when doing X, the user sees Y in < Z ms" or remove.

**2. Anti-goals without rationale**
The AI lists "no Community features" without explaining why. Consequence: in a future session, the AI could interpret it as a flexible preference. Detect: search for anti-goal bullets without the word "because" or without a citation to creator-vision. Solution: add rationale before approving.

**3. Mixing product with tech stack**
The AI includes "we will use React 18 with TypeScript" or "the DB will be Supabase" in product.md. That content goes in tech-stack.md. Detect: search for technology names in product.md. Solution: remove from product.md and verify they are in tech-stack.md.

**4. MVP scope too large**
The AI includes in MVP scope features that the creator marked as v1+ in creator-vision. Detect: compare MVP scope against "what this is NOT" in creator-vision. Solution: move to "Deferred to v1+" with a citation.

**5. Invented personas**
The AI adds an "Enterprise User" persona that nobody described. Detect: compare product.md personas against user-stories §4 — they must match exactly. Solution: remove personas without backing in user-stories.
