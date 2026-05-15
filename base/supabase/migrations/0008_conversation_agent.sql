-- Cycle 0008 — Conversation Agent. SECURITY DEFINER key-fetch RPC + tighten
-- message_variants to enforce the "model_snapshot + generation_params_snapshot
-- always populated" invariant from schema.md §2.6.

-- schema.md §2.6 invariant: on every variant INSERT, model_snapshot and
-- generation_params_snapshot MUST be populated. Cycle 0006 shipped the table
-- before any assistant INSERTs existed; now that the agent writes them, lock
-- the columns down.
alter table public.message_variants
  alter column model_snapshot             set not null,
  alter column generation_params_snapshot set not null;

-- Return the plaintext API key of the caller's currently-active text
-- provider. Gated on auth.uid(). FastAPI calls this with the user's JWT
-- via PostgREST RPC; the plaintext is returned into the backend process
-- memory only and is never stored, logged, or sent back to the client.
create or replace function public.get_active_text_key()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  secret_id uuid;
  plaintext text;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  select vault_secret_id into secret_id
    from public.provider_configs
    where user_id = auth.uid() and kind = 'text' and is_active
    limit 1;
  if secret_id is null then
    return null;
  end if;
  select decrypted_secret into plaintext
    from vault.decrypted_secrets
    where id = secret_id;
  return plaintext;
end;
$$;

grant execute on function public.get_active_text_key() to authenticated;
