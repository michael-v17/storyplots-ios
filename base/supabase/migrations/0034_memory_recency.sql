-- Cycle 0031 — Message-distance recency weighting on memory_search.
--
-- Adds message_count_at_creation column (legacy chunks default to 0 → they
-- decay naturally as the conversation grows). Replaces the cycle-0029 RPC
-- with one that takes the caller's current conversation message_count + a
-- recency weight 0..1. Ranking:
--   final_score = similarity * (1-w) + w * recency_factor,
--   recency_factor = 1 / (1 + messages_since / 20).
-- Message distance is session-agnostic — wall-clock gaps between sessions
-- don't penalize yesterday's facts.

alter table public.memory_document_chunks
  add column if not exists message_count_at_creation integer not null default 0;

-- Drop the prior signatures (both 4-arg original and any 5-arg variant).
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
