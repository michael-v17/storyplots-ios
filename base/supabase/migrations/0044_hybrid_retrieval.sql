-- 0044_hybrid_retrieval.sql
-- Cycle 0120 — Hybrid retrieval (audit doc §9.10).
--
-- Pure cosine retrieval misses entity-anchored queries when the prior
-- wording was different. Example: user mentions "my mother" but the stored
-- memory says "the user's mom" — semantic similarity may rank a chitchat
-- chunk higher. Keyword fallback for entity-anchored queries catches what
-- cosine misses.
--
-- Adds a tsvector generated column on memory_document_chunks and
-- character_memories. GIN index on each. The application-side retrieval
-- code can opt into a UNION of (cosine match) and (tsvector match) when
-- the query window contains proper-noun-ish tokens.

-- Supabase free tier ships with maintenance_work_mem=32MB which is too small
-- for the GIN index build below (the planner reports needing ~61MB). Bump it
-- locally for this migration session.
set local maintenance_work_mem = '64MB';

alter table public.memory_document_chunks
  add column if not exists text_tsv tsvector
    generated always as (to_tsvector('simple', coalesce(text, ''))) stored;

create index if not exists memory_chunks_tsv on public.memory_document_chunks using gin (text_tsv);

alter table public.character_memories
  add column if not exists content_tsv tsvector
    generated always as (to_tsvector('simple', coalesce(content, ''))) stored;

create index if not exists character_memories_tsv on public.character_memories using gin (content_tsv);

-- Entity-anchored fallback RPC. Run when the application detects
-- proper-noun-ish tokens in the query window. Returns rows ordered by
-- ts_rank with the same shape as memory_search/character_memory_search
-- so callers can merge.
--
-- Uses websearch_to_tsquery so the caller can pass natural language
-- without escaping: "my mother Clara" → to_tsquery filters out "my"/"mother"
-- as stop words via 'simple' (no stemming, no stop-word list — keeps proper
-- nouns intact). The 'simple' dictionary is more lenient than 'english' here.

create or replace function public.memory_search_entity(
  p_conversation_id uuid,
  p_query_text      text,
  p_match_count     int
) returns table (
  chunk_id           uuid,
  memory_document_id uuid,
  text               text,
  topic              text,
  significance       smallint,
  rank               float
)
language sql stable security definer set search_path = public as $$
  select
    c.id, c.memory_document_id, c.text, c.topic, c.significance,
    ts_rank(c.text_tsv, websearch_to_tsquery('simple', p_query_text)) as rank
  from public.memory_document_chunks c
  where c.conversation_id = p_conversation_id
    and c.user_id = auth.uid()
    and c.text_tsv @@ websearch_to_tsquery('simple', p_query_text)
  order by rank desc
  limit p_match_count;
$$;

grant execute on function public.memory_search_entity(uuid, text, int) to authenticated;

create or replace function public.character_memory_search_entity(
  p_character_id uuid,
  p_query_text   text,
  p_match_count  int
) returns table (
  memory_id    uuid,
  content      text,
  topic        text,
  significance smallint,
  rank         float
)
language sql stable security definer set search_path = public as $$
  select
    m.id, m.content, m.topic, m.significance,
    ts_rank(m.content_tsv, websearch_to_tsquery('simple', p_query_text)) as rank
  from public.character_memories m
  where m.user_id = auth.uid()
    and m.character_id = p_character_id
    and m.content_tsv @@ websearch_to_tsquery('simple', p_query_text)
  order by rank desc
  limit p_match_count;
$$;

grant execute on function public.character_memory_search_entity(uuid, text, int) to authenticated;
