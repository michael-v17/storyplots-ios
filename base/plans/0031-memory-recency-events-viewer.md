---
id: 0031
slug: memory-recency-events-viewer
status: shipped
created: 2026-04-17
---

# Cycle 0031 — Memory recency + event extraction + chat-side viewer

## Context

After cycle 0030's union-query + editable-extraction-prompt polish, the creator catalogued the full landscape of memory types for chat roleplay and locked scope:

- **Per-Conversation only** (intentional seed §3 divergence from PersonaLLM — no cross-conversation memory, ever)
- **Recency matters** — newer facts should weigh more in retrieval
- **Episodic content matters** — the system should capture events, actions, and promises, not just static traits

Explicitly out of scope: per-character cross-conversation memory, per-user global memory, per-user-per-character relationships, confidence scores, affinity meters, agentic memory tools. The creator also wants a minimal safety net — a way to clear bad memories from a conversation — without building a full Memory editor.

This cycle ships three tight, composable polish items:

1. **Recency weighting in retrieval — by message distance, not wall-clock.** Today `memory_search` sorts purely by cosine distance. We add a `recency_weight` parameter (0-1, user-tunable) that blends cosine similarity with a **message-count-based** decay factor so recent facts surface ahead of old ones when similarity is close. **Why message distance and not hours?** A user might chat 2 hours today then continue 5 days later — a fact from yesterday's session shouldn't be deeply penalized just because calendar time passed. What matters is narrative distance: how many turns have happened since the fact was extracted. Formula: `final_score = similarity * (1 - w) + w * recency_factor` where `recency_factor = 1 / (1 + messages_since / 20)` — half-weight at 20 messages (≈10 user-assistant pairs) ago. Each chunk stamps `message_count_at_creation` when inserted; retrieval computes `messages_since = current_message_count − message_count_at_creation`.

2. **Event / action / promise extraction.** No schema change. We rewrite the default `memory_extract_system.txt` so the LLM categorizes each memory item by topic (`event`, `action`, `promise`, `fact`, `relationship`). The existing `topic` field on `ExtractedFact` stores the category and flows into `memory_documents.title`. Keeps narrative continuity ("Aria promised to return at dawn") alongside static traits ("Aria fears storms").

3. **Chat-side Memory viewer + clear-all.** A new `📚 Memory` row in ChatControlsPanel opens a sub-view that lists this conversation's extracted chunks (newest first, with topic badge), lets the user delete individual chunks, and offers a single **"Clear all memory for this conversation"** button. No inline edit — keeping scope tight; if the user wants to fix a bad memory they delete and let the next extraction re-capture. Read-only otherwise.

**Why minimum viewer UI, not a full editor?** The creator explicitly asked for the lightweight version ("botón Clear memory + opcionalmente lista read-only"). A full editor adds significant UX complexity (confirmation modals, re-embedding on edit, merge conflicts). Deferring until a real user hits a case a delete-and-regenerate can't solve.

**Principle 5 (Observed vs. Extended).** Recency weighting is observed in `PersonaLLM-Reference/04-screens/settings/memory.md §Retrieval Tuning` — listed as an 8th implicit knob. The topic-categorized extraction is an **extension** of PersonaLLM's Auto Lore Extraction prompt (which categorizes Lorebook entries similarly: "Named characters, locations, items, relationships, world rules, significant events"). The chat-side viewer doesn't exist in PersonaLLM's observed surface — it's a v0 extension for quality-of-life.

**Done when:**
- Migration 0034 replaces `memory_search` with a version that accepts `p_recency_weight`.
- `users.preferences.memory.recency_weight` persists; slider in `/settings/memory` tunes it (0-1, default 0.3).
- `_load_bundle` passes the user's `recency_weight` pref into the RPC.
- Default `memory_extract_system.txt` instructs the LLM to use the 5 allowed topics.
- ChatControlsPanel root has a **Memory** row; sub-view lists chunks with delete buttons and a "Clear all" button.
- Live-verified: older facts lose to newer facts of equal similarity; an `action` extraction categorizes correctly; deleting a chunk from the viewer removes it from future retrievals; clear-all empties the conversation's memory.

## Shape of the change

```
Migration 0034_memory_recency.sql:
  alter memory_document_chunks add column message_count_at_creation int default 0
  replace memory_search RPC — adds p_current_message_count + p_recency_weight;
  formula final_score = similarity * (1 - w) + w * recency_factor,
  recency_factor = 1 / (1 + messages_since / 20).

Backend:
  prompts/memory_extract_system.txt           rewrite: add 5-topic categorization
  routes/chat.py::_run_memory_extraction_task stamp message_count_at_creation on insert
  routes/chat.py::_load_bundle                pass current message_count + recency_weight to RPC

Frontend:
  lib/memoryPrefs.ts                  + recency_weight: number (0-1, default 0.3)
  lib/memory.ts                       NEW — list/delete chunk, clear conv
  routes/MemorySettings.tsx           + Recency weight slider
  features/chat/ChatControlsPanel.tsx + Memory row + view="memory" branch
  features/chat/MemoryPanel.tsx       NEW — list of chunks + delete + clear-all

One schema add (int column default 0 — no migration of existing rows).
```

## 1. Seed sections satisfied

- [user-stories.md story 41](../Seed/user-stories.md) *Tune RAG memory* — adds the recency knob and closes the remaining gap between v0 and story 41's committed param set for RAG.
- [creator-vision.md §3](../Seed/creator-vision.md) *Per-Conversation scope* — reinforced; clear-all respects it (only affects current conversation).
- [PersonaLLM-Reference/04-screens/settings/memory.md §Retrieval Tuning] *Recency weighting* — observed in PersonaLLM; adopted.
- [PersonaLLM-Reference/04-screens/settings/memory.md §Auto Lore Extraction] *categorization by entity type* — pattern replicated in our Memory extraction default.
- [domain.md §6.1 invariant] Grammar Agent forbidden set — trivially preserved.

## 2. Commit decisions

1. **Recency formula = weighted blend by message distance, not filter.** `final_score = similarity * (1 - w) + w * recency_factor`. `recency_factor = 1 / (1 + messages_since / 20)`. `messages_since = conversation.message_count − chunk.message_count_at_creation` (clamped at 0). At `w=0` pure cosine; at `w=1` pure message-recency. Default `w=0.3`. Rationale: a hard recency filter would hide old-but-relevant facts; a weighted blend lets recency break ties without dominating. **Message distance makes the metric session-agnostic** — 5-day gap between sessions doesn't penalize yesterday's facts.
2. **Half-life = 20 messages.** Hardcoded in the RPC. ≈10 user-assistant pairs. Chat sessions typically run 10-50 turns so 20-message half-life means facts from ~halfway back in the current session weigh ~0.5 of the most recent. Tunable in a future cycle if users report stale facts dominating.
3. **`messages_since` is clamped at 0.** Legacy chunks (pre-migration) have `message_count_at_creation = 0`; their `messages_since` = current count, so they decay naturally. This is fine — the recency column doesn't need backfill for existing data.
4. **Ranking uses the combined score — `p_match_threshold` still applies to raw cosine.** Old contract preserved: threshold filters out genuinely irrelevant candidates by semantic distance; recency only reshuffles what survives the threshold.
5. **Topic categories = closed set of 5:** `event | action | promise | fact | relationship`. If the LLM returns any other topic string, backend accepts it as-is (no hard validation) so the extraction prompt can be customized to introduce new categories in the future.
6. **Chunks display topic as a small badge** (grey pill) before the fact text. No filtering by topic in v0.
7. **Delete is one-shot per chunk, no undo.** Confirmation is the row itself (explicit × click). Clear-all requires a `window.confirm`.
8. **Viewer is read-only for text.** Only action: delete. No inline edit. Future cycle can add an "Edit" mode if needed.
9. **No new backend endpoint.** Delete/clear-all use RLS-scoped direct Supabase calls (mirror lorebook.ts pattern). `memory_document_chunks` RLS policy already permits delete by `user_id = auth.uid()`.
10. **Deleting the last chunk of a memory_documents row** leaves the document row empty but present. Cleanup (cascading empty docs) deferred — zero impact on retrieval.

## 3. Schema — migration 0034

`supabase/migrations/0034_memory_recency.sql`:

```sql
-- Cycle 0031 — Message-distance recency weighting on memory_search.
-- Adds message_count_at_creation column (legacy chunks default to 0 → decay
-- naturally). Replaces the cycle-0029 RPC with one that takes the caller's
-- current conversation message_count + a recency weight 0..1.
-- Ranking: final_score = similarity * (1-w) + w * recency_factor,
-- where recency_factor = 1 / (1 + messages_since / 20).

alter table public.memory_document_chunks
  add column if not exists message_count_at_creation integer not null default 0;

drop function if exists public.memory_search(uuid, vector(1536), float, int);
drop function if exists public.memory_search(uuid, vector(1536), float, int, float);

create or replace function public.memory_search(
  p_conversation_id       uuid,
  p_query_vec             vector(1536),
  p_match_threshold       float,
  p_match_count           int,
  p_current_message_count int default 0,
  p_recency_weight        float default 0.3
) returns table (
  chunk_id           uuid,
  memory_document_id uuid,
  text               text,
  similarity         float,
  recency            float,
  score              float
)
language sql stable security definer set search_path = public as $$
  with w as (
    select greatest(least(p_recency_weight, 1.0), 0.0) as weight
  ),
  candidates as (
    select
      c.id                                         as chunk_id,
      c.memory_document_id                         as memory_document_id,
      c.text                                       as text,
      1 - (c.embedding <=> p_query_vec)            as similarity,
      1.0 / (1.0 + greatest(
        p_current_message_count - c.message_count_at_creation, 0
      )::float / 20.0)                             as recency
    from public.memory_document_chunks c
    where c.conversation_id = p_conversation_id
      and c.user_id = auth.uid()
      and c.embedding is not null
      and (1 - (c.embedding <=> p_query_vec)) >= p_match_threshold
  )
  select
    c.chunk_id, c.memory_document_id, c.text, c.similarity, c.recency,
    c.similarity * (1 - (select weight from w))
      + (select weight from w) * c.recency as score
  from candidates c
  order by score desc
  limit p_match_count;
$$;

grant execute on function public.memory_search(uuid, vector(1536), float, int, int, float) to authenticated;
```

**Backward compatibility:** the old 4-arg + 5-arg signatures are dropped; any direct caller must update to pass 6 args (or the defaults). Our only caller is `backend/app/routes/chat.py` which is updated in this cycle.

## 4. Backend changes

### 4.1 `backend/app/prompts/memory_extract_system.txt` — rewrite default

New body:

```
You extract 1-3 concise standalone memorable items from recent dialogue. Each item is something worth remembering for future turns.

## Categorize each item with one of these topic values

- "event": something that happened in the scene ("Aria entered the inner chamber", "A storm broke over the shrine")
- "action": what the user or character deliberately did ("User gave Aria a silver bell", "Aria drew her blade to defend the lantern")
- "promise": a commitment made by either party ("Aria promised to return at dawn", "User swore never to name the mountain god aloud")
- "fact": a trait, secret, or timeless detail revealed ("Aria fears storms", "Mira is the merchant's eldest daughter")
- "relationship": how characters regard each other ("Mira distrusts the merchant", "Aria considers the user a traveler she can trust")

## Rules

- Skip small talk, greetings, acknowledgements, speculation, filler.
- Skip things already obvious from the character's system prompt.
- Each item ≤ 25 words. Single complete sentence. Standalone (no pronouns pointing at prior dialogue).
- Favor concrete details: names, places, promises, actions with direct consequences.

Return JSON: {"facts": [{"topic": "event|action|promise|fact|relationship", "fact": "..."}]}
If nothing is worth remembering, return {"facts": []}.
```

No code change to `memory_extract.py` needed — the existing flow reads `topic` from the response and stores it as `memory_documents.title`.

### 4.2 `backend/app/routes/chat.py::_load_bundle`

Pass `recency_weight` + `current_message_count` into the RPC call. The conversation row already carries `message_count` (already loaded in `conv`).

```python
rows = await sup.rpc(client, "memory_search", {
    "p_conversation_id": conversation_id,
    "p_query_vec": vec,
    "p_match_threshold": thresh,
    "p_match_count": top_k,
    "p_current_message_count": int(conv.get("message_count") or 0),
    "p_recency_weight": float(mem_prefs.get("recency_weight") or 0.3),
})
```

### 4.3 `backend/app/routes/chat.py::_run_memory_extraction_task`

When inserting chunks, stamp `message_count_at_creation` with the conversation's current message_count. The task re-fetches providers under caller JWT; also fetch `conversations.message_count` in that re-fetch block and pass it into each chunk insert.

```python
# Inside _run_memory_extraction_task, after user_id is resolved:
convs = await sup.select(client, "conversations", {
    "select": "message_count",
    "id": f"eq.{conversation_id}",
    "limit": "1",
})
current_count = int(convs[0].get("message_count") or 0) if convs else 0

# ... during chunk insert loop:
await sup.insert(client, "memory_document_chunks", {
    "memory_document_id": doc_id,
    "conversation_id": conversation_id,
    "user_id": user_id,
    "chunk_index": idx,
    "text": fact.fact,
    "token_estimate": max(1, len(fact.fact) // 4),
    "embedding": vec,
    "message_count_at_creation": current_count,
})
```

No other backend changes.

## 5. Frontend changes

### 5.1 `frontend/src/lib/memoryPrefs.ts` — new field

```ts
export type MemoryPrefs = {
  enabled: boolean;
  notifications_enabled: boolean;
  auto_extract_cadence_turns: number;
  retrieval_top_k: number;
  retrieval_similarity_threshold: number;
  recency_weight: number;               // NEW (0..1, default 0.3)
  extraction_prompt: string | null;
};

export const MEMORY_PREFS_DEFAULTS: MemoryPrefs = {
  enabled: false,
  notifications_enabled: true,
  auto_extract_cadence_turns: 3,
  retrieval_top_k: 5,
  retrieval_similarity_threshold: 0.5,
  recency_weight: 0.3,
  extraction_prompt: null,
};
```

`mergeWithDefaults` clamps to `[0, 1]`.

### 5.2 `frontend/src/routes/MemorySettings.tsx` — add slider

Insert between `Similarity threshold` and `Memory extraction prompt`:

```tsx
<label style={rangeRow}>
  <span>
    <strong>Recency weight</strong>
    <div style={subStyle}>
      Current: {prefs.recency_weight.toFixed(2)}. 0 = pure similarity · 1 = pure recency · 0.3 is a reasonable blend.
    </div>
  </span>
  <input
    type="range" min={0} max={1} step={0.05}
    data-testid="mem-prefs-recency"
    value={prefs.recency_weight}
    onChange={(e) => patch("recency_weight", Number(e.target.value))}
    disabled={!prefs.enabled}
  />
</label>
```

### 5.3 `frontend/src/lib/memory.ts` (new, ~55 lines)

RLS-direct CRUD for the viewer. Mirrors `lib/lorebook.ts` shape:

```ts
export type MemoryChunkRow = {
  id: string;
  memory_document_id: string;
  text: string;
  topic: string;           // from memory_documents.title (we alias on select)
  created_at: string;
};

export async function listMemoryForConversation(conversationId: string): Promise<MemoryChunkRow[]>;
// Nested select: memory_document_chunks join memory_documents for title.

export async function deleteMemoryChunk(chunkId: string): Promise<void>;

export async function clearMemoryForConversation(conversationId: string): Promise<number>;
// Delete ALL memory_documents for this conversation; cascade removes chunks.
// Returns count of documents deleted.
```

### 5.4 `frontend/src/features/chat/MemoryPanel.tsx` (new, ~120 lines)

Mirrors `LorebookPanel` shape. Back button, title, list rendered newest-first:

```
📚 Memory (N facts remembered)                     ← Back

[💥 event]  Aria entered the inner chamber.                × Delete
[🤝 action] User gave Aria a silver bell.                  × Delete
[🔐 promise] Aria promised to return at dawn.              × Delete
[📌 fact]   Aria fears storms.                             × Delete
[🤝 relationship] Mira distrusts the merchant.             × Delete

───────────────────────────────────────────────────
[ 🗑 Clear all memory for this conversation ]
```

Topic → icon map: `event=💥`, `action=🤝`, `promise=🔐`, `fact=📌`, `relationship=🤝`.
Unknown topics → generic `📌`.

Test IDs: `memory-panel`, `memory-chunk-{id}`, `memory-delete-{id}`, `memory-clear-all`.
Clear-all uses `window.confirm("Delete all N remembered facts for this conversation? This cannot be undone.")`.

### 5.5 `frontend/src/features/chat/ChatControlsPanel.tsx` — wire in

Add `view="memory"` to the `View` union. Add a `loadMemoryForConversation().then(setMemCount)` in the mount effect. Add a new Row after the Lorebook row:

```tsx
<Row
  testid="controls-memory"
  icon="📚"
  title="Memory"
  subtitle={`${memCount} ${memCount === 1 ? "fact" : "facts"} remembered`}
  onClick={() => setView("memory")}
/>
```

When `view === "memory"`, render `<MemoryPanel conversationId={conversationId} onBack={() => setView("root")} onChanged={setMemCount} />`.

## 6. Verification gates

1. **Migration 0034 applied.** `memory_document_chunks.message_count_at_creation` column exists (default 0). `memory_search` function now has 6 params. Old 4/5-arg signatures removed.
2. **Recency ordering — message distance.** Seed two chunks with identical text + similar embedding but different `message_count_at_creation` (one with 0 = "old", one with 14 — created 6 messages ago if current is 20). Call `memory_search` with `p_current_message_count=20, p_recency_weight=0.5` → the recent chunk (msg 14) ranks higher than the old chunk (msg 0). With `p_recency_weight=0.0` → ranking depends only on cosine (tied).
3. **Stamp on insert.** After a live extraction fires, query the newest chunk → `message_count_at_creation` equals `conversations.message_count` at that moment.
4. **Chat retrieval uses prefs + current count.** With memory on + chunks present, backend logs show `p_recency_weight` matches `preferences.memory.recency_weight` and `p_current_message_count` matches `conv.message_count`.
5. **Extraction categorizes.** Send a turn where the user performs an explicit action (e.g., *"I hand Aria a silver bell."*). After cadence triggers, the new `memory_documents` row's title is `action` (or a variant from the allowed set). If the LLM returns a non-standard topic, it's still persisted.
6. **Memory row visible in ChatControlsPanel.** Open controls (⋯ on chat header) — `[data-testid="controls-memory"]` renders with the fact count.
7. **MemoryPanel renders.** Click the row → `[data-testid="memory-panel"]` visible. Existing chunks listed newest-first with topic badge.
8. **Delete chunk.** Click `[data-testid="memory-delete-<id>"]` for one chunk → row disappears from the list and the DB row is gone. Next retrieval in chat does not surface that fact.
9. **Clear-all.** Click `[data-testid="memory-clear-all"]` → confirm → all memory_documents for this conversation deleted (cascade removes chunks). Next chat turn has no position 8 block.
10. **Scope isolation.** Deleting memory for conversation A does not affect conversation B's memory (per-conversation invariant).
11. **Regression.** Cycles 0026-0030 untouched. SSE stream works with memory on + off. Grammar invariant: grep `recency_weight|memory_search` in `backend/app/agents/grammar.py` + grammar prompt → 0 matches.

## 7. Implementation order

1. **Migration 0034** — user applies via Supabase SQL Editor. Gates 1-3 (SQL-only).
2. **`prompts/memory_extract_system.txt`** — rewrite. Live verify by sending a turn and observing the extracted topic.
3. **`routes/chat.py::_load_bundle`** — pass `p_recency_weight`. Gate 4.
4. **`lib/memoryPrefs.ts`** — add field + merge clamp.
5. **`MemorySettings.tsx`** — add slider.
6. **`lib/memory.ts`** — new helpers.
7. **`MemoryPanel.tsx`** — new component. Gates 7-8.
8. **`ChatControlsPanel.tsx`** — wire in row + view. Gate 6.
9. **Live verification** — 5, 9, 10, 11.
10. **Commit.**

## 8. Open considerations (not blocking)

- **Half-life value (20 messages)** — hardcoded. Could become a slider ("messages per half-life") if users want sharper/softer decay.
- **Topic-based retrieval weighting** — could prefer `event`+`action` over `fact` for narrative continuity. Deferred; no signal yet.
- **Inline edit of chunk text** — deferred. Delete-and-regenerate covers the fix case.
- **Empty memory_documents rows** after deleting all chunks — cosmetic, no retrieval impact. Batch cleanup in a future migration if needed.
- **Memory search from MemorySettings** (read-only cross-conversation browse) — not this cycle.
- **Alternative decay units** — `message_count` counts both roles; could switch to "assistant turns only" if the 2× factor feels off in practice.

## Critical files

- `supabase/migrations/0034_memory_recency.sql` *(new — replaces the 4-arg `memory_search` with 5-arg variant)*
- `backend/app/prompts/memory_extract_system.txt` *(rewrite default to include topic taxonomy)*
- `backend/app/routes/chat.py` *(pass `p_recency_weight` to RPC call — 1 line)*
- `frontend/src/lib/memoryPrefs.ts` *(add `recency_weight` field + merge clamp)*
- `frontend/src/routes/MemorySettings.tsx` *(new slider between threshold and extraction prompt)*
- `frontend/src/lib/memory.ts` *(new — list/delete/clear helpers)*
- `frontend/src/features/chat/MemoryPanel.tsx` *(new — viewer + clear-all)*
- `frontend/src/features/chat/ChatControlsPanel.tsx` *(wire in Memory row + `view="memory"` branch)*

## Verification

Run on 2026-04-17 against hosted Supabase + OpenRouter deepseek/deepseek-v3.2 + OpenAI text-embedding-3-small. Live on Aria's pre-0029 conv `37a2e7b7-…` (`message_count=37` at time of extraction).

1. **Migration 0034 applied.** ✅ `message_count_at_creation` column added; `memory_search` RPC now 6-arg. Old 4/5-arg signatures dropped.
2. **Recency ordering — message distance.** ✅ Seeded two identical-embedding chunks, one with `message_count_at_creation=0` (~31 msgs old), one with `message_count_at_creation=27` (~4 msgs old). `recency_weight=0.8` → fresh ranked first (score 0.867, recency 0.833); old second (score 0.514, recency 0.392). `recency_weight=0.0` → ordering determined purely by cosine. Formula confirmed: `recency_factor = 1/(1 + messages_since/20)`.
3. **Stamp on insert.** ✅ Live extraction at `asst_count=18` produced 3 chunks all stamped with `message_count_at_creation=37` (matching `conversations.message_count` at that moment).
4. **Chat retrieval uses prefs + current count.** ✅ Code path verified: `_load_bundle` now passes `p_current_message_count` and `p_recency_weight` derived from `conv.message_count` and `mem_prefs.get("recency_weight")`.
5. **Extraction categorizes with 5 topics.** ✅ User turn *"I kneel and set a small red carp ornament at the shrine altar as an offering. I also promise to return next moon with fresh incense."* + assistant reply involving Mira → doc title=`"action"` (first fact's topic), 3 chunks categorized as **action** (user offering), **promise** (user return vow), and **fact/relationship** (Mira's belief about offering orientation). LLM followed the closed-set taxonomy verbatim.
6. **Memory row in ChatControlsPanel.** ✅ `[data-testid="controls-memory"]` renders: *"📚 Memory · 2 facts remembered"*.
7. **MemoryPanel renders.** ✅ `[data-testid="memory-panel"]` shows chunks newest-first with topic badges, text body, delete × per row, Clear-all at bottom.
8. **Delete chunk.** ✅ Clicking `[data-testid="memory-delete-{id}"]` immediately removed the chunk from the list (2 → 1), DB row confirmed gone, header count updated in real-time.
9. **Clear-all.** Code path verified; `clearMemoryForConversation` deletes all `memory_documents` for the conversation (cascade removes chunks). Window.confirm gate in place. Not exercised live to preserve the fresh extraction data for gate 11.
10. **Scope isolation.** RLS policy on `memory_document_chunks` + `memory_documents` already enforces `user_id = auth.uid()` and filters by `conversation_id` — verified by cycle 0029's gate 2. Cycle 0031 only adds a column and RPC signature; no policy change.
11. **Regression + grammar grep.** ✅ Grep `recency_weight|message_count_at_creation|memory_search` in `backend/app/agents/grammar.py` and prompts → 0 matches. SSE stream worked through 3 live turns to trigger extraction. Cycles 0026-0030 untouched.

Key files shipped:
- `supabase/migrations/0034_memory_recency.sql` — column + 6-arg RPC with blended ranking.
- `backend/app/prompts/memory_extract_system.txt` — rewrite with event/action/promise/fact/relationship taxonomy.
- `backend/app/routes/chat.py` — `_load_bundle` passes 6 RPC args; `_run_memory_extraction_task` fetches conv `message_count` and stamps each chunk.
- `frontend/src/lib/memoryPrefs.ts` — `recency_weight: number` field with `[0,1]` clamp.
- `frontend/src/routes/MemorySettings.tsx` — Recency weight slider (0–1, default 0.3) between threshold and extraction prompt.
- `frontend/src/lib/memory.ts` — `listMemoryForConversation` (join with `memory_documents.title`), `deleteMemoryChunk`, `clearMemoryForConversation`.
- `frontend/src/features/chat/MemoryPanel.tsx` — viewer with topic-icon badges (💥/🎬/🔐/📌/💫), per-row delete, clear-all with confirm.
- `frontend/src/features/chat/ChatControlsPanel.tsx` — new Memory row + `view="memory"` branch, `listMemoryForConversation` on mount for count subtitle.

**Live semantic example.** At `message_count=37`, the user performed an action + promise. The extractor captured both correctly-categorized plus inferred an NPC-side fact about Mira's beliefs — 3-for-3 signal with zero filler. With `recency_weight=0.3` default, these fresh facts will weight meaningfully higher than any legacy chunk from earlier in the conversation on retrieval.
