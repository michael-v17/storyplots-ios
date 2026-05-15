-- Cycle 0013 fix (review #1) — atomic fork inside one SQL transaction.
--
-- Before: fork.py made 8+ sequential PostgREST calls. A failure mid-copy
-- left a child conversation row in the DB with partial messages /
-- lorebook / grammar — silently navigable at /chat/{id} in a broken
-- state with no way for the server to roll back.
--
-- Fix: a single SECURITY DEFINER function does the whole copy inside
-- one implicit transaction. Either all rows land together or none do.
-- Summarize-fresh mode passes the summary text in as a parameter (the
-- LLM call still happens in fork.py — SQL functions can't make HTTP
-- requests); the DB function trusts the caller for that text.
--
-- Arguments:
--   p_parent_conversation_id   which conversation to fork
--   p_anchor_message_id        kept-range = messages where created_at <= anchor
--   p_mode                     'keep_messages' | 'summarize_fresh'
--   p_title                    child conversation title
--   p_parent_branch_summary    only for summarize_fresh; NULL otherwise
--
-- Returns: the new conversation_id.

create or replace function public.fork_conversation_tx(
  p_parent_conversation_id uuid,
  p_anchor_message_id uuid,
  p_mode public.branch_mode,
  p_title text,
  p_parent_branch_summary text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid;
  parent_row public.conversations%rowtype;
  anchor_row public.messages%rowtype;
  child_id uuid;
  src_msg public.messages%rowtype;
  new_msg_id uuid;
  new_variant_id uuid;
  src_variant public.message_variants%rowtype;
begin
  caller := auth.uid();
  if caller is null then raise exception 'auth required'; end if;

  select * into parent_row from public.conversations
    where id = p_parent_conversation_id and user_id = caller;
  if not found then raise exception 'conversation not found' using errcode = 'P0002'; end if;

  select * into anchor_row from public.messages
    where id = p_anchor_message_id and conversation_id = p_parent_conversation_id;
  if not found then raise exception 'anchor message not in conversation' using errcode = 'P0002'; end if;

  -- 1. Child conversation row.
  insert into public.conversations (
    user_id, character_id, title, character_snapshot, writing_style_snapshot,
    persona_id,
    branch_parent_conversation_id, branch_parent_message_id, branch_mode,
    parent_branch_summary
  ) values (
    caller, parent_row.character_id, p_title,
    parent_row.character_snapshot, parent_row.writing_style_snapshot,
    parent_row.persona_id,
    parent_row.id, anchor_row.id, p_mode,
    case when p_mode = 'summarize_fresh' then p_parent_branch_summary else null end
  )
  returning id into child_id;

  -- Temp map of parent message id → child message id, used to rewrite
  -- grammar_corrections.user_message_id below.
  create temp table if not exists _fork_msg_map (
    parent_msg_id uuid primary key,
    child_msg_id  uuid not null
  ) on commit drop;
  truncate _fork_msg_map;

  if p_mode = 'keep_messages' then
    -- 2. Copy messages up to anchor chronologically. Iterate (not CTE)
    -- so we can fan out each assistant's active variant in the same
    -- loop and maintain the parent→child id map reliably.
    for src_msg in
      select * from public.messages
        where conversation_id = p_parent_conversation_id
          and created_at <= anchor_row.created_at
        order by created_at asc
    loop
      -- Use clock_timestamp() (not now() / transaction_timestamp()) so each
      -- INSERT inside this function gets a strictly-increasing timestamp.
      -- Without this, all inserts share one transaction timestamp and the
      -- chronological ORDER BY created_at on the child scrambles.
      insert into public.messages (conversation_id, role, text, created_at)
        values (child_id, src_msg.role, src_msg.text, clock_timestamp())
        returning id into new_msg_id;
      insert into _fork_msg_map (parent_msg_id, child_msg_id)
        values (src_msg.id, new_msg_id);

      if src_msg.role = 'assistant' and src_msg.active_variant_id is not null then
        select * into src_variant from public.message_variants
          where id = src_msg.active_variant_id;
        if found then
          insert into public.message_variants (
            message_id, content, model_snapshot, generation_params_snapshot, created_at
          ) values (
            new_msg_id, src_variant.content, src_variant.model_snapshot,
            src_variant.generation_params_snapshot, clock_timestamp()
          )
          returning id into new_variant_id;
          update public.messages set active_variant_id = new_variant_id where id = new_msg_id;
        end if;
      end if;
    end loop;

    -- 3. Copy grammar_corrections for the kept user messages (mapped).
    insert into public.grammar_corrections (
      user_id, conversation_id, user_message_id,
      original_text, corrected_text, explanation,
      error_categories, edit_distance, reinforcement_failures_count
    )
    select caller, child_id, map.child_msg_id,
           gc.original_text, gc.corrected_text, gc.explanation,
           gc.error_categories, gc.edit_distance, gc.reinforcement_failures_count
      from public.grammar_corrections gc
      join _fork_msg_map map on map.parent_msg_id = gc.user_message_id
     where gc.conversation_id = p_parent_conversation_id;
  end if;

  -- 4. Copy lorebook_entries (scope is per-conversation — copy all).
  insert into public.lorebook_entries (
    user_id, conversation_id, title, keywords, body, source, token_estimate
  )
  select caller, child_id, le.title, le.keywords, le.body, le.source, le.token_estimate
    from public.lorebook_entries le
   where le.conversation_id = p_parent_conversation_id;

  return child_id;
end;
$$;

grant execute on function public.fork_conversation_tx(uuid, uuid, public.branch_mode, text, text) to authenticated;
