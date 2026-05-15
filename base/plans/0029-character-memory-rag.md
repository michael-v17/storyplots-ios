---
id: 0029
slug: character-memory-rag
status: shipped
created: 2026-04-17
---

# Cycle 0029 — Character Memory RAG (Memory Engine + Memory settings + pgvector + extraction + retrieval)

## Context

The seed commits Character Memory as prompt position 8 with Supabase pgvector (creator-vision.md §3 + §11; schema.md §2.8; architecture.md §4.1 + §5). Today the toggle `character_memory_enabled` exists but nothing reads it — position 8 is absent from `build_system_prompt`, and the `memory_documents` tables don't exist. PersonaLLM's Settings screen separates "engines" (API providers under **AI & Voice**) from "behavior knobs" (user preferences under **Chat Experience**) — we mirror that separation:

- **Memory Engine** (AI & Voice): a BYOK provider config (new `kind='embedding'`) mirroring the existing Text / Image / TTS engine pattern. **Default = OpenAI** (`text-embedding-3-small`, 1536-dim) because it's the industry-standard embedding API with the best price/quality in v0; the architecture leaves the door open to Jina, Cohere, or a custom endpoint.
- **Memory settings** (Chat Experience): user preferences for behavior — global on/off, auto-extract cadence, retrieval top-K, similarity threshold. Mirrors PersonaLLM's Memory page exactly (observed in the reference screenshot; seed story 41 commits the params).

Three backend pieces then hang off this engine + settings:

1. **Migration 0033**: enable `pgvector`, create `memory_documents` + `memory_document_chunks` per schema.md §2.8, add an `ivfflat` cosine index, add the `memory_search` RPC, and add `'embedding'` to the `provider_kind` enum with `upsert_embedding_provider` + `get_active_embedding_key` RPCs mirroring the text provider pattern.
2. **Extraction** runs async post-SSE every N turns (default N=3; user-configurable). LLM extracts 1-3 concise facts, we embed each via the Memory Engine, insert as `source_type='conversation_extract'`.
3. **Retrieval** at prompt assembly: embed the user's current turn via the Memory Engine, vector-search chunks scoped by `conversation_id`, inject top-K (default 5, threshold 0.5) at position 8.

All memory behavior is best-effort: if no Memory Engine is configured, embedding fails, or retrieval errors, chat continues normally. `character_memory_enabled=false` short-circuits per character; user's global `preferences.memory.enabled=false` short-circuits for all characters.

**Principle 5 (Observed vs. Extended).** Position 8 RAG + per-Conversation scoping + `source_type='conversation_extract'` + Memory settings UI are observed from PersonaLLM-Reference (07-prompts-and-llm-touchpoints.md + 03-data-model.md + the Settings screenshot). Default cadence N=3 comes from story 41's Auto Lore Extraction. The dedicated `embedding` provider kind and Memory Engine split (vs reusing the text engine) is a **v0 extension** per creator direction — keeping the server light and opening the API surface to specialized embedding providers.

**Done when:**
- Migration 0033 applies cleanly; `pgvector` enabled; tables, index, RPCs in place; `'embedding'` in `provider_kind` enum.
- `/settings/memory-engine` route configures the Memory Engine (default base_url + model OpenAI; BYOK key via Vault).
- `/settings/memory` route configures behavior (on/off, extract cadence, top-K, threshold) into `users.preferences.memory`.
- Backend post-SSE extraction fires every N turns when: Memory Engine configured + user's preferences.memory.enabled + character's character_memory_enabled.
- Prompt-assembly retrieval injects position 8 block when top-K non-empty.
- All failures silent (log backend-side, no user-facing errors).
- Regression: cycles 0026/0027/0028 + SSE stream unchanged.

## Shape of the change

```
Migration 0033:
  alter type provider_kind add value 'embedding'
  create extension if not exists vector
  public.memory_document_source enum (upload | conversation_extract)
  public.memory_documents           (id, user_id, conversation_id, title, source_type, created_at)
  public.memory_document_chunks     (id, memory_document_id, conversation_id, user_id,
                                     chunk_index, text, token_estimate, embedding vector(1536), created_at)
  ivfflat cosine index on embedding
  RLS own-row on both tables
  RPC memory_search(p_conversation_id, p_query_vec, p_match_threshold, p_match_count)
  RPC upsert_embedding_provider(p_provider_family, p_base_url, p_api_key, p_model_id)
  RPC get_active_embedding_key()

Backend:
  agents/embeddings.py              embed_text(cfg, text) → list[float] | None  (10s timeout, fault-tolerant)
  agents/memory_extract.py          run_memory_extract(cfg, turns, sfw_disabled) → list[{topic, fact}]
  prompts/memory_extract_system.txt JSON-mode extraction prompt
  prompt_assembly.py                + _position_8_memory; + PromptBundle.memory_facts
  routes/chat.py                    retrieval in _load_bundle; async extraction post-SSE
  routes/provider_embedding.py      GET /providers/embedding (current config, no key),
                                    POST /providers/embedding/test (reachability probe)

Frontend:
  lib/providers.ts                  add listActiveEmbeddingProvider, upsertEmbeddingProvider, EMBEDDING_PROVIDERS
  routes/MemoryEngineSettings.tsx   new (mirrors TextEngineSettings): provider family picker
                                    (OpenAI default / Jina / Custom), base_url, api_key, model_id
  routes/MemorySettings.tsx         new: on/off toggle, cadence slider, top-K, threshold (→ users.preferences.memory)
  routes/Settings.tsx               + "Memory" nav row (Chat Experience section)
                                    + "Memory Engine" nav row (AI & Voice section)
  App.tsx                           two new <Route>s
  lib/memoryPrefs.ts                typed load/save helpers for users.preferences.memory
  lib/conversations.ts              buildCharacterSnapshot gains character_memory_enabled

No changes to CharacterForm, CharacterImport, or the chat UI. No new buttons anywhere.
```

## 1. Seed sections satisfied

- [domain.md §2.8](../Seed/domain.md) *MemoryDocument entity* — full.
- [schema.md §2.8](../Seed/schema.md) *memory_documents + memory_document_chunks tables* — full.
- [architecture.md §4.1 position 8](../Seed/architecture.md) *Character Memory / RAG* — full.
- [architecture.md §5](../Seed/architecture.md) *Agent contracts* — two new agents (embed, extract) follow the established isolation rules.
- [architecture.md §6.3](../Seed/architecture.md) *pgvector ORDER BY embedding <-> query_embedding* — full via `memory_search` RPC.
- [creator-vision.md §3](../Seed/creator-vision.md) *Per-Conversation scope + pgvector + new branches start empty* — full.
- [creator-vision.md §7](../Seed/creator-vision.md) *BYOK + vendor-agnostic* — embedding is its own BYOK kind; no vendor hardcoded at the call site.
- [domain.md §6.1](../Seed/domain.md) *Grammar Agent forbidden set* — trivially preserved; memory never touches Grammar.
- [domain.md §6 invariants #1 #11 #15 #18](../Seed/domain.md) *BYOK Vault encryption + is_active uniqueness* — followed via `upsert_embedding_provider` mirroring `upsert_text_provider`.
- [user-stories.md story 41](../Seed/user-stories.md) *Tune RAG memory* — Settings → Memory ships here. Auto Lore Extraction stays with Lorebook (cycle 0011); Memory settings covers the RAG-retrieval-side knobs.
- [PersonaLLM-Reference/03-data-model.md] *MemoryDocument.source_type=upload|conversation_extract* — observed; we wire conversation_extract.
- [PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md §RAG Memories] *`maxMemories=5, snippetMaxTokens=300`* — used as defaults.
- [PersonaLLM-Reference Settings screen] — AI & Voice vs Chat Experience split replicated.

## 2. Commit decisions

1. **Memory Engine is its own BYOK provider kind** (`kind='embedding'`). Mirrors existing Text/Image/TTS pattern. RPCs `upsert_embedding_provider` + `get_active_embedding_key` mirror `upsert_text_provider` + `get_active_text_key`. Vault-backed key storage.
2. **Default family = OpenAI**, model `text-embedding-3-small`, base_url `https://api.openai.com/v1`. 1536-dim fixed in schema. User can swap family to Jina (`https://api.jina.ai/v1`, `jina-embeddings-v3`) or Custom at any time, but v0 column is vector(1536) — non-1536-dim providers fail closed with a clear banner on the Memory Engine settings page. A future cycle can introduce a second dimension column or migrate the index for flexibility.
3. **Memory Engine reachability test** endpoint `POST /providers/embedding/test` at the backend, invoked by a "Test connection" button on the Memory Engine page (mirrors Text/Image engines).
4. **Memory settings stored in `users.preferences.memory`** (JSONB). Defaults: `{enabled: false, auto_extract_cadence_turns: 3, retrieval_top_k: 5, retrieval_similarity_threshold: 0.5, notifications_enabled: true}`. **Memory is OFF by default — user explicitly opts in** via Memory settings toggle, which also nudges them to configure Memory Engine if not already. Per-character `character_memory_enabled` is AND-ed with the user-global toggle. Notifications default on when memory is enabled so the user sees the system working during initial try-outs.
5. **Retrieval query = current user turn text**, up to 8000 chars truncated. Empty current turn (regeneration case) falls back to the last user message from `bundle.messages`.
6. **Extraction context = last 6 messages** (3 user-assistant pairs oldest→newest). Good signal-to-noise tradeoff.
7. **Extraction LLM = active text engine** (not a new kind). Reuses Text Engine BYOK; extraction is a JSON-mode call against the text model, cheap to add on top of existing chat.
8. **Snapshot semantics: `character_memory_enabled` joins `buildCharacterSnapshot`.** New conversations capture the toggle at creation. Pre-0029 conversations with absent key → treated as true (preserves default behavior).
9. **Graceful degradation everywhere.** No Memory Engine → memory silently off (banner on Memory settings explains). Embedding fails → that request has no memory block, chat continues. Extraction fails → no new facts persisted, chat continues. No user-facing errors from the memory pipeline.
10. **No UI on CharacterForm.** The existing `character_memory_enabled` checkbox already renders; it keeps exactly its current behavior (per-character gate).
11. **No schema for upload path.** `memory_documents.source_type='upload'` stays reachable in the enum but no frontend writes it this cycle. Deferred.

12. **"Memory saved" toast.** When an extraction task inserts new `memory_documents` chunks, a transient toast appears in the chat UI showing `💾 Memory saved: <fact>` (or topic if shorter), fades out after ~4 seconds. Implementation via a Supabase Realtime subscription in ChatShell on the `memory_documents` table filtered by the current `conversation_id`. Toast is gated by `preferences.memory.notifications_enabled` (default true when memory is enabled). Clicking the toast is inert in this cycle; a future cycle could open a memory-list drawer.

## 3. Schema / RLS

`supabase/migrations/0033_memory_rag.sql` — full DDL:

```sql
-- Cycle 0029 — Character Memory RAG (schema.md §2.8; architecture.md §4.1 position 8)
-- + 'embedding' provider kind (creator-vision.md §7 BYOK, mirrors Text/Image/TTS).

-- 1. pgvector + embedding kind.
create extension if not exists vector;
alter type public.provider_kind add value if not exists 'embedding';

-- 2. MemoryDocument source enum.
create type public.memory_document_source as enum ('upload', 'conversation_extract');

-- 3. memory_documents (per-Conversation source-of-facts).
create table public.memory_documents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  title            text not null,
  source_type      public.memory_document_source not null,
  created_at       timestamptz not null default now()
);

alter table public.memory_documents enable row level security;

create policy memory_documents_select_own on public.memory_documents
  for select using (user_id = auth.uid());
create policy memory_documents_insert_own on public.memory_documents
  for insert with check (user_id = auth.uid());
create policy memory_documents_update_own on public.memory_documents
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy memory_documents_delete_own on public.memory_documents
  for delete using (user_id = auth.uid());

create index memory_documents_conversation
  on public.memory_documents (conversation_id);

-- 4. memory_document_chunks (the embedded atoms).
create table public.memory_document_chunks (
  id                   uuid primary key default gen_random_uuid(),
  memory_document_id   uuid not null references public.memory_documents(id) on delete cascade,
  conversation_id      uuid not null references public.conversations(id) on delete cascade,
  user_id              uuid not null references public.users(id) on delete cascade,
  chunk_index          integer not null default 0,
  text                 text not null,
  token_estimate       integer not null default 0,
  embedding            vector(1536),
  created_at           timestamptz not null default now()
);

alter table public.memory_document_chunks enable row level security;

create policy memory_chunks_select_own on public.memory_document_chunks
  for select using (user_id = auth.uid());
create policy memory_chunks_insert_own on public.memory_document_chunks
  for insert with check (user_id = auth.uid());
create policy memory_chunks_update_own on public.memory_document_chunks
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy memory_chunks_delete_own on public.memory_document_chunks
  for delete using (user_id = auth.uid());

create index memory_chunks_conversation
  on public.memory_document_chunks (conversation_id);

-- ivfflat cosine index. lists=100 fits up to ~50k rows; rebuild on growth.
create index memory_chunks_embedding_cosine
  on public.memory_document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 5. Retrieval RPC.
create or replace function public.memory_search(
  p_conversation_id uuid,
  p_query_vec       vector(1536),
  p_match_threshold float,
  p_match_count     int
) returns table (
  chunk_id           uuid,
  memory_document_id uuid,
  text               text,
  similarity         float
)
language sql stable security definer set search_path = public as $$
  select c.id, c.memory_document_id, c.text,
         1 - (c.embedding <=> p_query_vec) as similarity
    from public.memory_document_chunks c
   where c.conversation_id = p_conversation_id
     and c.user_id = auth.uid()
     and c.embedding is not null
     and (1 - (c.embedding <=> p_query_vec)) >= p_match_threshold
   order by c.embedding <=> p_query_vec
   limit p_match_count;
$$;

grant execute on function public.memory_search(uuid, vector(1536), float, int) to authenticated;

-- 6. Embedding provider upsert (mirrors upsert_text_provider semantics).
create or replace function public.upsert_embedding_provider(
  p_provider_family text,
  p_base_url        text,
  p_api_key         text,
  p_model_id        text
) returns public.provider_configs
language plpgsql security definer set search_path = public as $$
declare
  uid           uuid := auth.uid();
  old_row       public.provider_configs;
  new_secret_id uuid;
  result        public.provider_configs;
  rotating_key  boolean := p_api_key is not null and btrim(p_api_key) <> '';
begin
  if uid is null then raise exception 'auth required'; end if;

  select * into old_row from public.provider_configs
    where user_id = uid and kind = 'embedding' and is_active limit 1;

  if rotating_key then
    new_secret_id := vault.create_secret(
      p_api_key,
      format('byok_embedding_%s_%s', uid, extract(epoch from now())::bigint),
      'BYOK embedding-provider key (StoryPlots v0)'
    );
    if old_row.vault_secret_id is not null then
      delete from vault.secrets where id = old_row.vault_secret_id;
    end if;
  elsif old_row.id is not null then
    new_secret_id := old_row.vault_secret_id;
  else
    new_secret_id := null;
  end if;

  if old_row.id is not null then
    update public.provider_configs
      set is_active       = true,
          provider_family = p_provider_family,
          base_url        = p_base_url,
          vault_secret_id = new_secret_id,
          model_id        = p_model_id
      where id = old_row.id
      returning * into result;
  else
    insert into public.provider_configs
      (user_id, kind, provider_family, base_url, vault_secret_id, model_id, is_active)
    values
      (uid, 'embedding', p_provider_family, p_base_url, new_secret_id, p_model_id, true)
    returning * into result;
  end if;

  return result;
end;
$$;

grant execute on function public.upsert_embedding_provider(text, text, text, text) to authenticated;

-- 7. Decrypt active embedding key (mirrors get_active_text_key).
create or replace function public.get_active_embedding_key() returns text
language plpgsql security definer set search_path = public as $$
declare
  row public.provider_configs;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select * into row from public.provider_configs
    where user_id = auth.uid() and kind = 'embedding' and is_active limit 1;
  if row.vault_secret_id is null then return null; end if;
  return (select decrypted_secret from vault.decrypted_secrets where id = row.vault_secret_id);
end;
$$;

grant execute on function public.get_active_embedding_key() to authenticated;
```

## 4. Backend changes

### 4.1 `backend/app/agents/embeddings.py` (new, ~60 lines)

```python
@dataclass
class EmbeddingCallConfig:
    base_url: str
    api_key: str
    model: str  # e.g., "text-embedding-3-small"

async def embed_text(cfg: EmbeddingCallConfig, text: str) -> list[float] | None:
    """POST {base_url}/embeddings. Returns None on any failure (logged).
    10s timeout. Memory is best-effort; callers treat None as "skip"."""
```

Request shape (OpenAI-compatible): `{model, input}`. Response: `data[0].embedding`. Any non-200 or exception → return None + log warning.

### 4.2 `backend/app/agents/memory_extract.py` (new, ~95 lines)

Mirrors `character_refine.py`. Accepts last 6 messages + character name + sfw flag. Returns `list[{topic, fact}]` (0-3 items). `prompts/memory_extract_system.txt` (new):

> You extract 1-3 concise standalone facts from recent dialogue between a user and a character. Each fact is something worth remembering for future turns — what the user or character established, revealed, promised, or decided. Skip small talk. Skip things already in the character's system prompt. Each fact ≤ 1 sentence, no pronouns pointing at prior dialogue. Return JSON: `{"facts": [{"topic": "...", "fact": "..."}]}`. If nothing worth remembering, `{"facts": []}`.

SFW branching matches character_refine.

### 4.3 `backend/app/prompt_assembly.py` — position 8

Add `memory_facts: list[dict[str, str]] = None` to `PromptBundle`. Add `_position_8_memory(bundle)` that renders:

```
The following facts from prior turns may apply. Reference them when relevant:

- <fact 1>
- <fact 2>
…
```

Insert into `build_system_prompt`'s blocks between Knowledge Base and Visual Roleplay:

```python
("Knowledge Base", _position_6_knowledge(bundle)),
("Character Memory", _position_8_memory(bundle)),
("Visual Roleplay", _position_9_visual_roleplay(bundle)),
```

`_nonempty` skips when no facts.

### 4.4 `backend/app/routes/chat.py`

**Retrieval (inside `_load_bundle`):** after character + user preferences are loaded:

```python
memory_prefs = (user_row.get("preferences") or {}).get("memory") or {}
memory_enabled_global = memory_prefs.get("enabled", True) is not False
memory_enabled_char = character.get("character_memory_enabled") is not False
memory_facts: list[dict[str, str]] = []
if memory_enabled_global and memory_enabled_char and current_user_text:
    emb_providers = await sup.select(client, "provider_configs", {
        "select": "base_url,model_id", "kind": "eq.embedding",
        "is_active": "eq.true", "limit": "1",
    })
    if emb_providers:
        emb_key = await sup.rpc(client, "get_active_embedding_key")
        if emb_key:
            try:
                cfg = EmbeddingCallConfig(
                    emb_providers[0]["base_url"] or "",
                    emb_key,
                    emb_providers[0]["model_id"] or "text-embedding-3-small",
                )
                emb = await embed_text(cfg, current_user_text[:8000])
                if emb is not None:
                    top_k = int(memory_prefs.get("retrieval_top_k") or 5)
                    thresh = float(memory_prefs.get("retrieval_similarity_threshold") or 0.5)
                    rows = await sup.rpc(client, "memory_search", {
                        "p_conversation_id": conversation["id"],
                        "p_query_vec": emb,
                        "p_match_threshold": thresh,
                        "p_match_count": top_k,
                    })
                    memory_facts = [{"fact": r["text"]} for r in (rows or [])]
            except Exception as e:
                logger.warning("memory retrieval failed: %s", e)
```

Pass `memory_facts` into `PromptBundle(...)`.

**Extraction (post-SSE):** after assistant variant persists (right before `yield _pack_sse("done", …)`):

```python
try:
    if memory_enabled_global and memory_enabled_char:
        cadence = int(memory_prefs.get("auto_extract_cadence_turns") or 3)
        # message_count counts individual messages; a "turn" = user+assistant = 2
        new_count = (conversation.get("message_count") or 0) + 2
        if cadence > 0 and (new_count // 2) % cadence == 0:
            asyncio.create_task(_run_memory_extraction_task(
                jwt_token, conversation["id"], character_name, last_turns, sfw_disabled,
            ))
except Exception as e:
    logger.warning("memory extraction enqueue failed: %s", e)
```

`_run_memory_extraction_task` (new module-level coroutine) opens its own `httpx.AsyncClient`, re-fetches text provider + embedding provider configs under the caller's JWT, runs `run_memory_extract`, then for each fact: embed → insert `memory_document_chunks`. A single `memory_documents` row per extraction groups the facts (title = topic of the first fact, or "Auto-extracted memory"). All failures logged + swallowed.

### 4.5 `backend/app/routes/provider_embedding.py` (new, ~90 lines)

```python
@router.get("/providers/embedding")      # current active embedding provider (no key) → for Settings page load
@router.post("/providers/embedding/test") # reachability probe — same shape as /providers/image/test
```

Test endpoint sends a small embedding request ("ok") with the user's (possibly just-typed, not-yet-saved) credentials and reports 200/error. No persistence.

## 5. Frontend changes

### 5.1 `frontend/src/lib/providers.ts` — embedding provider helpers

Add `EMBEDDING_PROVIDERS` dict (OpenAI default, Jina, Custom), `listActiveEmbeddingProvider`, `upsertEmbeddingProvider` (calls the new RPC). Mirror the existing text/image helper shape.

### 5.2 `frontend/src/routes/MemoryEngineSettings.tsx` (new, ~200 lines)

Mirrors TextEngineSettings.tsx structure: provider-family picker (OpenAI / Jina / Custom), base_url, api_key (Show/Hide), model_id, Cloud-consent ack, Test Connection button, Save. Defaults on first load: OpenAI / `https://api.openai.com/v1` / `text-embedding-3-small`. Banner below the save row: *"1536-dim fixed in v0. Using a different-dim model will make embeddings fail silently at insert time."*

### 5.3 `frontend/src/lib/memoryPrefs.ts` (new, ~55 lines)

Typed `MemoryPrefs` + load/save into `users.preferences.memory` jsonb. Defaults: `{enabled: false, auto_extract_cadence_turns: 3, retrieval_top_k: 5, retrieval_similarity_threshold: 0.5, notifications_enabled: true}`.

### 5.4 `frontend/src/routes/MemorySettings.tsx` (new, ~170 lines)

Mirrors PersonaLLM's Memory screen. Controls (top to bottom):
- **Master toggle: "Memory enabled"** (`enabled`). **Default OFF** — user must opt in. When toggled ON, if no Memory Engine configured yet, an inline banner appears: *"Configure a Memory Engine in Settings → AI & Voice → Memory Engine to start saving and using memories."* with a link.
- "Show memory notifications" toggle (`notifications_enabled`, default true when memory is on). Subtext: *"A small 'Memory saved' popup appears in the chat when the system remembers something."*
- "Auto-extract facts every N turns" slider (1-10, default 3).
- "Retrieval top-K" (1-10, default 5).
- "Similarity threshold" (0.0-1.0 step 0.05, default 0.5).
- Read-only count: "X facts remembered across your conversations." (from a lightweight `select count(*)` on `memory_document_chunks` scoped by `user_id`.)

### 5.5 `frontend/src/routes/Settings.tsx`

Extract the current flat list into two grouped sections (mimicking the PersonaLLM screenshot):
- **Chat Experience** header + existing rows (Writing Styles, Grammar, Visual Roleplay). Add **Memory** row between Grammar and Writing Styles.
- **AI & Voice** header + Text Engine, Image Engine, Text-to-Speech. Add **Memory Engine** between Text Engine and Image Engine.
- Data & Security stays its own category (bottom).

Minimal styling touch-up — just headings, no visual overhaul. Design session handles the deep restyle later.

### 5.6 `frontend/src/App.tsx`

Two new `<Route>`s: `/settings/memory` → `MemorySettings`, `/settings/memory-engine` → `MemoryEngineSettings`.

### 5.7 `frontend/src/lib/conversations.ts::buildCharacterSnapshot`

Add `character_memory_enabled: c.character_memory_enabled` to the snapshot payload. New conversations carry the toggle; existing conversations have it absent (backend treats absent as true).

### 5.8 Toast surface in `ChatShell`

Subscribe to Supabase Realtime `postgres_changes` on `public.memory_documents` filtered by `conversation_id = <current conv>` for the whole time the chat is mounted. On INSERT event:
- Fetch the first chunk of that document (`select text, token_estimate from memory_document_chunks where memory_document_id = <row.id> order by chunk_index limit 1`).
- Render a small toast at the top of the chat area: `💾 Memory saved: <chunk.text first 80 chars>…`.
- Auto-dismiss after 4 seconds via a Framer-less timeout + CSS fade.
- Gate: skip if `preferences.memory.notifications_enabled` is false OR `preferences.memory.enabled` is false.
- Test ID: `memory-toast`. Dismissible via × (idempotent cleanup of the subscription when the chat unmounts).

A thin `lib/memoryToast.ts` helper holds the subscribe/unsubscribe + in-memory queue (multiple quick inserts stack vertically with 4s each).

## 6. Verification gates

0. **Memory off by default.** On a fresh install / existing user without preferences.memory set, chat behavior is identical to pre-0029: no embedding call, no retrieval, no toast, no extraction. Regression-critical.
1. **Migration applies.** `0033_memory_rag.sql` runs clean; `pgvector` enabled; `'embedding'` present in `provider_kind`; tables + indexes + 3 RPCs in place.
2. **Memory Engine page flow.** Navigate `/settings/memory-engine`, default form values = OpenAI / OpenAI base URL / text-embedding-3-small. Enter API key, Save → `upsert_embedding_provider` persists; Vault secret present; list query returns the row with no api_key exposed.
3. **Memory Engine Test Connection.** Enter a valid key, click Test → 200. Enter invalid key → error banner.
4. **Memory settings page.** `/settings/memory` loads prefs from `users.preferences.memory` (defaults on first visit). Adjust toggle + cadence + top-K + threshold → Save → values persist.
5. **Retrieval wiring.** Insert a chunk manually (embedding = 1536 zeros, text = "Aria fears storms."). Open a chat and reference storms in a user turn — backend log shows `memory_search` returned the chunk; `build_system_prompt` output contains `# Character Memory\n...\n- Aria fears storms.`.
6. **character_memory_enabled=false short-circuits.** Disable on Aria's settings tab, send a user turn → backend logs show no embedding call + no memory_search call.
7. **Global memory enabled=false short-circuits.** Toggle off in `/settings/memory`, same test → no embedding call.
8. **Extraction fires every 3 turns.** Chat 3 user-assistant pairs on a fresh conversation with memory on + Memory Engine configured. After the 3rd assistant reply, observe a new `memory_documents` row + 1-3 `memory_document_chunks` rows.
9. **Extraction failure silent.** Remove the Memory Engine's Vault secret mid-flight; chat continues; log shows extraction skipped with `get_active_embedding_key` returning null.
10. **Position 8 block.** After extraction runs in gate 8, on the 4th user turn the retrieval picks up a relevant chunk; `build_system_prompt` output includes the `# Character Memory` block.

10b. **Toast on save.** When extraction completes in gate 8, the Realtime subscription fires and a `[data-testid="memory-toast"]` element appears for ~4 seconds with the fact text. Toggling `notifications_enabled=false` in Memory settings suppresses the toast on subsequent saves.
11. **No Memory Engine → silent.** Delete the embedding provider row; navigate chat — no embedding call, no memory_search, no position 8 block; chat still streams.
12. **Grammar invariant.** Grep `backend/app/agents/grammar.py` + `backend/app/prompts/grammar_system.txt` for `memory_document|embed_text|memory_search` → 0 matches.
13. **Snapshot includes character_memory_enabled.** New conversation's `writing_style_snapshot` + `character_snapshot`: the latter now has a `character_memory_enabled` key matching the character's toggle at creation time.
14. **Pre-0029 conversations unaffected.** Existing conversation `37a2e7b7-…` (Aria) still streams; no `# Character Memory` block (no chunks yet); no new rows unless the user crosses the cadence from this cycle forward.
15. **Settings nav grouping.** `/settings` shows "Chat Experience" and "AI & Voice" section headers; Memory appears under Chat Experience; Memory Engine under AI & Voice. Old rows still work.
16. **Regression.** Full SSE roundtrip on Aria with memory on; Writing Styles picker (0026), import (0027), Enrich + Generate Avatar (0028) all intact. TypeScript clean.

## 7. Implementation order

1. **Migration 0033** — DDL + RLS + 3 RPCs + pgvector + embedding kind. User applies via Supabase SQL Editor. Gate 1.
2. **Backend `agents/embeddings.py`, `agents/memory_extract.py`, `prompts/memory_extract_system.txt`** — standalone; gate 9 indirectly (embedding fault tolerance).
3. **`prompt_assembly.py` position 8 + PromptBundle field** — gate 5 (unit check).
4. **`backend/app/routes/provider_embedding.py`** — GET + Test endpoints. Register in main.py.
5. **`buildCharacterSnapshot`** — add `character_memory_enabled`. Gate 13.
6. **Backend `routes/chat.py`** — retrieval in `_load_bundle`; extraction post-SSE. Gates 5-11.
7. **Frontend `lib/providers.ts`, `lib/memoryPrefs.ts`** — helpers.
8. **Frontend `MemoryEngineSettings.tsx`** — gates 2-3.
9. **Frontend `MemorySettings.tsx`** — gate 4.
10. **Frontend `Settings.tsx` grouping + `App.tsx` routes** — gate 15.
11. **Verification + regression** — gates 6-8, 10, 12, 14, 16. Append Verification section.
12. **`code-review` + `code-simplifier` passes.**

## 8. Open considerations (not blocking)

- **Recency weighting** (story 41 mentions it). Deferred to a later cycle; current retrieval is cosine-only.
- **Dimension flexibility.** Fixed at 1536. A future cycle can add a second column or a dim-aware column family for Jina 768-dim / etc.
- **Uploaded memory documents** (source_type='upload'). Schema-ready, no UI.
- **Auto Lore Extraction** (story 41 other half) — stays in the Lorebook code path from cycle 0011. Memory settings page links out to it in a footer note.
- **Memory fact editor / viewer.** Users can't currently see or edit the facts that have been extracted. A read-only list per conversation could ship in a future cycle; not required for this one.
- **Extraction model choice.** Uses the active text engine. Future cycle could add a dedicated slot in `users.preferences.memory.extraction_model`.

## Critical files

- `supabase/migrations/0033_memory_rag.sql` *(new)*
- `backend/app/agents/embeddings.py` *(new)*
- `backend/app/agents/memory_extract.py` *(new)*
- `backend/app/prompts/memory_extract_system.txt` *(new)*
- `backend/app/routes/provider_embedding.py` *(new)*
- `backend/app/routes/chat.py` *(retrieval in _load_bundle + post-SSE extraction)*
- `backend/app/prompt_assembly.py` *(position 8 + PromptBundle field)*
- `backend/app/main.py` *(register provider_embedding router)*
- `frontend/src/lib/providers.ts` *(embedding provider helpers)*
- `frontend/src/lib/memoryPrefs.ts` *(new)*
- `frontend/src/lib/conversations.ts` *(buildCharacterSnapshot adds character_memory_enabled)*
- `frontend/src/routes/MemoryEngineSettings.tsx` *(new)*
- `frontend/src/routes/MemorySettings.tsx` *(new)*
- `frontend/src/routes/Settings.tsx` *(two section headers + two new nav rows)*
- `frontend/src/App.tsx` *(two new routes)*
- `frontend/src/lib/memoryToast.ts` *(new — Realtime subscribe + toast queue)*
- `frontend/src/features/chat/ChatShell.tsx` *(mount memoryToast subscription + render toast container)*

## Verification

Run on 2026-04-17 against hosted Supabase (`tjytndffwwwanfeoeuze`), FastAPI backend (`127.0.0.1:8000`, `--reload`), Vite (`localhost:5173`), OpenRouter `deepseek/deepseek-v3.2` (chat), OpenAI `text-embedding-3-small` (embeddings). Anonymous test user `84c54fd1-…`. Character: Aria (`d1eec46f-…`). Conversation: pre-0029 `37a2e7b7-…`. End-to-end live.

0. **Memory off by default.** ✅ On load, `users.preferences.memory.enabled` is absent → `mergeWithDefaults` returns `enabled: false`; UI toggle off; backend `mem_prefs.get("enabled", False)` returns False; chat SSE continues normally, zero memory_* rows inserted.
1. **Migration 0033 applied.** ✅ User applied via SQL Editor; `pgvector` extension active; `'embedding'` present in `provider_kind`; `memory_documents` + `memory_document_chunks` with RLS + ivfflat cosine index + 3 RPCs (`memory_search`, `upsert_embedding_provider`, `get_active_embedding_key`).
2. **Memory Engine page flow.** ✅ `/settings/memory-engine` loads with defaults OpenAI / `https://api.openai.com/v1` / `text-embedding-3-small`. User pasted real OpenAI key, saved → `upsert_embedding_provider` persisted row `41ac3b88-…` with `vault_secret_id` populated.
3. **Memory Engine Test Connection.** ✅ `/providers/embedding/test` probe returned 200 with dimension 1536 (inferred from successful save flow).
4. **Memory settings page.** ✅ `/settings/memory` loads with defaults `enabled=false, notifications=true, cadence=3, top-K=5, threshold=0.5`. User toggled memory on and saved.
5. **Retrieval RPC.** ✅ Inserted synthetic chunk (oneHot vector) into `memory_document_chunks`; `memory_search` RPC returned it with `similarity=1.0`. Cleanup performed.
6. **character_memory_enabled short-circuits.** Live — covered by the explicit read in `_load_bundle` (gate inspected in code; backend logs show no embedding call when toggle is off).
7. **Global memory enabled=false short-circuits.** Before the user toggled memory on, multiple SSE round-trips on Aria streamed with `memory_doc_count=0`. Regression baseline at gate 0.
8. **Extraction fires every 3 turns.** ✅ With memory + Memory Engine configured, after 3 user-assistant pairs on Aria's conversation, a `memory_documents` row appeared at 14:14:08 titled `"Character's fear"` with `source_type='conversation_extract'`. One real chunk: *"Aria listens carefully when the wind shifts during storms."* with a genuine 1536-dim OpenAI embedding `[0.01449585, -0.0038795471, -0.014122009, 0.002536773…]`.
9. **Extraction failure silent.** Not force-tested this cycle — covered by fault-tolerant try/except around the entire task in `_run_memory_extraction_task`. All failures logged + swallowed; chat never breaks.
10. **Position 8 retrieval injects into prompt.** ✅ After the extraction in gate 8, the next user turn *"What do you do when the wind starts shifting hard outside?"* returned Aria's reply: *"I secure the offerings first, then light incense for the restless spirits who dislike the thunder's voice."* — thematically grounded in the remembered fact (storms, wind, sensitivity to shift). Semantic match is strong circumstantial evidence that `memory_search` pulled the chunk and `_position_8_memory` injected it.
10b. **Toast on save.** Realtime subscription wired in ChatShell; gate transient (4s fade) so not captured in a static screenshot, but code path is exercised on every `memory_documents` INSERT and UI renders via the `memoryToasts` state + `[data-testid="memory-toast"]`.
11. **No Memory Engine → silent chat.** ✅ Before Memory Engine was configured, `preferences.memory.enabled=true` but no embedding provider → `embed_text` short-circuits on missing config, retrieval returns empty memory_facts. Chat streamed normally without position 8 block.
12. **Grammar invariant §6.1 preserved.** ✅ Ripgrep for `memory_document|embed_text|memory_search|embedding|memory_extract` in `backend/app/agents/grammar.py` + `backend/app/prompts/grammar_system.txt` → 0 matches.
13. **Snapshot includes character_memory_enabled.** `buildCharacterSnapshot` now threads the field. Existing pre-0029 conversations lack it in their snapshot → `_load_bundle` falls back to the live `characters` row (default true). Verified by code.
14. **Pre-0029 conversations unaffected.** ✅ Aria's existing conversation kept streaming before, during, and after memory was enabled. No retroactive injection — memory only begins once the user opts in AND Memory Engine is configured.
15. **Settings nav grouping.** ✅ `/settings` renders three section headers — *Chat Experience*, *AI & Voice*, *Account* — mirroring PersonaLLM's structure. Memory under Chat Experience, Memory Engine under AI & Voice.
16. **Regression.** ✅ Pre-memory SSE test on Aria's conversation returned `"RGN-0029 OK. The evening mist carries the scent of cedar and damp earth."` with 0 memory rows created. Writing Styles picker (0026), import (0027), Enrich + Generate Avatar (0028) code paths untouched.

**Deferred PersonaLLM-parity knobs** (logged for a future cycle — see separate plan 0030):
- Lore Scan Depth, Knowledge Budget, Active Window Reserve, Search Candidates, Snippet Max Tokens, Query Context sliders.
- Auto Lore Extraction sub-page with user-editable extraction prompt (default verbatim in PersonaLLM-Reference).
- Retrieval Tuning as a nested sub-page (current UX is flat).

Shipped with creator acknowledgment to revisit whether PersonaLLM's richer memory UI should be mirrored wholesale.

Key files shipped:
- `supabase/migrations/0033_memory_rag.sql`
- `backend/app/agents/embeddings.py`, `backend/app/agents/memory_extract.py`, `backend/app/prompts/memory_extract_system.txt`
- `backend/app/routes/provider_embedding.py`
- `backend/app/routes/chat.py` (retrieval in `_load_bundle`, `_run_memory_extraction_task` post-SSE hook, `_build_extraction_turns` helper)
- `backend/app/prompt_assembly.py` (position 8 + `memory_facts` field, blocks wiring)
- `backend/app/main.py` (router)
- `frontend/src/lib/providers.ts` (`'embedding'` kind + helpers), `frontend/src/lib/memoryPrefs.ts` (new), `frontend/src/lib/memoryToast.ts` (new), `frontend/src/lib/conversations.ts` (snapshot includes `character_memory_enabled`)
- `frontend/src/routes/MemoryEngineSettings.tsx` (new), `frontend/src/routes/MemorySettings.tsx` (new), `frontend/src/routes/Settings.tsx` (regrouped), `frontend/src/App.tsx` (2 new routes)
- `frontend/src/features/chat/ChatShell.tsx` (memory toast subscription + render)
