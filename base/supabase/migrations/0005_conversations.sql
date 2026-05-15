-- Cycle 0005 — conversations table + RLS + write-once character_snapshot.
-- Satisfies schema.md §2.4, §5; domain.md §2.4, §6 invariants #8 #11 #14 #15;
-- user-stories.md §5.3 stories #12 #13 #15 (shell scope, no messages yet).

create type public.branch_mode as enum ('keep_messages', 'summarize_fresh');

create table public.conversations (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid not null references public.users(id) on delete cascade,
  character_id                    uuid not null references public.characters(id) on delete cascade,
  title                           text not null default 'New Conversation',
  character_snapshot              jsonb not null,
  writing_style_snapshot          jsonb not null default '{}'::jsonb,
  persona_id                      uuid references public.user_personas(id) on delete set null,
  last_message_at                 timestamptz,
  message_count                   integer not null default 0,
  branch_parent_conversation_id   uuid references public.conversations(id) on delete set null,
  branch_parent_message_id        uuid,                  -- FK added when messages table lands
  branch_mode                     public.branch_mode,
  parent_branch_summary           text,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

alter table public.conversations enable row level security;

create policy conversations_select_own on public.conversations
  for select using (user_id = auth.uid());
create policy conversations_insert_own on public.conversations
  for insert with check (user_id = auth.uid());
create policy conversations_update_own on public.conversations
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());
create policy conversations_delete_own on public.conversations
  for delete using (user_id = auth.uid());

create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row execute function public.touch_updated_at();

-- Invariant #8 / schema.md §5 #7: character_snapshot is write-once.
-- The fork cycle (future) writes the snapshot at INSERT of the child
-- Conversation, which bypasses this trigger (UPDATE-only).
create or replace function public.conversations_snapshot_write_once()
returns trigger
language plpgsql
as $$
begin
  if new.character_snapshot is distinct from old.character_snapshot then
    raise exception 'conversations.character_snapshot is write-once';
  end if;
  return new;
end;
$$;

create trigger conversations_snapshot_write_once_trg
  before update on public.conversations
  for each row execute function public.conversations_snapshot_write_once();

create index conversations_character_id_last_message_at
  on public.conversations (character_id, last_message_at desc nulls last, created_at desc);
