-- Cycle 0013 fix (review #5) — close the insights.py dirty-flag race.
--
-- Before: upsert_grammar_aggregates took `dirty=false` + `new_messages_since_last_run=0`
-- from the caller and blindly overwrote the DB values. If a grammar correction
-- landed between the job reading `grammar_corrections` and writing the
-- aggregate, upsert_grammar_dirty had already set dirty=true / incremented
-- the counter in-place; the insights write then reset them, silently eating
-- the signal. The next Dashboard load would miss that correction until the
-- next Insights run fired.
--
-- Fix: drop the `dirty` and `new_messages_since_last_run` fields from the
-- caller payload. The RPC now takes `p_processed_corrections` (the count the
-- job actually aggregated) and computes the residue:
--   new_count = max(current_count - processed, 0)
--   dirty     = new_count > 0
-- So a write that arrived during processing stays signalled.

create or replace function public.upsert_grammar_aggregates(
  p_data jsonb,
  p_processed_corrections integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
  current_count integer;
  residue integer;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  target_user := (p_data->>'user_id')::uuid;
  if target_user <> auth.uid() then raise exception 'not your data'; end if;

  -- Read-modify-write on the counter guarded against concurrent inserts from
  -- upsert_grammar_dirty. Both RPCs are SECURITY DEFINER and fast; the window
  -- is a single statement here.
  select coalesce(new_messages_since_last_run, 0)
    into current_count
    from public.grammar_aggregates
    where user_id = target_user
    for update;

  if current_count is null then current_count := 0; end if;
  residue := greatest(current_count - greatest(p_processed_corrections, 0), 0);

  insert into public.grammar_aggregates (
    user_id, detected_level, top_errors, filler_words, overused_words,
    connector_stats, ai_narrative_feedback, improvement_suggestions,
    reinforcement_performance_pct, dirty, new_messages_since_last_run
  ) values (
    target_user,
    p_data->>'detected_level',
    p_data->'top_errors',
    p_data->'filler_words',
    p_data->'overused_words',
    p_data->'connector_stats',
    p_data->>'ai_narrative_feedback',
    p_data->>'improvement_suggestions',
    (p_data->>'reinforcement_performance_pct')::numeric,
    residue > 0,
    residue
  )
  on conflict (user_id) do update set
    detected_level = excluded.detected_level,
    top_errors = excluded.top_errors,
    filler_words = excluded.filler_words,
    overused_words = excluded.overused_words,
    connector_stats = excluded.connector_stats,
    ai_narrative_feedback = excluded.ai_narrative_feedback,
    improvement_suggestions = excluded.improvement_suggestions,
    reinforcement_performance_pct = excluded.reinforcement_performance_pct,
    dirty = excluded.dirty,
    new_messages_since_last_run = excluded.new_messages_since_last_run;
end;
$$;

grant execute on function public.upsert_grammar_aggregates(jsonb, integer) to authenticated;
