-- Cycle 0013 — Import Character (PNG / JSON).
-- Satisfies schema.md §2.19 (storage bucket); user-stories.md #8;
-- domain.md §2.3 (lifecycle: imported). v0-only fields: pending_character_book.

-- Private bucket for raw card retention + extracted PNG avatars.
-- Objects are only read/written by the owning user (RLS enforced via path
-- prefix {user_id}/). Not publicly served in v0.
insert into storage.buckets (id, name, public)
  values ('character-imports', 'character-imports', false)
  on conflict (id) do nothing;

-- Storage RLS. storage.foldername(name) returns the path segments as an
-- array; index [1] is the top-level folder which we require to equal the
-- caller's uid. This gives per-user isolation without a separate
-- object-ownership table.
create policy character_imports_owner_select
  on storage.objects for select
  using (
    bucket_id = 'character-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy character_imports_owner_insert
  on storage.objects for insert
  with check (
    bucket_id = 'character-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy character_imports_owner_update
  on storage.objects for update
  using (
    bucket_id = 'character-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'character-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy character_imports_owner_delete
  on storage.objects for delete
  using (
    bucket_id = 'character-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- V2 character_book payload held on the Character until the first
-- Conversation is created, at which point createConversationFromCharacter
-- drains it into that conversation's lorebook_entries and clears the field.
-- Retained as jsonb (list of {keywords: [...], content: "...", ...}) so we
-- stay faithful to the source format; mapping to lorebook_entries happens
-- at drain time.
alter table public.characters
  add column pending_character_book jsonb;
