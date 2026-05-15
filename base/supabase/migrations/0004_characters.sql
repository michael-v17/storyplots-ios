-- Cycle 0004 — characters table + enums + RLS + mode-immutable guard.
-- Satisfies schema.md §2.3, §5; domain.md §2.3, §6 invariants #7 #8 #19 #20;
-- user-stories.md §5.2 stories #7 #9 #10 (Manual scope).

create type public.character_mode as enum ('roleplay', 'assistant');
create type public.english_style  as enum (
  'formal_american', 'neutral_american', 'casual_american'
);

create table public.characters (
  id                                  uuid primary key default gen_random_uuid(),
  user_id                             uuid not null references public.users(id) on delete cascade,
  name                                text not null,
  tagline                             text,
  system_prompt                       text not null,
  mode                                public.character_mode not null,
  avatar_ref                          text,
  appearance_description              text,
  append_appearance_to_image_prompts  boolean not null default true,
  accent_color                        text not null,
  personality                         jsonb,
  goals                               jsonb,
  worldbuilding                       jsonb,
  default_writing_style_id            uuid,                  -- FK added when writing_styles lands
  default_persona_id                  uuid references public.user_personas(id) on delete set null,
  character_memory_enabled            boolean not null default true,
  tags                                text[],
  scenario                            text,
  english_style                       public.english_style not null default 'neutral_american',
  expertise_areas                     text,
  communication_style_assistant       text,
  rules                               text,
  is_example                          boolean not null default false,
  created_at                          timestamptz not null default now(),
  updated_at                          timestamptz not null default now()
);

alter table public.characters enable row level security;

create policy characters_select_own on public.characters
  for select using (user_id = auth.uid());
create policy characters_insert_own on public.characters
  for insert with check (user_id = auth.uid());
create policy characters_update_own on public.characters
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());
create policy characters_delete_own on public.characters
  for delete using (user_id = auth.uid());

create trigger characters_touch_updated_at
  before update on public.characters
  for each row execute function public.touch_updated_at();

-- Invariant #20: mode is immutable after creation. Belt-and-braces
-- with the UI (CharacterForm renders mode read-only on edit).
create or replace function public.characters_mode_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.mode is distinct from old.mode then
    raise exception 'character.mode is immutable after creation';
  end if;
  return new;
end;
$$;

create trigger characters_mode_immutable_trg
  before update on public.characters
  for each row execute function public.characters_mode_immutable();

create index characters_user_id_updated_at
  on public.characters (user_id, updated_at desc);
