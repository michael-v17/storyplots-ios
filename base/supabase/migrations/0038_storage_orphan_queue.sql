-- Cycle 0098 — Storage orphan queue + BEFORE DELETE triggers.
--
-- Why a trigger-driven queue rather than wrapping every delete site:
-- the frontend deletes characters / conversations / personas / messages
-- directly via supabase-js (`.from("...").delete()`), and account
-- deletion (delete_my_account RPC, migration 0030) cascades from
-- auth.users → public.users → every user-owned table. Wrapping each
-- call site to first storage.remove(...) would require backend
-- endpoints we don't have; even then, the auth-cascade path can't be
-- intercepted that way. A row-level BEFORE DELETE trigger fires no
-- matter what triggered the DELETE (frontend RLS path, cascade, RPC,
-- backend explicit), captures the storage paths into a queue table,
-- and a separate sweeper consumes the queue out-of-band.
--
-- The queue is intentionally append-only with a `processed_at` cursor
-- so the sweeper is idempotent — re-running it after a crash is safe.
-- =============================================================================

create table if not exists public.storage_orphans (
  id            bigserial primary key,
  bucket        text not null,
  storage_ref   text not null,
  source_table  text not null,        -- diagnostic / future debugging
  enqueued_at   timestamptz not null default now(),
  processed_at  timestamptz,
  process_error text                  -- last error message if a sweep failed
);

-- Sweeper queries unprocessed rows by enqueued_at — partial index keeps
-- the working-set small even if the table grows large historically.
create index if not exists storage_orphans_unprocessed
  on public.storage_orphans (enqueued_at)
  where processed_at is null;

-- security definer so triggers that fire inside cascade contexts (where
-- the user's RLS may not allow inserts into this table) can still
-- enqueue. The table itself is service-role-only.
alter table public.storage_orphans enable row level security;
-- No policies → only service_role can read/write. Sweeper uses the
-- service-role key.

comment on table public.storage_orphans is
  'Cycle 0098 — append-only queue of Supabase Storage objects whose owning DB row was deleted. A periodic sweeper (scripts/sweep_storage_orphans.py) reads unprocessed rows, calls storage.remove(), and marks processed_at. Safe to re-run after crash.';

-- =============================================================================
-- Trigger 1: generated_images (chat scenes + per-message inline images)
-- Bucket comes from the row's `bucket` column (default 'generated-media',
-- set explicitly on insert by Cycle 0091 Cycle 0092 paths).
-- =============================================================================
create or replace function public.enqueue_image_orphan() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.storage_ref is not null and btrim(old.storage_ref) <> '' then
    insert into public.storage_orphans (bucket, storage_ref, source_table)
    values (coalesce(old.bucket, 'generated-media'), old.storage_ref, 'generated_images');
  end if;
  return old;
end;
$$;

drop trigger if exists generated_images_enqueue_orphan on public.generated_images;
create trigger generated_images_enqueue_orphan
  before delete on public.generated_images
  for each row execute function public.enqueue_image_orphan();

-- =============================================================================
-- Trigger 2: characters (avatar_ref + reference_ref both live in `avatars`
-- bucket per the conventions in routes/avatar_generate.py).
-- =============================================================================
create or replace function public.enqueue_character_storage_orphan() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.avatar_ref is not null and btrim(old.avatar_ref) <> '' then
    insert into public.storage_orphans (bucket, storage_ref, source_table)
    values ('avatars', old.avatar_ref, 'characters.avatar_ref');
  end if;
  if old.reference_ref is not null and btrim(old.reference_ref) <> '' then
    insert into public.storage_orphans (bucket, storage_ref, source_table)
    values ('avatars', old.reference_ref, 'characters.reference_ref');
  end if;
  return old;
end;
$$;

drop trigger if exists characters_enqueue_orphan on public.characters;
create trigger characters_enqueue_orphan
  before delete on public.characters
  for each row execute function public.enqueue_character_storage_orphan();

-- =============================================================================
-- Trigger 3: user_personas (photo_ref + Cycle 0091 reference_ref).
-- =============================================================================
create or replace function public.enqueue_persona_storage_orphan() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.photo_ref is not null and btrim(old.photo_ref) <> '' then
    insert into public.storage_orphans (bucket, storage_ref, source_table)
    values ('avatars', old.photo_ref, 'user_personas.photo_ref');
  end if;
  if old.reference_ref is not null and btrim(old.reference_ref) <> '' then
    insert into public.storage_orphans (bucket, storage_ref, source_table)
    values ('avatars', old.reference_ref, 'user_personas.reference_ref');
  end if;
  return old;
end;
$$;

drop trigger if exists user_personas_enqueue_orphan on public.user_personas;
create trigger user_personas_enqueue_orphan
  before delete on public.user_personas
  for each row execute function public.enqueue_persona_storage_orphan();

-- =============================================================================
-- Maintenance: expose a small RPC for the sweeper to atomically claim
-- a batch of orphans (avoids two concurrent sweeps deleting the same
-- object twice — second delete would 404 but it's still wasted work).
-- =============================================================================
create or replace function public.claim_storage_orphan_batch(p_limit int default 100)
returns setof public.storage_orphans
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pick the oldest unprocessed rows; mark processed_at so a parallel
  -- sweep can't grab the same ones. Real `storage.remove()` happens
  -- client-side (Python script with service-role key); the sweeper is
  -- responsible for setting process_error and clearing processed_at if
  -- a remove call fails.
  return query
    update public.storage_orphans
       set processed_at = now()
     where id in (
       select id from public.storage_orphans
       where processed_at is null
       order by enqueued_at asc
       limit p_limit
       for update skip locked
     )
     returning *;
end;
$$;

grant execute on function public.claim_storage_orphan_batch(int) to service_role;

create or replace function public.fail_storage_orphan(p_id bigint, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.storage_orphans
     set processed_at = null,
         process_error = p_error
     where id = p_id;
end;
$$;

grant execute on function public.fail_storage_orphan(bigint, text) to service_role;
