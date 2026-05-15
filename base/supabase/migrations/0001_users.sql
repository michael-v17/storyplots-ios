-- Cycle 0001 — public.users (wraps auth.users) + RLS + auth hook trigger.
-- Satisfies schema.md §2.1, §3, §5 items 1/2/10; domain.md §6 invariants
-- #11, #12, #15, #17.

create type public.auth_method as enum ('email', 'google', 'github', 'anonymous');

create table public.users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  auth_method         public.auth_method not null,
  display_name        text,
  email               text,
  email_verified_at   timestamptz,
  sfw_disabled        boolean not null default false,
  byok_keys           bytea not null default ''::bytea,
  preferences         jsonb not null default jsonb_build_object(
    'grammar', jsonb_build_object(
      'master', false,
      'inline_enabled', false,
      'inline_mode', 'A',
      'sidebar_enabled', false,
      'sidebar_frequency', 'every',
      'sidebar_open', false,
      'reinforcement_enabled', false,
      'tier', 'basic',
      'custom_model_id', null,
      'upgrade_hint_dismissed_at', null
    ),
    'chat_behavior', jsonb_build_object(
      'typing_speed', 0.6,
      'suggested_replies_auto', false
    ),
    'memory', jsonb_build_object(
      'retrieval_top_k', 5,
      'similarity_threshold', 0.7,
      'recency_weight', 0.3,
      'auto_lore', jsonb_build_object('enabled', true, 'every_turns', 3),
      'knowledge_budget', 3500,
      'active_window_reserve', 2000,
      'search_candidates', 10,
      'max_memories', 5,
      'snippet_max_tokens', 300,
      'query_context_chars', 1800,
      'lore_scan_depth', 1
    ),
    'visual_roleplay', jsonb_build_object(
      'mode', 'manual',
      'auto_generate_images', false,
      'default_resolution', 'Square',
      'enabled_resolutions', jsonb_build_array(
        'Random','Square','Portrait','Landscape',
        'TallPortrait','WideLandscape','UltraTall','UltraWide'
      )
    ),
    'bubble_theme', 'default',
    'tts', jsonb_build_object(
      'enabled', false,
      'mode', 'per_message',
      'provider', null,
      'speed', 1.0,
      'pitch', 1.0,
      'volume', 1.0
    ),
    'stt', jsonb_build_object('engine', 'webspeech'),
    'security', jsonb_build_object('cloud_consent_at', null)
  ),
  prompt_assembly     jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  last_active_at      timestamptz not null default now(),

  -- schema.md §5 #10 / domain.md §6 #12: sfw_disabled requires non-anonymous.
  constraint users_sfw_requires_auth
    check (not (sfw_disabled and auth_method = 'anonymous'))
);

create unique index users_email_unique
  on public.users (email)
  where email is not null;

-- RLS: per-user isolation; identical for anonymous and authenticated.
-- schema.md §5 #1, #2; domain.md §6 #11, #15.
alter table public.users enable row level security;

create policy users_select_own on public.users
  for select using (id = auth.uid());

create policy users_update_own on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy users_delete_own on public.users
  for delete using (id = auth.uid());

-- Insert is handled by the auth hook below; no INSERT policy for clients.

-- Auth hook: on every new auth.users row, create a matching public.users row.
-- Runs with SECURITY DEFINER so it bypasses RLS (owned by postgres).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider text;
  method public.auth_method;
begin
  provider := coalesce(new.raw_app_meta_data->>'provider', '');
  method := case
    when new.is_anonymous then 'anonymous'
    when provider = 'google' then 'google'
    when provider = 'github' then 'github'
    else 'email'
  end::public.auth_method;

  insert into public.users (id, auth_method, email)
  values (new.id, method, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
