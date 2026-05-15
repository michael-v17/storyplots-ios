-- 0041_memory_significance_topic.sql
-- Cycle 0117 — Memory extraction in character POV + significance/topic columns.
--
-- Adds two columns to memory_document_chunks:
--   topic        text — one of (event|action|promise|fact|relationship|boundary).
--                Pre-cycle topic was stored as free-text in memory_documents.title.
--                The new column lets the retrieval RPC boost on topic-adjacency.
--   significance smallint check (1..5) default 3 — doc §9.8 weight scale.
--                4-5 are turning-point / promise / boundary; 1-2 are routine.
--
-- Legacy chunks default to topic=null + significance=3. The retrieval RPC
-- treats null topic as 'fact' for boost purposes.
--
-- Replaces memory_search with a new signature that adds a significance boost
-- to the recency-weighted cosine score. Chunks tagged as boundary/promise or
-- significance >= 4 retrieve earlier when relevant.

alter table public.memory_document_chunks
  add column if not exists topic text;
alter table public.memory_document_chunks
  add column if not exists significance smallint not null default 3 check (significance between 1 and 5);

create index if not exists memory_chunks_significance
  on public.memory_document_chunks (significance) where significance >= 4;
create index if not exists memory_chunks_topic
  on public.memory_document_chunks (topic) where topic is not null;

-- Drop the cycle-0031 signature and replace with one that adds significance/topic boost.
drop function if exists public.memory_search(uuid, vector(1536), float, int, int, float);

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
  topic              text,
  significance       smallint,
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
      c.topic                                      as topic,
      c.significance                               as significance,
      1 - (c.embedding <=> p_query_vec)            as similarity,
      1.0 / (1.0 + greatest(
        p_current_message_count - c.message_count_at_creation, 0
      )::float / 20.0)                             as recency,
      -- Significance boost: 0 for sig 3 (routine), +0.05 per step above 3
      -- (sig 4 = +0.05, sig 5 = +0.10). Topic boost: +0.05 for promise/boundary
      -- (their doc-§6.4 "trumps recency" requirement maps cleanly to a small
      -- score bump that surfaces them when topic-adjacent).
      (greatest(c.significance - 3, 0))::float * 0.05 as sig_boost,
      case when c.topic in ('promise', 'boundary') then 0.05 else 0.0 end as topic_boost
    from public.memory_document_chunks c
    where c.conversation_id = p_conversation_id
      and c.user_id = auth.uid()
      and c.embedding is not null
      and (1 - (c.embedding <=> p_query_vec)) >= p_match_threshold
  )
  select
    c.chunk_id, c.memory_document_id, c.text, c.topic, c.significance,
    c.similarity, c.recency,
    c.similarity * (1 - (select weight from w))
      + (select weight from w) * c.recency
      + c.sig_boost
      + c.topic_boost                                     as score
  from candidates c
  order by score desc
  limit p_match_count;
$$;

grant execute on function public.memory_search(uuid, vector(1536), float, int, int, float) to authenticated;
