-- Cycle 0016 — atomic merge for users.preferences.visual_roleplay.
-- Same pattern as set_user_image_preset (cycle 0015.2 fix #4) — avoid the
-- read-modify-write race that would let concurrent preference saves clobber
-- each other. Passing a null value for a field leaves it untouched; passing
-- a non-null value replaces that field alone via jsonb_set.

create or replace function public.set_visual_roleplay_prefs(
  p_mode text,
  p_auto_generate_images boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_prefs jsonb;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if p_mode is not null and p_mode not in ('manual', 'auto') then
    raise exception 'invalid visual_roleplay mode: %', p_mode;
  end if;

  select coalesce(preferences, '{}'::jsonb) into current_prefs
    from public.users where id = auth.uid();

  if p_mode is not null then
    current_prefs := jsonb_set(current_prefs, '{visual_roleplay,mode}', to_jsonb(p_mode), true);
  end if;
  if p_auto_generate_images is not null then
    current_prefs := jsonb_set(
      current_prefs,
      '{visual_roleplay,auto_generate_images}',
      to_jsonb(p_auto_generate_images),
      true
    );
  end if;

  update public.users set preferences = current_prefs where id = auth.uid();
end;
$$;

grant execute on function public.set_visual_roleplay_prefs(text, boolean) to authenticated;
