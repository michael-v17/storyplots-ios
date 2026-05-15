-- Cycle 0002 — keep public.users.auth_method / email / email_verified_at
-- authoritative from auth.users, and forbid client writes to those columns.
-- Closes the auth_method spoof path (domain.md §6 #12) and wires anonymous
-- → authenticated link to update public.users automatically (flow F5,
-- stories #1, #2, #3).

-- 1. Trigger: sync on every auth.users UPDATE (link, unlink, confirm email).
create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider text;
  new_method public.auth_method;
begin
  provider := coalesce(new.raw_app_meta_data->>'provider', '');
  new_method := case
    when new.is_anonymous then 'anonymous'
    when provider = 'google' then 'google'
    when provider = 'github' then 'github'
    else 'email'
  end::public.auth_method;

  update public.users
     set auth_method       = new_method,
         email             = new.email,
         email_verified_at = new.email_confirmed_at,
         last_active_at    = now()
   where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_auth_user_updated();

-- 2. Trigger: reject client-driven changes to auth-shadow columns.
-- PostgREST sets `current_user` to 'anon' or 'authenticated' on every
-- client call (via SET LOCAL ROLE). Inside the SECURITY DEFINER sync
-- trigger above, `current_user` is the function owner instead — so
-- internal updates pass. Keying on the positive direction avoids
-- hard-coding 'postgres' and is robust across deploy-owner roles.
create or replace function public.users_block_auth_shadow()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') and (
       new.auth_method       is distinct from old.auth_method
    or new.email             is distinct from old.email
    or new.email_verified_at is distinct from old.email_verified_at
  ) then
    raise exception
      'auth_method, email, email_verified_at are read-only from the client';
  end if;
  return new;
end;
$$;

create trigger users_block_auth_shadow_trg
  before update on public.users
  for each row execute function public.users_block_auth_shadow();
