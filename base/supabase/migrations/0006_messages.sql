-- Cycle 0006 — messages + message_variants + RLS + triggers.
-- Satisfies schema.md §2.5, §2.6, §3; domain.md §2.5, §2.6, §6 invariants
-- #4 #5 #14 #15; user-stories.md §5.4 stories #16 #18 #24 (user-only scope).
-- New seed default: messages.text column for user-message text (see
-- Seed/open-questions.md §5.10).

create type public.message_role as enum ('user', 'assistant');

create table public.messages (
  id                 uuid primary key default gen_random_uuid(),
  conversation_id    uuid not null references public.conversations(id) on delete cascade,
  role               public.message_role not null,
  text               text,                    -- populated for role='user'
  active_variant_id  uuid,                    -- FK added below (circular to message_variants)
  created_at         timestamptz not null default now(),
  edited_at          timestamptz
);

create table public.message_variants (
  id                             uuid primary key default gen_random_uuid(),
  message_id                     uuid not null references public.messages(id) on delete cascade,
  content                        text not null,
  model_snapshot                 text,
  generation_params_snapshot     jsonb,
  created_at                     timestamptz not null default now()
);

-- Circular FK messages.active_variant_id → message_variants.id.
-- Deferrable so assistant-message inserts can insert the parent row first
-- and populate active_variant_id in the same transaction.
alter table public.messages
  add constraint messages_active_variant_fk
  foreign key (active_variant_id) references public.message_variants(id) on delete set null
  deferrable initially deferred;

-- schema.md §2.6 / domain.md §2.6 invariant: variants only on assistant messages.
create or replace function public.message_variants_assistant_only()
returns trigger
language plpgsql
as $$
declare
  r public.message_role;
begin
  select role into r from public.messages where id = new.message_id;
  if r is null or r <> 'assistant' then
    raise exception 'message_variants only allowed on role=assistant messages';
  end if;
  return new;
end;
$$;

create trigger message_variants_assistant_only_trg
  before insert or update of message_id on public.message_variants
  for each row execute function public.message_variants_assistant_only();

-- RLS via subquery join on conversations (schema.md §3).
alter table public.messages         enable row level security;
alter table public.message_variants enable row level security;

create policy messages_select_own on public.messages
  for select using (conversation_id in (
    select id from public.conversations where user_id = auth.uid()
  ));
create policy messages_insert_own on public.messages
  for insert with check (conversation_id in (
    select id from public.conversations where user_id = auth.uid()
  ));
create policy messages_update_own on public.messages
  for update using (conversation_id in (
    select id from public.conversations where user_id = auth.uid()
  )) with check (conversation_id in (
    select id from public.conversations where user_id = auth.uid()
  ));
create policy messages_delete_own on public.messages
  for delete using (conversation_id in (
    select id from public.conversations where user_id = auth.uid()
  ));

create policy message_variants_select_own on public.message_variants
  for select using (message_id in (
    select m.id from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.user_id = auth.uid()
  ));
create policy message_variants_insert_own on public.message_variants
  for insert with check (message_id in (
    select m.id from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.user_id = auth.uid()
  ));
create policy message_variants_update_own on public.message_variants
  for update using (message_id in (
    select m.id from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.user_id = auth.uid()
  )) with check (message_id in (
    select m.id from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.user_id = auth.uid()
  ));
create policy message_variants_delete_own on public.message_variants
  for delete using (message_id in (
    select m.id from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.user_id = auth.uid()
  ));

-- Trigger: keep conversations.message_count + last_message_at authoritative.
-- Runs after any insert/update/delete on messages. Derived values — never
-- client-written.
create or replace function public.messages_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_conv uuid;
begin
  target_conv := coalesce(new.conversation_id, old.conversation_id);
  update public.conversations
     set message_count   = (select count(*) from public.messages where conversation_id = target_conv),
         last_message_at = (select max(created_at) from public.messages where conversation_id = target_conv)
   where id = target_conv;
  return coalesce(new, old);
end;
$$;

create trigger messages_touch_conversation_trg
  after insert or update or delete on public.messages
  for each row execute function public.messages_touch_conversation();

create index messages_conversation_created
  on public.messages (conversation_id, created_at asc);
