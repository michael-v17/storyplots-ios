-- Cycle 0015 post-review fix — atomic merge of the image preset into
-- users.preferences. The prior read-modify-write pattern in the frontend
-- could clobber a concurrent preference update.
--
-- Passing null clears the preset. Always a partial update — never
-- rewrites the full preferences blob.

create or replace function public.set_user_image_preset(p_preset text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;

  if p_preset is null then
    update public.users
      set preferences = coalesce(preferences, '{}'::jsonb)
                      #- '{image,default_resolution_preset}'
      where id = auth.uid();
  else
    update public.users
      set preferences = jsonb_set(
        coalesce(preferences, '{}'::jsonb),
        '{image,default_resolution_preset}',
        to_jsonb(p_preset),
        true
      )
      where id = auth.uid();
  end if;
end;
$$;

grant execute on function public.set_user_image_preset(text) to authenticated;
