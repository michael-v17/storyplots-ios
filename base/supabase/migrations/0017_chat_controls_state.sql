-- Cycle 0015 — per-Conversation image-generation overrides.
-- Satisfies schema.md §2.11. auto_images / auto_tts columns ship in
-- cycle 0016 alongside Visual Roleplay auto-mode.

create table public.chat_controls_state (
  conversation_id             uuid primary key references public.conversations(id) on delete cascade,
  user_id                     uuid not null references public.users(id) on delete cascade,
  image_provider_override_id  uuid references public.provider_configs(id) on delete set null,
  resolution_preset           text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

alter table public.chat_controls_state enable row level security;

create policy ccs_select_own on public.chat_controls_state
  for select using (user_id = auth.uid());
create policy ccs_insert_own on public.chat_controls_state
  for insert with check (user_id = auth.uid());
create policy ccs_update_own on public.chat_controls_state
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());
create policy ccs_delete_own on public.chat_controls_state
  for delete using (user_id = auth.uid());

create trigger chat_controls_state_touch_updated_at
  before update on public.chat_controls_state
  for each row execute function public.touch_updated_at();
