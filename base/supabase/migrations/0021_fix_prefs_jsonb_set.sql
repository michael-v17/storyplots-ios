-- Cycle 0016 post-review fix #1 — jsonb_set silently no-ops when the
-- intermediate parent key is absent, so a user's FIRST visual-roleplay
-- save (or first image-preset save) writes nothing. Also affects
-- set_user_image_preset from cycle 0015.2.
--
-- The fix is to pre-seed the parent object with jsonb_set(..., '{}'::jsonb)
-- before touching the nested path. See the postgres docs: `create_missing`
-- on jsonb_set only creates the LEAF when its direct parent exists.

create or replace function public.set_user_image_preset(p_preset text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_prefs jsonb;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;

  select coalesce(preferences, '{}'::jsonb) into current_prefs
    from public.users where id = auth.uid();

  -- Ensure the `image` parent object exists first so the nested jsonb_set
  -- below actually writes instead of silently no-op-ing.
  current_prefs := jsonb_set(
    current_prefs,
    '{image}',
    coalesce(current_prefs -> 'image', '{}'::jsonb),
    true
  );

  if p_preset is null then
    current_prefs := current_prefs #- '{image,default_resolution_preset}';
  else
    current_prefs := jsonb_set(
      current_prefs,
      '{image,default_resolution_preset}',
      to_jsonb(p_preset),
      true
    );
  end if;

  update public.users set preferences = current_prefs where id = auth.uid();
end;
$$;


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

  -- Pre-seed parent; see comment in set_user_image_preset above.
  current_prefs := jsonb_set(
    current_prefs,
    '{visual_roleplay}',
    coalesce(current_prefs -> 'visual_roleplay', '{}'::jsonb),
    true
  );

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
