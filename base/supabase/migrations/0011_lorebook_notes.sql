-- Cycle 0011 — Lorebook + Author's Notes (per-Conversation).
-- Satisfies schema.md §2.7, §2.9; domain.md §2.7, §2.10, §6 #2 #6;
-- user-stories.md §5.x stories #22, #25; creator-vision.md §3, §5.2.

create type public.lorebook_source as enum ('manual', 'auto_extracted');

create table public.lorebook_entries (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  title           text not null,
  keywords        text[] not null default '{}',
  body            text not null,
  source          public.lorebook_source not null default 'manual',
  token_estimate  integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.lorebook_entries enable row level security;

create policy lorebook_entries_select_own on public.lorebook_entries
  for select using (user_id = auth.uid());
create policy lorebook_entries_insert_own on public.lorebook_entries
  for insert with check (user_id = auth.uid());
create policy lorebook_entries_update_own on public.lorebook_entries
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());
create policy lorebook_entries_delete_own on public.lorebook_entries
  for delete using (user_id = auth.uid());

create trigger lorebook_entries_touch_updated_at
  before update on public.lorebook_entries
  for each row execute function public.touch_updated_at();

create index lorebook_entries_conversation
  on public.lorebook_entries (conversation_id);

-- schema.md §2.9 — at most one Author's Note per Conversation in v0.
create table public.authors_notes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  notes_text      text not null,
  injection_depth integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.authors_notes enable row level security;

create policy authors_notes_select_own on public.authors_notes
  for select using (user_id = auth.uid());
create policy authors_notes_insert_own on public.authors_notes
  for insert with check (user_id = auth.uid());
create policy authors_notes_update_own on public.authors_notes
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());
create policy authors_notes_delete_own on public.authors_notes
  for delete using (user_id = auth.uid());

create trigger authors_notes_touch_updated_at
  before update on public.authors_notes
  for each row execute function public.touch_updated_at();
