-- 0043_character_canon_t2.sql
-- Cycle 0119 — T2 character_canon + session resume (audit doc §9.5, §9.6).
--
-- Stores a 2-3 paragraph in-character prose summary of the relationship
-- between (user_id, character_id). Regenerated when N new T1 memories
-- accumulate since the canon's source_memory_count snapshot. Surfaced at
-- session-resume time (Position 0.7) when the user returns after a gap.
--
-- Primary key (user_id, character_id) — one canon per pair.

create table public.character_canon (
  user_id              uuid not null references public.users(id) on delete cascade,
  character_id         uuid not null references public.characters(id) on delete cascade,
  content              text not null,
  source_memory_count  integer not null default 0,
  generated_at         timestamptz not null default now(),
  primary key (user_id, character_id)
);

alter table public.character_canon enable row level security;

create policy character_canon_select_own on public.character_canon
  for select using (user_id = auth.uid());
create policy character_canon_insert_own on public.character_canon
  for insert with check (user_id = auth.uid());
create policy character_canon_update_own on public.character_canon
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy character_canon_delete_own on public.character_canon
  for delete using (user_id = auth.uid());

create index character_canon_generated_at on public.character_canon (generated_at);
