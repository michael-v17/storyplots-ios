-- Cycle 0009 — Grammar Agent: grammar_corrections + grammar_aggregates.
-- Satisfies schema.md §2.14, §2.15, §5 rules 5/6; domain.md §2.14, §2.15,
-- §6 invariants #1 #2 #3 #4 #16 #17; user-stories.md §5.5 stories #26-#34.

-- grammar_corrections — one row per user-message current text.
create table public.grammar_corrections (
  id                            uuid primary key default gen_random_uuid(),
  user_message_id               uuid not null unique
                                references public.messages(id) on delete cascade,
  conversation_id               uuid not null references public.conversations(id) on delete cascade,
  user_id                       uuid not null references public.users(id) on delete cascade,
  original_text                 text not null,
  corrected_text                text not null,
  explanation                   text,
  error_categories              text[] not null default '{}',
  edit_distance                 integer,
  reinforcement_failures_count  integer not null default 0,
  created_at                    timestamptz not null default now()
);

-- schema.md §5 rule 5: user_message_id MUST reference role='user'.
create or replace function public.grammar_corrections_user_role_check()
returns trigger
language plpgsql
as $$
declare
  r public.message_role;
begin
  select role into r from public.messages where id = new.user_message_id;
  if r is null or r <> 'user' then
    raise exception 'grammar_corrections.user_message_id must reference role=user';
  end if;
  return new;
end;
$$;

create trigger grammar_corrections_user_role_check_trg
  before insert or update of user_message_id on public.grammar_corrections
  for each row execute function public.grammar_corrections_user_role_check();

alter table public.grammar_corrections enable row level security;

create policy grammar_corrections_select_own on public.grammar_corrections
  for select using (user_id = auth.uid());
create policy grammar_corrections_insert_own on public.grammar_corrections
  for insert with check (user_id = auth.uid());
create policy grammar_corrections_update_own on public.grammar_corrections
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());
create policy grammar_corrections_delete_own on public.grammar_corrections
  for delete using (user_id = auth.uid());

create index grammar_corrections_conversation_created
  on public.grammar_corrections (conversation_id, created_at desc);

create index grammar_corrections_user_id
  on public.grammar_corrections (user_id);

-- grammar_aggregates — schema only; Insights Job populates in cycle 0010.
create table public.grammar_aggregates (
  user_id                        uuid primary key references public.users(id) on delete cascade,
  detected_level                 text,
  top_errors                     jsonb,
  filler_words                   jsonb,
  overused_words                 jsonb,
  connector_stats                jsonb,
  ai_narrative_feedback          text,
  improvement_suggestions        text,
  reinforcement_performance_pct  numeric,
  dirty                          boolean not null default false,
  new_messages_since_last_run    integer not null default 0,
  updated_at                     timestamptz not null default now()
);

alter table public.grammar_aggregates enable row level security;

create policy grammar_aggregates_select_own on public.grammar_aggregates
  for select using (user_id = auth.uid());

create trigger grammar_aggregates_touch_updated_at
  before update on public.grammar_aggregates
  for each row execute function public.touch_updated_at();

-- Upsert dirty flag + increment counter on grammar_aggregates.
-- Called by the backend after each Grammar Agent pass.
create or replace function public.upsert_grammar_dirty(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.grammar_aggregates (user_id, dirty, new_messages_since_last_run)
  values (p_user_id, true, 1)
  on conflict (user_id) do update
    set dirty = true,
        new_messages_since_last_run = grammar_aggregates.new_messages_since_last_run + 1;
end;
$$;

grant execute on function public.upsert_grammar_dirty(uuid) to authenticated;

-- Upsert grammar_aggregates from the Insights Job. The job passes the
-- entire row as a jsonb blob; this function unpacks it into columns.
create or replace function public.upsert_grammar_aggregates(p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if (p_data->>'user_id')::uuid <> auth.uid() then raise exception 'not your data'; end if;

  insert into public.grammar_aggregates (
    user_id, detected_level, top_errors, filler_words, overused_words,
    connector_stats, ai_narrative_feedback, improvement_suggestions,
    reinforcement_performance_pct, dirty, new_messages_since_last_run
  ) values (
    (p_data->>'user_id')::uuid,
    p_data->>'detected_level',
    p_data->'top_errors',
    p_data->'filler_words',
    p_data->'overused_words',
    p_data->'connector_stats',
    p_data->>'ai_narrative_feedback',
    p_data->>'improvement_suggestions',
    (p_data->>'reinforcement_performance_pct')::numeric,
    (p_data->>'dirty')::boolean,
    (p_data->>'new_messages_since_last_run')::integer
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

grant execute on function public.upsert_grammar_aggregates(jsonb) to authenticated;
