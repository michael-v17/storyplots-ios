-- Cycle 0012 — Fork Conversation: wire the deferred FK from migration 0005
-- and add a lookup index for parent→children resolution.
-- Satisfies schema.md §2.4; domain.md §2.13, §4.2, §6 #6;
-- user-stories.md #14 + §6 F6; creator-vision.md §5.2, §8.

alter table public.conversations
  add constraint conversations_branch_parent_message_id_fkey
    foreign key (branch_parent_message_id)
    references public.messages(id)
    on delete set null;

create index conversations_branch_parent_conversation_id
  on public.conversations (branch_parent_conversation_id)
  where branch_parent_conversation_id is not null;
