-- 0042_character_memories_t1.sql
-- Cycle 0118 — T1 cross-conversation character memory (audit doc §9.5).
--
-- Adds character_memories: persistent character-scoped memories that survive
-- across all conversations between a (user_id, character_id) pair. T3
-- conversation memory (memory_document_chunks) is unchanged.
--
-- Promotion: at extraction time, if a fact has significance >= 4 OR topic
-- in ('promise', 'boundary', 'relationship'), it is written to BOTH T3 and
-- T1. Lower-significance items live only in T3 (per-conversation).
--
-- Retrieval: callers query memory_search (T3, cycle 0117) AND
-- character_memory_search (T1, this cycle) in parallel and merge.

create table public.character_memories (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.users(id) on delete cascade,
  character_id           uuid not null references public.characters(id) on delete cascade,
  source_conversation_id uuid references public.conversations(id) on delete set null,
  topic                  text,
  significance           smallint not null default 4 check (significance between 1 and 5),
  content                text not null,
  embedding              vector(1536),
  created_at             timestamptz not null default now()
);

alter table public.character_memories enable row level security;

create policy character_memories_select_own on public.character_memories
  for select using (user_id = auth.uid());
create policy character_memories_insert_own on public.character_memories
  for insert with check (user_id = auth.uid());
create policy character_memories_update_own on public.character_memories
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy character_memories_delete_own on public.character_memories
  for delete using (user_id = auth.uid());

create index character_memories_user_char
  on public.character_memories (user_id, character_id);

-- ivfflat cosine for vector search; lists=100 covers up to ~50k T1 rows.
create index character_memories_embedding_cosine
  on public.character_memories
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Retrieval RPC: parallel to memory_search (T3). Filters on (user_id,
-- character_id) instead of conversation_id. Lower default threshold than
-- T3 — these are facts {{char}} permanently knows; should retrieve more
-- aggressively when topic-adjacent. Includes the same significance/topic
-- boost as cycle 0117.

create or replace function public.character_memory_search(
  p_character_id    uuid,
  p_query_vec       vector(1536),
  p_match_threshold float,
  p_match_count     int
) returns table (
  memory_id    uuid,
  content      text,
  topic        text,
  significance smallint,
  similarity   float,
  score        float
)
language sql stable security definer set search_path = public as $$
  with candidates as (
    select
      m.id          as memory_id,
      m.content     as content,
      m.topic       as topic,
      m.significance as significance,
      1 - (m.embedding <=> p_query_vec) as similarity,
      (greatest(m.significance - 3, 0))::float * 0.08 as sig_boost,
      case when m.topic in ('promise', 'boundary') then 0.07 else 0.0 end as topic_boost
    from public.character_memories m
    where m.user_id = auth.uid()
      and m.character_id = p_character_id
      and m.embedding is not null
      and (1 - (m.embedding <=> p_query_vec)) >= p_match_threshold
  )
  select
    c.memory_id, c.content, c.topic, c.significance, c.similarity,
    c.similarity + c.sig_boost + c.topic_boost as score
  from candidates c
  order by score desc
  limit p_match_count;
$$;

grant execute on function public.character_memory_search(uuid, vector(1536), float, int) to authenticated;
