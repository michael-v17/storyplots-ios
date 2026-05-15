-- Cycle 0079 — group character support (captured as migration during xvm_project provisioning).
-- group_size=1 is the default (single NPC, existing behavior unchanged).
-- group_members_description replaces the 11 individual physical fields for image generation when group_size > 1.

alter table public.characters
  add column if not exists group_size smallint not null default 1
    check (group_size between 1 and 4);

alter table public.characters
  add column if not exists group_members_description text;
