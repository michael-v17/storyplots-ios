-- Cycle 0029 — Character Memory RAG (schema.md §2.8; architecture.md §4.1 position 8)
-- + 'embedding' provider kind (creator-vision.md §7 BYOK, mirrors Text/Image/TTS).

-- 1. pgvector + embedding provider kind.
create extension if not exists vector;
alter type public.provider_kind add value if not exists 'embedding';

-- 2. MemoryDocument source enum.
create type public.memory_document_source as enum ('upload', 'conversation_extract');

-- 3. memory_documents — per-Conversation source-of-facts.
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

-- 4. memory_document_chunks — embedded atoms for vector retrieval.
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

-- 5. Retrieval RPC — pgvector top-K with cosine similarity threshold.
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
  select c.id,
         c.memory_document_id,
         c.text,
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

-- 6. Embedding provider upsert (mirrors upsert_text_provider from 0007).
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

-- 7. Decrypt the active embedding key (mirrors get_active_text_key from 0007).
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
