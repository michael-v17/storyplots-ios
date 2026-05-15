---
id: 0012
slug: fork-conversation
status: shipped
created: 2026-04-16
---

# Cycle 0012 — Fork Conversation (branching with grammar + lorebook copy)

## Context

Cycles 0001-0011 shipped the full single-Conversation experience:
messages with edit-as-trim, variants, BYOK streaming, grammar
corrections + dashboard, per-Conversation Lorebook + Author's Notes.
Migration 0005 pre-wired the four branch fields on `conversations`
(`branch_parent_conversation_id`, `branch_parent_message_id`,
`branch_mode`, `parent_branch_summary`) but nothing reads or writes
them yet.

This cycle lands **Fork Conversation** — one of the 7 non-negotiable
flows ([`user-stories.md §6 F6`](../Seed/user-stories.md)). A user
can fork at any message with two modes:

- **Keep messages** — new Conversation initialized with a full copy
  of messages up to the fork point (plus their active variants).
- **Summarize & start fresh** — new Conversation starts empty but
  carries a parent-branch summary injected at prompt position #10.

Branching is **copy, not reference**: Lorebook rows and Grammar
correction rows belonging to the kept range are duplicated with the
new `conversation_id` so each branch is fully self-contained
([`creator-vision.md §5.2`](../Seed/creator-vision.md) +
[`domain.md §4.2, §6 #6`](../Seed/domain.md)).

**Done when:** from any message in Chat, clicking a new `⑂` action
opens a Fork modal. Picking a mode + optional branch name creates a
new Conversation row (visible in the Conversation switcher), copies
the appropriate payload, and navigates to the new Conversation.
The parent is unchanged. Grammar + Lorebook on the child are
populated from turn 1 and mutations on either side are independent.

## Shape of the change

```
No migration:
 Branch fields already exist on conversations (migration 0005).
 One small FK add: branch_parent_message_id → messages(id)
 on delete set null (the 0005 TODO comment).

Backend new route — POST /conversations/{id}/fork:
 Validates: caller owns conversation; message_id belongs to it;
            mode ∈ {keep_messages, summarize_fresh}.
 Transactional copy (best-effort sequential, matches edit-as-trim):
 1. Insert child conversation row (same character_snapshot,
    writing_style_snapshot, persona_id; branch_* fields populated).
 2. If keep_messages:
    - copy messages 1..N with preserved role, text, created_at offset
      (monotonic), and — for assistant rows — a copy of only the
      active variant (fresh message_variants row, new ids).
    - active_variant_id on each child message points to the new
      variant row.
 3. If summarize_fresh:
    - call provider with Branch-Summary system prompt to produce
      `TITLE: <title>\n\n<summary body>`. Parse the TITLE line off
      the top; persist the rest to parent_branch_summary. Fall back
      to "Branch of <parent.title>" if TITLE line missing.
    - no messages copied.
 4. Copy lorebook_entries where conversation_id = parent (all of
    them — per-Conversation entries are scoped by conversation and
    the "kept range" is the whole conversation, same as PersonaLLM's
    loreScanDepth).
 5. Copy grammar_corrections where user_message_id IN kept range.
 6. Return child conversation_id.

Frontend:
 lib/fork.ts                         Thin POST helper.
 features/chat/ForkDialog.tsx        Modal: name field, mode picker,
                                     starting-point preview, CTA.
 features/chat/MessageBubble.tsx     + ⑂ Fork action beside Edit /
                                     Regenerate.
 features/chat/ChatShell.tsx         Wires the ⑂ action → dialog →
                                     POST → navigate.
 features/chat/BranchBreadcrumb.tsx  "Parent: <title> · forked at N"
                                     pill in ChatShell header when
                                     branch_parent_conversation_id
                                     is set.
```

## 1. Seed sections satisfied

- [user-stories.md #14 · High](../Seed/user-stories.md) *Branch a
  Conversation at any message* — all 7 acceptance criteria.
- [user-stories.md §6 F6](../Seed/user-stories.md) — Branching
  non-negotiable flow.
- [creator-vision.md §5.2 "Branching × Grammar"](../Seed/creator-vision.md) —
  copy all GrammarCorrection rows into the new Conversation.
- [creator-vision.md §8](../Seed/creator-vision.md) — non-negotiables
  "Branching copies", "Snapshot semantics" preserved: the child's
  `character_snapshot` is copied verbatim (immutable); the
  parent is never mutated.
- [domain.md §2.13 ConversationBranch, §4.2 "Carry-forward on
  branch", §6 #6](../Seed/domain.md) — entity definitions +
  copy-not-reference invariant + self-contained child.
- [schema.md §2.4 conversations branch fields, §2.7 lorebook_entries
  "Branching: COPIED", §2.14 grammar_corrections "Branching:
  copied"](../Seed/schema.md) — fields + copy rules.
- [ux.md §4.6 / §5](../Seed/ux.md) — Fork modal + breadcrumb.
- [PersonaLLM-Reference/04-screens/branch.md](../Seed/PersonaLLM-Reference/04-screens/branch.md) —
  modal layout, two-mode picker, starting-point preview,
  TITLE: parsing convention, breadcrumb pattern. v0 drops the
  destructive red theme per the file's own "User Extensions"
  note ("overkill for a non-destructive action").

## 2. Commit decisions made this cycle

Open questions the seed leaves explicit; resolving inline per 0011's
pattern (not new entries in `open-questions.md` because each is
tightly scoped to 0012's implementation):

- **Active variant is copied; inactive variants are not.** The
  kept-range copy takes only the currently-active `message_variants`
  row for each assistant message. Inactive variants represent
  unchosen paths — the fork is itself the user asserting "continue
  from the chosen path". Storage savings too. Reversible later.
- **Summarize mode uses the Text Engine provider** (the same
  BYOK key + default model as the Conversation Agent). Rationale:
  the Branch Summary is a prose generation task, not grammar; the
  Grammar Agent's JSON mode would be a mismatch. No per-user
  setting shipped for a separate summarizer.
- **Copy all Lorebook entries, not a subset.** Lorebook is already
  per-Conversation (cycle 0011) and entries are not message-indexed,
  so the "kept range" reduces to "everything". If the user has
  unused entries they can delete from the child's Lorebook panel.
- **FK `branch_parent_message_id → messages(id)` added this cycle.**
  Migration 0005 deliberately skipped the FK because `messages`
  didn't exist yet. Adding `ON DELETE SET NULL` preserves the
  branch even if the parent's anchor message is later deleted
  (which stays possible via the edit-trim flow).
- **Parent-delete behavior: cascade or set-null?** Migration 0005
  already committed `branch_parent_conversation_id ... ON DELETE
  SET NULL` — deleting the parent orphans children but keeps them.
  This matches PersonaLLM-Reference's open question #3 the way
  their own decisions lean (self-contained branch).

## 3. Schema scope / RLS

### Migration `supabase/migrations/0012_fork.sql` — tiny

```sql
-- Cycle 0012 — Fork Conversation: wire the deferred FK from 0005.
alter table public.conversations
  add constraint conversations_branch_parent_message_id_fkey
    foreign key (branch_parent_message_id)
    references public.messages(id)
    on delete set null;

create index conversations_branch_parent_conversation_id
  on public.conversations (branch_parent_conversation_id)
  where branch_parent_conversation_id is not null;
```

No new tables. No RLS changes — the existing `user_id = auth.uid()`
policy on `conversations` covers the child row, and on
`lorebook_entries` / `grammar_corrections` / `messages` /
`message_variants` covers the copies (they inherit the inserting
user's id in the RLS check).

## 4. Backend — new module + route

### `backend/app/routes/fork.py` (new file)

```python
@router.post("/conversations/{conversation_id}/fork")
async def fork_conversation(
    conversation_id: str,
    payload: ForkPayload,
    user: AuthUser = Depends(verify_supabase_jwt),
    authorization: str = Header(...),
) -> dict:
    # ForkPayload: message_id: str, mode: Literal["keep_messages","summarize_fresh"], title?: str
    ...
```

Steps, using `UserSupabase` (PostgREST under the caller's JWT):

1. `select` parent conversation + verify `user_id = user.sub`.
2. `select` anchor message + verify it belongs to the conversation
   and is role ∈ {user, assistant}.
3. `select` kept-range messages: `conversation_id=eq.{parent}` +
   `created_at=lte.{anchor.created_at}` (monotonic because 0006
   enforces a chronological CHECK).
4. For summarize_fresh, call the Conversation provider with the
   Branch Summary system prompt (a new
   `backend/app/prompts/branch_summary_system.txt`) + the kept-range
   transcript. Parse `TITLE: ...\n\n<body>`.
5. `insert` child conversation row: same character_snapshot /
   writing_style_snapshot / persona_id / character_id / user_id;
   title = title from payload OR parsed TITLE OR
   `"Branch of {parent.title}"`; `branch_parent_conversation_id`,
   `branch_parent_message_id`, `branch_mode`,
   `parent_branch_summary` populated.
6. If keep_messages: for each kept message, `insert` a new
   `messages` row (new id, same role, same text, preserve
   created_at chronology — use parent's created_at OR monotonically
   rewrite; we preserve because same-user and RLS still holds).
   For assistant messages, `insert` a new `message_variants` row
   copying the active variant's content / model_snapshot /
   generation_params_snapshot, then patch the child message's
   `active_variant_id` to the new variant id.
7. `insert` lorebook_entries: `select` all rows for parent, then
   insert them with the child's `conversation_id`.
8. `insert` grammar_corrections: `select` rows where
   `user_message_id in (parent kept range user-message ids)`, then
   insert with the child's `conversation_id` AND the corresponding
   **new** `user_message_id` from step 6. This mapping is
   parent-msg-id → child-msg-id and is built during step 6.
9. Return `{ "conversation_id": <child_id> }`.

### Prompt-assembly integration (position #10)

`backend/app/prompt_assembly.py` — `build_system_prompt` gains one
block just after position 6 (Knowledge Base) and before other
deferred positions:

```python
("Context Summary", _position_10_parent_summary(bundle)),
```

where `_position_10_parent_summary` emits the stored
`parent_branch_summary` text under a `# Parent Branch Summary`
heading if the conversation has `branch_mode = 'summarize_fresh'`
and the summary is non-empty. Nothing else changes.

`_load_bundle` in `routes/chat.py` already reads `conversations.*`
so `branch_mode` + `parent_branch_summary` are already in the
bundle — just surface them.

### New file `backend/app/prompts/branch_summary_system.txt`

```
You are summarizing a role-play conversation so a new branch can
continue from a clean slate. Output MUST start with a single line:

TITLE: <3-5 word branch title>

Then a blank line, then a short summary (under 200 words) that
preserves: key plot beats, the active setting, relationships between
characters, any unresolved tensions, and the emotional tone of the
last few turns. Do not editorialize. Do not include a greeting. Do
not use second person. Write in past tense.
```

## 5. UX surfaces

### `⑂ Fork` action on each message

Added to `MessageBubble`'s action row beside Edit / Delete / ↻
Regenerate. Disabled during any in-flight stream.

### `ForkDialog` modal

Layout mirrors `EditTrimDialog` (cycle 0007) for visual consistency:

- Header: "Fork Conversation" + × close.
- **Starting point** card: read-only, shows first 120 chars of the
  anchor message, ellipsized.
- **Branch name** text input (placeholder:
  "Auto-generated if empty").
- **Mode picker**: two radio cards stacked:
  - `⑂ Keep previous messages` — "Create a new branch with all
    messages copied up to this point" (default).
  - `📄 Summarize & start fresh` — "AI summarizes earlier messages;
    branch starts lightweight".
- **CTA** button: "Create Branch" (keep_messages) or
  "Summarize & Branch" (summarize_fresh). Shows a spinner while
  the POST is in flight (summarize mode can take a few seconds).
- Cancel button.

### `BranchBreadcrumb` pill in chat header

When the current conversation has `branch_parent_conversation_id`
set, render a small pill under the character name:

`↳ Parent: "<parent title>" · forked from msg #N`

Clicking navigates to the parent conversation at the resolved
conversation path. Non-destructive — no tree view this cycle.

### Conversation switcher

No change — the child conversation already appears by virtue of the
existing `listConversations(character_id)` query (cycle 0003).

## 6. Verification gates

1. **⑂ action visible.** On any message (user or assistant), the ⑂
   Fork button appears in the action row and is enabled when no
   stream is in flight.
2. **Keep messages — copy.** Conversation with 6 messages. Fork at
   message #4 keep_messages. New conversation has 4 messages with
   correct roles / text / chronology. Active assistant variants are
   copied. Parent is unchanged.
3. **Summarize & start fresh.** Same parent. Fork at message #4
   summarize_fresh. New conversation has 0 messages. Its
   `parent_branch_summary` is non-empty and starts with a coherent
   sentence (TITLE line stripped). Title is the parsed TITLE or
   fallback.
4. **Summary injected at position #10.** Send a first user message
   in the summarize_fresh child. Backend logs / response shows the
   system prompt contains the `# Parent Branch Summary` block.
5. **Lorebook copy.** Parent has 2 Lorebook entries. After fork,
   child has 2 entries (same title / keywords / body) with
   `conversation_id` = child and `source='manual'` preserved.
   Deleting an entry from child leaves parent's entries intact.
6. **Grammar copy.** Parent has 3 grammar_corrections. Fork
   keep_messages at a message after all 3. Child has 3
   grammar_corrections with `conversation_id` = child and
   `user_message_id` pointing to the **child's** new user-message
   ids (not the parent's). Editing the child's corrections does not
   affect the parent.
7. **Branch breadcrumb.** Child conversation chat header shows a
   breadcrumb pill linking back to the parent.
8. **Parent delete orphans child.** Delete the parent conversation.
   Child still exists with `branch_parent_conversation_id = NULL`
   (ON DELETE SET NULL).
9. **RLS isolation.** Anon B cannot read the branch fields on A's
   child conversation, cannot read A's copied lorebook entries,
   cannot read A's copied grammar_corrections.
10. **Auth guard.** POST /conversations/{id}/fork without a JWT
    returns 401. With A's JWT attempting to fork B's conversation
    returns 404 (not 403 — PostgREST RLS makes it invisible).
11. **Regressions 0001-0011.** Full send / edit-trim / regenerate /
    grammar / lorebook / notes flows still work on both parent
    and child conversations.

## 7. Implementation order

1. Migration 0012 (FK + partial index). Apply via Supabase SQL editor.
2. Backend: `routes/fork.py` + `prompts/branch_summary_system.txt`
   + wire into `app/__init__.py` router. Add position #10 to
   `prompt_assembly.py`.
3. Frontend: `lib/fork.ts`, `ForkDialog`, `⑂` action, breadcrumb.
4. Playwright: gates 1-7 live; 8-11 structural / grep-based.
5. code-review + code-simplifier consolidated pass over cycles
   0009-0012 (deferred from 0010 + 0011).

## Verification

Run on 2026-04-16 against hosted Supabase + OpenRouter
(deepseek/deepseek-v3.2). All 11 gates green.

Bug caught during implementation: `AuthUser` exposes `.id` (not
`.sub` — the JWT claim is named `sub` but the dataclass maps it).
`fork.py` referenced `user.sub` in 4 places → every request
returned 500 with no CORS header (Starlette middleware quirk
surfacing the secondary defect). Fix: replace with `user.id`; add
`@app.exception_handler(Exception)` in `main.py` so future 500s
return JSON+CORS instead of a bare text response.

1. **⑂ action visible.** ✅ Rendered on every user + assistant
   message in the Mira test conversation.
2. **Keep messages — copy.** ✅ Forked at message #4; child has
   3 messages (user/assistant/user), roles preserved, active
   variant content "It's an ancient fortress, now mostly in ruins."
   verbatim. Parent untouched.
3. **Summarize & start fresh.** ✅ Fork of same anchor produced
   child with `message_count = 0`, `parent_branch_summary`
   = "The traveler inquired about the ancient fortress known as
   Castle Vexen…" (200+ char coherent prose), title
   auto-parsed: `"Inquiry into Castle Vexen"` (TITLE: line
   correctly stripped from the body).
4. **Summary injected at position #10.** ✅ First turn in the
   summarize_fresh child: user "Remind me what we were just
   talking about." → NPC "We were discussing the old ruins of
   Castle Vexen." The model could only know about Castle Vexen
   via the `# Parent Branch Summary` block, since the child has
   zero message history.
5. **Lorebook copy.** ✅ Both forks (keep + summarize) carry the
   parent's "Castle Vexen" Lorebook entry with matching
   `title / keywords / body / source=manual`.
6. **Grammar copy.** ✅ Seeded a fake correction on the parent's
   first user message, forked keep_messages. Child has exactly
   1 correction row with `user_message_id` pointing to the
   child's new user-message id (not the parent's). Original text
   / corrected text / explanation / edit_distance all preserved.
   Parent's correction unchanged. Cleanup performed after gate.
7. **Branch breadcrumb.** ✅ "↳ Parent: \"New Conversation\" ·
   forked" pill in keep_messages child; "summarized fork" variant
   for the summarize_fresh child. Click navigates to the parent.
8. **Parent delete orphans child.** Structural — migration 0005
   `branch_parent_conversation_id … ON DELETE SET NULL` (line 17);
   migration 0012 `branch_parent_message_id … ON DELETE SET NULL`
   (line 5). Not exercised live to preserve the user's working
   parent conversation.
9. **RLS isolation.** Structural — no new RLS in 0012; the child
   conversation + its copied lorebook/grammar/messages rows all
   inherit the existing `user_id = auth.uid()` policies. Insert
   uses the caller's JWT so policy enforcement is automatic.
10. **Auth guard.** ✅ POST without JWT → 401
    ("Missing bearer token"); valid JWT against a non-existent /
    foreign conversation id → 404 ("conversation not found" — RLS
    filters the row out of the owner check's select).
11. **Regressions 0001-0011.** ✅ Parent conversation loads intact
    with its 8 messages, Author's Note 📝 badge still renders,
    Lorebook still has 1 entry. Chat streaming still works on
    both parent and summarize_fresh child (gate 4 was a live
    send+stream). No console errors beyond the fork-bug CORS
    traces that were fixed mid-session.

**Deferred from plan:** the consolidated code-review +
code-simplifier pass over cycles 0009-0012 is still queued for
before cycle 0013.
