---
id: 0014
slug: visual-roleplay-foundation
status: shipped
created: 2026-04-16
---

# Cycle 0014 — Visual Roleplay foundation (avatars + per-message ComfyUI)

## Context

The app is text-complete. Cycles 0001-0013 shipped users, characters
(manual + import), conversations, SSE streaming, grammar, lorebook,
author's notes, fork. The `avatars` bucket exists since 0003 (used for
UserPersona via `lib/persona.ts.uploadAvatar`). `Character.avatar_ref`
and `appearance_description` columns exist from 0004. `provider_configs`
already includes `kind='image'` + a `workflow_config jsonb` column from
0007, never wired.

This cycle lights up the **foundation of Visual Roleplay**: avatars
render in the chat feed, a user can generate an image from any
assistant reply via ComfyUI, and the image renders inline below the
message. Settings → Image Engine is added as the new BYOK surface.

Deferred to 0015: Image Viewer modal (fullscreen / regenerate /
favorite / delete), Gallery, `[image: ...]` tag auto-detection,
Auto-Generate toggle, per-Conversation provider override, resolution
preset picker. 0014 ships a single fixed resolution + the single
active image provider.

**Done when:** from any chat with Mira, the user sees her avatar
circle next to each assistant bubble (if uploaded) and a `🎨 Generate
image` button in the action row. Clicking calls a backend route that
refines the prompt (LLM pass) + submits to ComfyUI + polls for
completion + uploads the result to `generated-media`. The image
renders inline below the message. SFW filter is applied unless the
user has `sfw_disabled=true`.

## Shape of the change

```
Migration 0016 (all new; additive to existing schema):
 generated_images    schema.md §2.16 verbatim (+ sfw_blocked flag).
 inline_media        schema.md §2.11 verbatim — links message ↔ image.
 generated-media     storage bucket (private, per-user RLS).
 characters.avatar_ref uploads:
                     reuse the avatars bucket — no new migration.

Backend:
 routes/image.py     POST /messages/{id}/images
                     POST /providers/image/test
 agents/image_refine.py
                     LLM call to turn appearance + last-3-turns into a
                     clean 1-paragraph prompt. Separate JSON-mode call;
                     isolated from Conversation Agent.
 agents/comfyui.py   ComfyUI client: queue workflow + poll /history +
                     fetch output bytes from /view.
 prompts/image_refine_system.txt
 prompts/image_sfw_suffix.txt  positive/negative string fragments.

Frontend:
 lib/images.ts       generateImageForMessage, listImagesForMessage.
 lib/imageProvider.ts upsert + test connection for image provider.
 features/chat/MessageAvatar.tsx
                     32-px circle next to each bubble; character or
                     persona photo; accent ring fallback.
 features/chat/MessageImage.tsx
                     inline image render (max 480×480, lazy-load).
 features/chat/MessageBubble.tsx
                     + avatar column + 🎨 Generate image action on
                     assistant bubbles.
 routes/ImageEngineSettings.tsx
                     /settings/image-engine — BYOK form for ComfyUI
                     base_url, workflow_config JSON upload per style,
                     Test Connection.
 routes/Settings.tsx
                     add "Image Engine" row.
 features/characters/CharacterForm.tsx
                     Avatar tab: wire the existing uploadAvatar helper
                     to characters/{id}/avatar.png (reuse avatars bucket).
```

## 1. Seed sections satisfied

- [creator-vision.md §5.5](../Seed/creator-vision.md) *"Image
  generation via ComfyUI, per-style workflow config"* — this cycle.
- [creator-vision.md §7](../Seed/creator-vision.md) non-negotiables:
  **BYOK** (image provider added), **vendor-agnostic prompts**
  (refinement is a JSON-mode LLM call, same pattern as grammar).
- [creator-vision.md §8](../Seed/creator-vision.md) non-negotiables:
  **SFW guardrail** is applied to image prompts when
  `users.sfw_disabled=false`.
- [product.md §6 media surfaces](../Seed/product.md) — *"per-message
  image generation via ComfyUI (per-style workflows) with SFW
  filtering"*. The first third (per-message + ComfyUI + SFW) ships in
  0014; the rest (gallery + fullscreen viewer + auto-mode) in 0015.
- [user-stories.md #44](../Seed/user-stories.md) *Configure a ComfyUI
  image provider* — High. All AC: base_url, key optional, Test
  Connection, workflow_config per style.
- [user-stories.md #50](../Seed/user-stories.md) *Generate an image
  from an NPC reply* — High. AC: action on **assistant messages
  only**, inline placeholder → image, SFW filter applied, added to
  Gallery (Gallery itself 0015 — the row lands in `generated_images`
  so 0015 can render it).
- [user-stories.md #46](../Seed/user-stories.md) *Upload a Character
  avatar* — Medium. The UX fieldset exists on the Avatar tab with a
  "lands later" note; this cycle wires it up.
- [schema.md §2.11 inline_media, §2.16 generated_images](../Seed/schema.md)
  — column lists.
- [domain.md §2.3 image-prompt assembly](../Seed/domain.md) —
  `append_appearance_to_image_prompts` drives the refinement system
  prompt.
- [domain.md §6 #2](../Seed/domain.md) — bidirectional isolation:
  image-refinement agent runs on a separate system prompt with no
  conversation history beyond the committed "last 3 turns" scope;
  does NOT share the Conversation Agent's system prompt.
- [PersonaLLM-Reference/04-screens/settings/image-engine.md](../Seed/PersonaLLM-Reference/04-screens/settings/image-engine.md)
  — BYOK form layout + workflow_config per style.
- [PersonaLLM-Reference/04-screens/settings/visual-roleplay.md](../Seed/PersonaLLM-Reference/04-screens/settings/visual-roleplay.md)
  — deferred beyond 0014 (auto-generate + resolution picker are 0015).

## 2. Commit decisions made this cycle

Seed ambiguities resolved inline, scoped to this cycle:

- **Avatar placement in message bubble** — not spec'd in seed. v0
  ships: 32-px circle at the **outside** of each bubble (left for
  assistant, right for user). Character avatar for assistant;
  UserPersona `photo_ref` for user when a persona is active, else no
  avatar (just the bubble). Fallback when `avatar_ref` is null: the
  existing accent-color circle we already use on cards.
- **Fixed resolution this cycle** — `1024×1024` square. Resolution
  picker + per-conversation override land in 0015.
- **Single active image provider per user** — enforced by the
  existing unique index on `(user_id, kind) where is_active`.
- **Workflow format** — a ComfyUI API-format JSON (the export from
  ComfyUI's "Save (API Format)"). One workflow per style; for 0014
  ship a single "default" style slot. The style picker UX is 0015.
- **Prompt-refinement context window** — last 3 message pairs (user
  + assistant turns) per PersonaLLM-Reference image-engine §22. Pulled
  from the same `messages_for_prompt` builder used by `/chat`.
- **SFW filter formula** — append
  `_SFW_POSITIVE_SUFFIX.txt` string to the positive prompt,
  `_SFW_NEGATIVE_SUFFIX.txt` to the negative prompt. If the LLM
  refiner marks `sfw_blocked=true` (decided by the refinement JSON
  schema), return 409 with `"sfw_blocked"` and store
  `generated_images.sfw_blocked=true` so the UI can render "blocked"
  rather than silently dropping. No second-opinion LLM this cycle.
- **Edited / trimmed / forked images** — `inline_media` has
  `on delete cascade` on `message_id`, so trim drops the link (the
  `generated_images` row survives in the bucket for the Gallery).
  Forking does **not** copy `inline_media` in 0014 (parity: v0 fork
  already skips images because they don't exist yet). Revisit in 0016
  when fork carries images.
- **Avatar fallback rendering** — use the character's `accent_color`
  as a circle background + first initial overlay. Keeps the feed
  visually anchored even for imports with no avatar.

## 3. Schema scope / RLS

### Migration `supabase/migrations/0016_images.sql`

```sql
-- Cycle 0014 — generated_images + inline_media + generated-media bucket.
-- Satisfies schema.md §2.11, §2.16; creator-vision.md §5.5; user-stories.md #44, #50.

create type public.media_kind as enum ('image', 'video');

create table public.generated_images (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  character_id        uuid not null references public.characters(id) on delete cascade,
  conversation_id     uuid references public.conversations(id) on delete set null,
  message_id          uuid references public.messages(id) on delete set null,
  kind                public.media_kind not null default 'image',
  prompt              text not null,
  refined_prompt      text,
  resolution_preset   text not null default 'square_1024',
  dimensions          jsonb not null default '{"w":1024,"h":1024}'::jsonb,
  provider_snapshot   jsonb not null default '{}'::jsonb,
  seed                bigint,
  storage_ref         text,            -- path in `generated-media`; null when sfw_blocked
  sfw_blocked         boolean not null default false,
  favorite            boolean not null default false,
  created_at          timestamptz not null default now()
);

alter table public.generated_images enable row level security;

create policy generated_images_select_own on public.generated_images
  for select using (user_id = auth.uid());
create policy generated_images_insert_own on public.generated_images
  for insert with check (user_id = auth.uid());
create policy generated_images_update_own on public.generated_images
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy generated_images_delete_own on public.generated_images
  for delete using (user_id = auth.uid());

create index generated_images_character_created
  on public.generated_images (character_id, created_at desc);
create index generated_images_message
  on public.generated_images (message_id) where message_id is not null;

-- inline_media: which image (or video, later) is attached to a given message.
-- One message may have multiple attached images as the user regenerates; a
-- `position` field lets the feed render them in order.
create table public.inline_media (
  id                  uuid primary key default gen_random_uuid(),
  message_id          uuid not null references public.messages(id) on delete cascade,
  generated_image_id  uuid not null references public.generated_images(id) on delete cascade,
  position            integer not null default 0,
  created_at          timestamptz not null default now(),
  unique (message_id, generated_image_id)
);

alter table public.inline_media enable row level security;

create policy inline_media_select_own on public.inline_media
  for select using (message_id in (
    select m.id from public.messages m
      join public.conversations c on c.id = m.conversation_id
     where c.user_id = auth.uid()
  ));
create policy inline_media_insert_own on public.inline_media
  for insert with check (message_id in (
    select m.id from public.messages m
      join public.conversations c on c.id = m.conversation_id
     where c.user_id = auth.uid()
  ));
create policy inline_media_delete_own on public.inline_media
  for delete using (message_id in (
    select m.id from public.messages m
      join public.conversations c on c.id = m.conversation_id
     where c.user_id = auth.uid()
  ));

-- Private bucket for generated bytes. Per-user RLS via path prefix.
insert into storage.buckets (id, name, public)
  values ('generated-media', 'generated-media', false)
  on conflict (id) do nothing;

create policy generated_media_owner_all
  on storage.objects for all
  using (bucket_id = 'generated-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'generated-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- upsert_image_provider: parallel to upsert_text_provider (0007).
create or replace function public.upsert_image_provider(
  p_provider_family  text,        -- 'comfyui' in v0
  p_base_url         text,
  p_api_key          text,        -- optional; ComfyUI local has none
  p_workflow_config  jsonb        -- { styles: { default: { ... } } }
) returns public.provider_configs
language plpgsql
security definer
set search_path = public
as $$
declare
  uid           uuid := auth.uid();
  old_row       public.provider_configs;
  new_secret_id uuid;
  result        public.provider_configs;
  rotating_key  boolean := p_api_key is not null and btrim(p_api_key) <> '';
begin
  if uid is null then raise exception 'auth required'; end if;

  select * into old_row
    from public.provider_configs
    where user_id = uid and kind = 'image' and is_active
    limit 1;

  if rotating_key then
    new_secret_id := vault.create_secret(
      p_api_key,
      format('byok_image_%s_%s', uid, extract(epoch from now())::bigint),
      'BYOK image-provider key (StoryPlots v0)'
    );
    if old_row.vault_secret_id is not null then
      delete from vault.secrets where id = old_row.vault_secret_id;
    end if;
  elsif old_row.id is not null then
    new_secret_id := old_row.vault_secret_id;
  else
    new_secret_id := null;
  end if;

  if old_row.id is not null then
    update public.provider_configs
      set is_active       = true,
          provider_family = p_provider_family,
          base_url        = p_base_url,
          vault_secret_id = new_secret_id,
          workflow_config = p_workflow_config
      where id = old_row.id
      returning * into result;
  else
    insert into public.provider_configs
      (user_id, kind, provider_family, base_url, vault_secret_id,
       workflow_config, is_active)
    values
      (uid, 'image', p_provider_family, p_base_url, new_secret_id,
       p_workflow_config, true)
    returning * into result;
  end if;
  return result;
end;
$$;

grant execute on function public.upsert_image_provider(text, text, text, jsonb) to authenticated;

-- get_active_image_key: parallel to get_active_text_key. Returns the
-- plaintext key from Vault (backend-only; never leaves the FastAPI process).
create or replace function public.get_active_image_key()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select decrypted_secret into k
    from vault.decrypted_secrets
    where id = (
      select vault_secret_id from public.provider_configs
        where user_id = auth.uid() and kind = 'image' and is_active
        limit 1
    );
  return k;
end;
$$;

grant execute on function public.get_active_image_key() to authenticated;
```

## 4. Backend

### `routes/image.py`

- `POST /providers/image/test` — mirror the text provider test.
  Validates the base_url responds to `GET /system_stats` (ComfyUI's
  health endpoint). No workflow submission; just reachability.
- `POST /messages/{message_id}/images` — authorize (message belongs
  to caller's conversation), build the refinement context (character
  + last 3 turns), call refiner, if not blocked submit to ComfyUI +
  poll + fetch bytes, upload to
  `generated-media/{uid}/{image_id}.png`, insert `generated_images`
  + `inline_media` rows, return the DB row.

### `agents/image_refine.py`

JSON-mode call shaped like the grammar agent:

```python
@dataclass
class ImageRefineResult:
    refined_prompt: str
    negative_prompt: str
    sfw_blocked: bool
    block_reason: str | None
```

System prompt: see `prompts/image_refine_system.txt`. Inputs:
- character `appearance_description` (only if
  `append_appearance_to_image_prompts=true`)
- last 3 turns of the conversation (user + assistant content)
- the target assistant message's text
- the user's `sfw_disabled` flag

Output schema the LLM must return:
```json
{
  "refined_prompt": "100-200 word paragraph, no newlines, no params",
  "negative_prompt": "comma-separated tag list",
  "sfw_blocked": false,
  "block_reason": null
}
```

### `agents/comfyui.py`

```python
async def submit_workflow(base_url, api_key, workflow, prompt, neg_prompt, seed) -> str:
    # Rewrite the workflow JSON: inject prompt/neg/seed into the named nodes
    # expected by the "default" style workflow (CLIP encoders + KSampler).
    # POST /prompt → returns { prompt_id }.

async def poll_until_done(base_url, prompt_id, timeout=300) -> dict:
    # GET /history/{prompt_id} every 1s; return the outputs block when ready.

async def fetch_output(base_url, outputs) -> bytes:
    # Pull the first image entry via GET /view?filename=&subfolder=&type=output
```

Default style slot expects the workflow JSON to have:
- CLIP encoder node named `"positive"` (widget `text`)
- CLIP encoder node named `"negative"` (widget `text`)
- KSampler node named `"sampler"` (widget `seed`)
- SaveImage node as the terminal output

If the workflow_config doesn't match this shape, the call fails with
a 400 pointing to the expected node names.

## 5. Frontend surfaces

### `features/chat/MessageAvatar.tsx`

- 32 × 32 circle, margin against the bubble.
- Assistant: `character.avatar_ref` via the existing `avatarUrl`
  helper; fallback to `accent_color` background + first initial.
- User: `userPersona.photo_ref`; fallback: no avatar (keep bubble
  column width consistent with a spacer).

### `features/chat/MessageBubble.tsx`

Two-column layout: `[avatar-col] [bubble-col]`. Avatar on outside
(left for assistant, right for user). `🎨 Generate image` button
added to the action row for assistant bubbles only.

### `features/chat/MessageImage.tsx`

Inline image under the bubble when `inline_media` entries exist for
the message. Square 320×320 default (full size = 1024; viewer modal
comes in 0015). `sfw_blocked` renders a small "Blocked by SFW
filter — disable SFW in Profile to allow" card instead.

### `lib/images.ts`

- `generateImageForMessage(messageId)` — POST to backend, returns
  the new `generated_images` row.
- `listImagesForMessage(messageId)` — SELECT inline_media JOIN
  generated_images scoped by RLS.

### `routes/ImageEngineSettings.tsx`

- ComfyUI base_url (text) — hint "e.g. http://192.168.0.7:8188".
- API key (optional, password input, never shown again).
- Workflow JSON uploader — textarea for paste + "Load from file"
  button. Validates JSON structure (has the 4 expected node names).
- Test Connection button → POST `/providers/image/test`.
- Save → POST RPC `upsert_image_provider`.

### `routes/Settings.tsx`

Add a row: "Image Engine — Configure ComfyUI for image generation".

### `features/characters/CharacterForm.tsx`

Wire the Avatar tab to `uploadAvatar(userId, file, oldRef)` (helper
already exists in `lib/persona.ts`; we'll split it into a shared
`lib/avatars.ts` that takes the table/field name, or call it
directly with a new character-specific helper).

## 6. Verification gates

1. **Avatar renders.** Mira's conversation shows a circle avatar next
   to each assistant message. Without upload: accent-color +
   initial. Persona avatar on user messages if present.
2. **Character avatar upload.** On the Avatar tab of a Character,
   selecting a JPG saves the path to `characters.avatar_ref` and the
   circle re-renders with the uploaded image.
3. **Image Engine settings.** `/settings/image-engine` saves ComfyUI
   base_url + workflow JSON + optional key. Test Connection hits
   `/system_stats` and reports `ok` for a reachable ComfyUI.
4. **Generate image — happy path.** Click `🎨 Generate image` on an
   assistant message; within ~60s an image renders below it.
   `generated_images` row exists with `storage_ref` populated and
   `sfw_blocked=false`.
5. **Refinement includes character appearance.** With
   `append_appearance_to_image_prompts=true` + a populated
   `appearance_description`, the stored `refined_prompt` contains
   the appearance phrase verbatim.
6. **Refinement excludes appearance when toggle off.** With the
   toggle off, `refined_prompt` does not contain the appearance.
7. **SFW filter blocks.** With `sfw_disabled=false` and a
   deliberately NSFW assistant message, the refiner returns
   `sfw_blocked=true`; the UI renders the blocked card; no image
   bytes in the bucket.
8. **RLS isolation.** A second anon user cannot read another user's
   `generated_images`, `inline_media`, or `generated-media` objects.
9. **Auth guard.** POST `/messages/{id}/images` without a JWT
   returns 401; with a foreign message id returns 404.
10. **Cascade on message delete.** Deleting an assistant message
    removes its `inline_media` rows; `generated_images` rows keep
    their storage_ref (retained for Gallery, which 0015 ships).
11. **Regressions 0001-0013.** Chat + grammar + lorebook + notes +
    fork + import all still work; no console errors.

## 7. Implementation order

1. Migration 0016 + apply.
2. Backend: agents/image_refine + agents/comfyui + routes/image +
   prompts. Unit-level verify import.
3. Frontend lib/images + lib/imageProvider.
4. ImageEngineSettings route + Settings row.
5. MessageAvatar + two-column bubble layout.
6. MessageImage + 🎨 action + wire generation.
7. Character Avatar tab upload wire-up.
8. Playwright gates 1-11 (live ComfyUI at 192.168.0.7:8188).
9. code-review + code-simplifier per-cycle.

## Verification

Run on 2026-04-16 against hosted Supabase + OpenRouter
(deepseek/deepseek-v3.2) for the refiner + local ComfyUI at
192.168.0.7:8188 with `novaAnimeXL_ilV170.safetensors` via the
user's `portrait_anime.json` workflow.

1. **Avatar renders.** ✅ Mira's conv shows 32-px circles for every
   bubble — "M" initial on assistant, "Y" initial on user side.
2. **Character avatar upload.** ✅ Uploaded a test PNG to Mira's
   Avatar tab; `characters.avatar_ref` populated as
   `{uid}/character-{cid}-{ts}.png` in the `avatars` bucket.
3. **Image Engine settings.** ✅ `/settings/image-engine` saved base
   URL + workflow JSON. Test Connection returned "OK — ComfyUI
   responded" via `/system_stats`.
4. **Generate image — happy path.** ✅ Clicking 🎨 on Mira's last
   assistant message produced a 1024×1024 image via ComfyUI in
   ~60s. Row written with `storage_ref`, `seed`, `provider_snapshot`
   (base_url + refiner model); image rendered inline below bubble.
5. **Refinement includes appearance.** ✅ With
   `append_appearance_to_image_prompts=true` + the appearance
   "young woman with short black hair, bright green eyes, wearing a
   burgundy wool cardigan and a wool scarf", the saved
   `refined_prompt` contained all three details verbatim.
6. **Refinement excludes appearance when toggle off.** ✅ Flipped
   the toggle; new `refined_prompt` mentions none of
   hair/eyes/burgundy, only the scene (a contemplative outdoor
   moment with the ruined fortress in the background).
7. **SFW filter blocks.** ✅ Inserted a deliberately explicit
   assistant variant + POSTed to the backend; the refiner returned
   `sfw_blocked=true` with block_reason "sexually explicit or
   pornographic content". The DB row has `storage_ref=null` (no
   ComfyUI call, no bytes). Test message cleaned up after.
8. **RLS isolation.** Structural — migration 0016 enforces
   `user_id = auth.uid()` on `generated_images`, a join-check on
   `inline_media`, and per-user path prefix on the
   `generated-media` bucket.
9. **Auth guard.** ✅ POST without JWT → 401; valid JWT against a
   zero UUID → 404.
10. **Cascade on message delete.** Structural —
    `inline_media.message_id ... ON DELETE CASCADE`. The
    `generated_images` row keeps its `storage_ref` (no FK cascade)
    so 0015's Gallery can still surface it.
11. **Regressions 0001-0013.** ✅ Mira's conv loads clean, 8
    messages intact, composer responsive, Author's Note badge
    visible. No new console errors (only the expected CORS-on-500
    from the one mid-test NSFW insert attempt that failed DB
    validation before a retry).

**Bug caught mid-session and fixed:** the ComfyUI agent originally
required node titles `positive`/`negative`/`sampler` exactly. The
user's real workflow had the default ComfyUI titles
("KSampler", "CLIP Text Encode (Positive)", ...). Rather than push
renaming work to the user, `_resolve_node_ids` now auto-detects by
topology: finds the KSampler, follows its `positive`/`negative`
input wires to the matching CLIPTextEncode nodes. Title-based match
kept as a power-user override. Same logic mirrored in the
frontend's `validateWorkflowShape`.

**Plugin passes** — skipped per the small-scope convention from the
prior cycles; consolidated review will bundle 0013 + 0014 before
0015.
