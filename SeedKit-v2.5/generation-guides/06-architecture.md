# Generation Guide: seed/architecture.md

## 1. When to include

**Conditional — only for multi-service projects with real integration boundaries.**

Include when at least one of the following applies:
- The project has more than one process or service with its own runtime (frontend + backend + agents as separate processes)
- There are non-trivial integrations between subsystems (streaming SSE, background jobs, webhooks, message queues)
- The responsibilities of each layer are not obvious and could be misinterpreted

**For single-service projects**: layer responsibilities go in `tech-stack.md` §Layer responsibilities and no separate file is needed. Do not create `architecture.md` for projects where "everything is a monolith".

---

## 2. Prerequisites

These must exist and be **approved** before opening this session:

- [ ] `seed/product.md` ✓ *(if it exists; its integration constraints feed into this file)*
- [ ] `seed/domain.md` ✓ *(which entities each subsystem handles)*
- [ ] `seed/tech-stack.md` ✓ — the layer responsibilities from tech-stack are the starting point

If `domain.md` does not exist, use `schema.md` to understand the entities and their isolation rules.

---

## 3. Session opening prompt

```
We are going to generate seed/architecture.md. This file describes the technical
responsibilities of each subsystem and the integration boundaries between them.

Read the following files in this order before starting:
1. seed/tech-stack.md          — layer responsibilities (starting point)
2. seed/domain.md              — which entities each subsystem handles; which must be isolated
3. seed/product.md             — integration constraints (BYOK, streaming, isolation)
4. seed/creator-vision.md §8   — non-negotiables (especially agent isolation, SSE, BYOK)

Produce seed/architecture.md with this structure:
- System overview: ASCII diagram or table of subsystems
- Per subsystem: responsibilities + "What it does NOT do" (explicit section per subsystem)
- Integration boundaries: what talks to what, via what protocol
- Cross-subsystem technical flows (e.g. SSE streaming end-to-end, background jobs)
- Durable technical constraints (e.g. "Frontend never accesses API keys directly")

RULES:
- NEVER include stack versions (that goes in tech-stack.md)
- NEVER include physical schema or DB fields (that goes in schema.md)
- NEVER include conceptual domain invariants (that goes in domain.md)
- The "What it does NOT do" section is MANDATORY for each subsystem
- Cross-subsystem flows must be documented step by step (not as narrative descriptions)
- If a non-negotiable from creator-vision §8 implies an architectural constraint →
  it must appear in "Durable technical constraints" with a citation
```

---

## 4. Extraction map

### From `seed/tech-stack.md`
- Layer responsibilities (§5.4 or equivalent) — these are the starting point; architecture.md expands on them
- Stack per layer (frontend framework, backend framework, agent orchestration) — informs subsystem names
- "What we are NOT using" — some items may imply integration constraints

### From `seed/domain.md`
- Which entities are per-user / per-conversation → determines which subsystem has access to what
- Isolation rules and ownership boundaries → architectural constraints between subsystems
- Invariants that imply context separation between agents

### From `seed/product.md` (if it exists)
- Declared constraints (BYOK, streaming, cloud-only, etc.)
- Integration requirements mentioned

### From `seed/creator-vision.md`
- §8 non-negotiables that are architectural constraints:
  - Agent isolation → which subsystem can read which context
  - SSE for Agent replies → streaming protocol
  - BYOK → where keys are stored / used
  - Supabase as source of truth → who can write to DB

---

## 5. Required output structure

### 5.1 System overview

ASCII diagram or table showing the subsystems and how they connect:

```
Browser (React SPA)
     │ HTTP REST / SSE
     ▼
API Server (Hono)
     │ Supabase client
     ├─────────────────► Supabase DB (PostgreSQL + RLS)
     │
     │ LangGraph orchestration
     ├─────────────────► Conversation Agent
     │                       │ Anthropic API (user's key)
     │                       ▼ SSE stream back to API
     │
     └─────────────────► Grammar Agent (isolated context)
                             │ Anthropic API (user's key)
```

### 5.2 Per-subsystem breakdown

One section per subsystem. Each must have:

```markdown
### [Subsystem Name] ([Technology])

**Responsibilities:**
- [R1]: what this subsystem does
- [R2]: ...

**What it does NOT do:**
- Does not [action that might seem reasonable but is outside the scope of this subsystem]
- Does not [another important exclusion]

**Entry point:** how it interacts with the outside world (HTTP endpoint, function call, event, etc.)
**State:** stateless / stateful (and how it persists state if applicable)
```

**The "What it does NOT do" section is the most important.** It prevents the AI from migrating responsibilities between subsystems. Base it on:
- creator-vision §8 non-negotiables
- Layer responsibilities from tech-stack.md
- Separation of concerns between agents (if applicable)

### 5.3 Integration boundaries

Table of all integrations between subsystems:

| From | To | Protocol | Auth mechanism | Notes |
|---|---|---|---|---|
| Browser | API Server | HTTP REST | Supabase JWT | Standard requests |
| Browser | API Server | SSE | Supabase JWT | Agent reply stream |
| API Server | Supabase | Supabase client | Service role key | DB reads/writes |
| API Server | Conversation Agent | Function call (in-process) | N/A | LangGraph node |
| Conversation Agent | Anthropic API | HTTPS | User's API key (BYOK) | Never stored in server |
| ... | ... | ... | ... | ... |

### 5.4 Cross-subsystem technical flows

For each flow that crosses subsystem boundaries, document it step by step:

```markdown
### Flow: User message → Streaming reply

1. Browser sends POST /api/conversations/:id/messages with {content, user_jwt}
2. API Server validates JWT via Supabase, retrieves conversation context
3. API Server persists user Message to Supabase
4. API Server opens SSE connection back to Browser
5. API Server calls Conversation Agent with {messages, character_system_prompt,
   user_memory, lorebook_entries} — NO grammar data, NO other conversations
6. Conversation Agent calls Anthropic API with assembled context; streams tokens
7. Each token: Conversation Agent → API Server → SSE → Browser
8. On completion: API Server persists agent Message to Supabase; closes SSE
```

Also document relevant error flows.

### 5.5 Durable technical constraints

List of constraints that cannot change without reviewing the seed:

```markdown
## Durable technical constraints

- The Frontend never has direct access to the user's API key; it passes the user's JWT
  to the API Server, which retrieves the key from Supabase vault per request. (creator-vision §8: BYOK)
- The Conversation Agent receives only the context of its own conversation — no access to
  other conversations' Messages, LoreEntries, or Memory. (creator-vision §8: agent isolation)
- Agent replies are plain text streamed via SSE; the Frontend renders them — no HTML or
  markup in agent output. (creator-vision §8: plain text reply path)
- Supabase is the sole persistent data store; no in-memory state survives a server restart.
  (creator-vision §8: Supabase as source of truth)
```

---

## 6. Quality gates before approval

- [ ] Each subsystem has a "What it does NOT do" section
- [ ] All cross-subsystem flows are documented step by step (not just as descriptions)
- [ ] There are no stack versions in the document (that goes in tech-stack.md)
- [ ] There are no DB fields or DDL (that goes in schema.md)
- [ ] Non-negotiables from creator-vision §8 that imply architectural constraints appear in "Durable technical constraints"
- [ ] The integration boundaries table covers all arrows in the overview diagram
- [ ] Per-subsystem responsibilities are consistent with tech-stack.md §Layer responsibilities

---

## 7. Common failure modes

**1. Including stack versions**
The AI writes "API Server (Hono 4.3.11)". Versions go in tech-stack.md. Detect: search for version numbers with dots. Solution: remove versions, reference only the subsystem name and technology.

**2. Omitting "What it does NOT do" per subsystem**
The AI lists positive responsibilities but does not state exclusions. Consequence: the implementer assumes they can put business logic wherever is convenient. Detect: verify that each subsystem has the "What it does NOT do" section. Solution: add it before approving.

**3. Flows documented as narratives instead of steps**
The AI writes "the Conversation Agent processes the message and returns the response to the user via SSE". Without numbered steps, the implementer does not know what persists when or who is responsible for what. Detect: look for flow sections that are a paragraph instead of a numbered list. Solution: rewrite as steps 1..N.

**4. Overlapping responsibilities between subsystems**
The AI assigns message persistence to both the "API Server" and the "Conversation Agent". Detect: read each subsystem's responsibilities and look for duplicates. Solution: resolve with creator-vision as arbitrator (whoever has the more explicit source).

**5. Including physical schema**
The AI describes that "the API Server reads the `messages` table with fields `id, content, created_at`". Fields go in schema.md. Detect: search for field names with types in architecture.md. Solution: replace with domain entity references ("reads the Messages of the Conversation") without specifying fields.
