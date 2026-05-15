-- Cycle 0003 — UserPersona entity + avatars storage bucket.
-- Satisfies schema.md §2.2, §2.19, §5; domain.md §2.2, §6 invariants
-- #1, #11, #15; user-stories.md §5.11 story #52.

-- Shared helper: touch updated_at on every UPDATE. First use is
-- user_personas; future tables reuse.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 1. user_personas table.
create table public.user_personas (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique
                    references public.users(id) on delete cascade,
  photo_ref         text,
  name              text not null,
  gender            text,
  appearance        jsonb,
  background_story  text,
  is_default        boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.user_personas enable row level security;

create policy user_personas_select_own on public.user_personas
  for select using (user_id = auth.uid());

create policy user_personas_insert_own on public.user_personas
  for insert with check (user_id = auth.uid());

create policy user_personas_update_own on public.user_personas
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());

create policy user_personas_delete_own on public.user_personas
  for delete using (user_id = auth.uid());

create trigger user_personas_touch_updated_at
  before update on public.user_personas
  for each row execute function public.touch_updated_at();

-- 2. avatars storage bucket + per-user RLS on objects.
-- Objects live at '{auth.uid()}/<filename>'; the first folder
-- segment gates access.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy avatars_select_own on storage.objects
  for select
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_insert_own on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_update_own on storage.objects
  for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_delete_own on storage.objects
  for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
