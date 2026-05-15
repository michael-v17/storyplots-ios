-- Cycle 0023 — Delete My Account.
-- SECURITY DEFINER so the function runs as the DB owner (postgres)
-- which has access to the auth schema. Deleting from auth.users
-- cascades to public.users (ON DELETE CASCADE from 0001) which in
-- turn cascades to every user-owned table (characters, conversations,
-- messages, variants, images, audio, lorebook, grammar, personas,
-- providers, chat_controls_state). Storage objects (generated-media,
-- generated-audio, avatars, character-imports) are left orphaned —
-- they're RLS-dead once the user row is gone and can be cleaned up
-- via dashboard or a scheduled job later.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth required'; end if;

  -- Delete from auth.users — this cascades to public.users and
  -- transitively to every FK'd table in the public schema.
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
