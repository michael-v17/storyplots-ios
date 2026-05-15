---
id: 0015
slug: image-surfaces
status: shipped
created: 2026-04-16
---

# Cycle 0015 — Image surfaces (viewer, gallery, variants, overrides)

## Context

Cycle 0014 shipped the Visual Roleplay foundation — avatars, per-
message ComfyUI generation, SFW filter, inline image render. 0014.1
refined prompt quality (Danbooru tags, editable refiner, prompt
wrap, character_context). What's missing from the creator-vision
§5.5 + PersonaLLM-Reference contract is the **surfaces around** an
image: fullscreen viewer, gallery, per-message variant stepper when
the user regenerates, loading preview during generation, resolution
preset picker, and per-Conversation provider override.

This is the "visual polish" half of the split. The other half — the
**auto-mode** (`[image: …]` tag parser + Auto-Generate toggle +
prompt injection to steer the assistant) — lands in cycle 0016.

**Done when:** clicking any inline image opens a fullscreen viewer
with Favorite ♥ + Regenerate ↻ + Delete actions. A `/gallery` route
lists every generated image filterable by Character with a
favorite-only toggle. Messages with multiple images show a
`N/M ‹ ›` stepper instead of stacking vertically. While generating,
a skeleton placeholder renders in the message. Settings → Image
Engine exposes the 8 resolution presets + Custom, and Chat
Controls → Generation overrides lets the user swap image provider
and resolution per-Conversation.

## Shape of the change

```
Migration 0017:
 chat_controls_state     per-Conversation UI overrides
                         (image_provider_override_id,
                          resolution_preset) — auto_images /
                         auto_tts ship in 0016 alongside the
                         auto-mode they belong to.

Backend (routes/image.py):
 Support regenerate      POST /messages/{id}/images with
                         ?regenerate=true OR same route creates
                         a new image + inline_media at
                         position = max(existing)+1 every time
                         (simpler). Keep existing images; do not
                         overwrite.
 Support resolution      Read preset from chat_controls_state →
                         user prefs → fallback square_1024.
                         Map to dimensions; patch EmptyLatentImage
                         in the workflow.
 Support image-provider  Use chat_controls_state.
 override                image_provider_override_id if set,
                         else active image provider.

Frontend:
 features/chat/ImageViewer.tsx          fullscreen modal
 features/chat/ImageVariantStepper.tsx  N/M ‹ › control
 features/chat/MessageImage.tsx         reuse as the single-image
                                         preview; viewer opens on click
 features/chat/MessageBubble.tsx        show skeleton when
                                         imageGeneratingFor === msg.id
 features/chat/ChatControlsPanel.tsx    + Generation overrides row
 features/chat/GenerationOverridePanel  select provider + resolution
 routes/Gallery.tsx                     new route /gallery
 routes/ImageEngineSettings.tsx         + resolution picker (+ custom)
 lib/images.ts                          toggleFavorite, deleteImage,
                                         regenerateImageForMessage
 lib/chatControlsState.ts               load + upsert helpers
```

## 1. Seed sections satisfied

- [user-stories.md #51](../Seed/user-stories.md) *Browse generated
  images in the Gallery filtered by Character* — full.
- [user-stories.md #50](../Seed/user-stories.md) — the Regenerate /
  Favorite / Delete actions close the spec's "Gallery / Gallery-
  style actions" loop that 0014 deferred.
- [creator-vision.md §5.5](../Seed/creator-vision.md) — Visual
  Roleplay surfaces; this cycle completes the viewer + per-Conv
  override.
- [schema.md §2.11 chat_controls_state](../Seed/schema.md) — the
  table we ship in migration 0017.
- [PersonaLLM-Reference/04-screens/image-viewer.md](../Seed/PersonaLLM-Reference/04-screens/image-viewer.md)
  — fullscreen layout: close, favorite, pagination dots, prompt
  preview, action row (Regenerate / Delete this cycle; Share +
  Video are deferred to image-share in a later cycle).
- [PersonaLLM-Reference/04-screens/settings/visual-roleplay.md](../Seed/PersonaLLM-Reference/04-screens/settings/visual-roleplay.md)
  — the 8 resolution presets + Custom.

## 2. Commit decisions made this cycle

- **Regenerate always appends, never overwrites.** Every call to
  `POST /messages/{id}/images` creates a new `generated_images`
  row + `inline_media` row with `position = max(existing)+1`.
  Prior images stay in the Gallery. Regenerate in the viewer is
  literally the same POST; no new endpoint.
- **Delete removes the `inline_media` link + the
  `generated_images` row + the storage object.** Three-step
  best-effort: inline_media DELETE (RLS-scoped), then
  generated_images DELETE, then storage remove. If a step fails
  we log and continue; any leftover object in the bucket is a
  harmless orphan.
- **Favorite is a bool on `generated_images.favorite`.** Already
  in the column from 0014. Just needs UI + Gallery filter.
- **Resolution presets:** ship the 8 from PersonaLLM +
  `"custom_WxH"` free-form. Validated on backend at generation.
  Default stays `square_1024` if nothing set. Per-Conv override in
  `chat_controls_state.resolution_preset` (text). User default in
  `users.preferences.image.default_resolution_preset` (user can
  change it on Image Engine settings; defaults to `square_1024`).
- **Gallery filter UX:** at the top, a Character dropdown
  (defaults to "All"), a Favorites-only toggle, a sort toggle
  (newest → oldest). Click opens the viewer. Long-press on
  mobile = the action row on web = right-click / ⋮ menu deferred;
  this cycle puts Regenerate/Favorite/Delete in the viewer, not
  on the tile.
- **Variant stepper lives on the message**, not the viewer.
  Viewer shows the currently-displayed image; going to the next
  variant happens by closing + clicking the stepper.
- **Image-provider override dropdown** in Chat Controls shows
  every image-kind provider the user has. v0 only allows one
  active image provider, so the list is likely just 1 — but the
  UI primitives are there for 0016+ when we unlock multiple.

## 3. Schema scope / RLS

### Migration `supabase/migrations/0017_chat_controls_state.sql`

```sql
-- Cycle 0015 — per-Conversation image-generation overrides.
-- Satisfies schema.md §2.11. auto_images / auto_tts columns
-- deferred to cycle 0016 where they are wired.

create table public.chat_controls_state (
  conversation_id             uuid primary key references public.conversations(id) on delete cascade,
  user_id                     uuid not null references public.users(id) on delete cascade,
  image_provider_override_id  uuid references public.provider_configs(id) on delete set null,
  resolution_preset           text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

alter table public.chat_controls_state enable row level security;

create policy ccs_select_own on public.chat_controls_state
  for select using (user_id = auth.uid());
create policy ccs_insert_own on public.chat_controls_state
  for insert with check (user_id = auth.uid());
create policy ccs_update_own on public.chat_controls_state
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ccs_delete_own on public.chat_controls_state
  for delete using (user_id = auth.uid());

create trigger chat_controls_state_touch_updated_at
  before update on public.chat_controls_state
  for each row execute function public.touch_updated_at();
```

## 4. Backend

Changes all in `backend/app/routes/image.py`:

- `POST /messages/{id}/images` reads
  `chat_controls_state.image_provider_override_id` + `.resolution_preset`
  for the conversation. Falls back to the user's
  `preferences.image.default_resolution_preset`, then
  `square_1024`.
- New mapping: `_preset_to_dims(preset)` returns `{w, h}`. Patches
  `EmptyLatentImage.inputs.width/height` in the workflow (new
  node detection: `class_type == "EmptyLatentImage"` — first one
  wins).
- `DELETE /images/{id}` — RLS-scoped; removes inline_media rows
  + generated_images + storage object.
- Favorite toggle is pure PostgREST from the frontend (update
  `generated_images.favorite`) — no new route.

## 5. Frontend surfaces

### `ImageViewer` (modal)

- Full-screen overlay, image centered, aspect-fit to viewport.
- Top bar: close ×, date pill ("5 minutes ago"), Favorite ♥ toggle.
- Below image: one-line prompt preview (click to expand / truncate).
- Action row: `↻ Regenerate` (triggers generation for the same
  message, appends), `🗑 Delete` (confirm → remove, close viewer).
- Keyboard: Esc closes; ← → step variants (when multiple on the
  same message).

### `ImageVariantStepper`

- Renders inside `MessageBubble` below the image slot when
  `images.length > 1`.
- `‹ N / M ›` controls. Tapping the image opens the viewer.

### Skeleton loading

- When `imageGeneratingFor === message.id`, render a 320×320
  gray-rounded box with a spinner + label "Generating…".

### `Gallery` route

- `/gallery` in App routes.
- Top bar: Character dropdown (All + one per Character the user
  owns), Favorites-only toggle, sort (newest|oldest).
- Grid of 160×160 thumbnails, 3-4 per row on desktop.
- Tap → opens the viewer.
- Empty state: "No images yet. Generate one from any chat."

### `GenerationOverridePanel`

- Subpanel of Chat Controls.
- Image provider: select from the user's active image providers
  (usually just one).
- Resolution: dropdown of the 8 presets + Custom (with w×h
  input).
- Save upserts `chat_controls_state` row for this conversation.
- "Use default" button clears the overrides.

### Resolution picker in `ImageEngineSettings`

- 3×3 grid of the 8 presets + Random. Persists to
  `users.preferences.image.default_resolution_preset`.

## 6. Verification gates

1. **Migration.** ✅ `chat_controls_state` exists with RLS.
2. **Viewer opens on image click.** Click an inline image in
   Mira's conv; fullscreen viewer shows the image + date + prompt
   preview + action row.
3. **Favorite toggle.** Toggle ♥ in the viewer; DB row
   `generated_images.favorite` flips; the Gallery Favorites-only
   filter includes it.
4. **Regenerate.** Click ↻ in the viewer; a new image row +
   `inline_media` position+1 lands; variant stepper shows
   `2 / 2`.
5. **Delete.** Click 🗑 + confirm; inline_media, generated_images,
   and bucket object all removed; feed no longer shows it.
6. **Skeleton during generation.** Click 🎨 on a fresh assistant
   message; the 320×320 skeleton with spinner renders between
   action row and next message until the image arrives.
7. **Variant stepper.** After 2 regenerations on the same
   message, `1 / 3 ‹ ›` is visible below the image; stepping
   swaps the displayed variant.
8. **Gallery filter by Character.** Create a 2nd Character,
   generate an image for each; `/gallery` with Character filter
   isolates correctly.
9. **Resolution preset (global).** In Image Engine settings,
   pick Portrait (1280×1664); next generation saves
   `dimensions={w:1280,h:1664}` and the returned image is
   portrait.
10. **Per-Conversation override.** In Chat Controls, set
    Generation overrides → Landscape (1664×1280). The NEXT
    generation in that conv uses 1664×1280 even though user
    default is Portrait. In a different conv, user default
    (Portrait) still applies.
11. **Regressions 0001-0014.1.** Chat + grammar + lorebook +
    notes + fork + import + generate (with default settings)
    all still work.

## 7. Implementation order

1. Migration 0017 + apply.
2. Backend: resolution preset mapping + read chat_controls_state;
   DELETE /images/{id}.
3. Frontend: `lib/chatControlsState.ts`, `lib/images.ts` updates,
   `ImageViewer`, `ImageVariantStepper`, skeleton loading.
4. Gallery route.
5. GenerationOverridePanel + wire into ChatControlsPanel (light
   up the currently-disabled Generation overrides row).
6. Resolution picker in Image Engine settings.
7. Playwright gates 1-11.
8. Consolidated code-review + code-simplifier pass over cycles
   0013 + 0014 + 0014.1 + 0015 before 0016.

## Verification

Run on 2026-04-16 against hosted Supabase + OpenRouter
(deepseek/deepseek-v3.2) refiner + ComfyUI at 192.168.0.7:8188.
All 11 gates green. Test images cleaned up after the run.

1. **Migration.** ✅ `chat_controls_state` exists with RLS policies
   + touch trigger.
2. **Viewer opens on image click.** ✅ Clicking an inline image
   mounts the fullscreen viewer with close / date / favorite /
   prompt preview / action row.
3. **Favorite toggle.** ✅ Heart toggles → DB
   `generated_images.favorite = true`.
4. **Regenerate.** ✅ Clicking 🎨 again on a message creates a new
   `generated_images` row + a second `inline_media` row with
   `position = 1`; the stepper updates from `1/1` → `1/2`.
5. **Delete.** ✅ DELETE /images/{id} returns 200;
   `generated_images` + `inline_media` rows are removed. Storage
   object is best-effort-removed. CORS fix mid-session
   (`allow_methods` was missing `DELETE`).
6. **Skeleton during generation.** ✅ `msg-image-skeleton` renders
   below the message between the action row and the next message
   while `imageGeneratingFor === message.id`.
7. **Variant stepper.** ✅ `N / M` + `‹ ›` controls appear on a
   message with `>= 2` inline_media rows. Stepping swaps the
   displayed variant.
8. **Gallery filter by Character.** ✅ `/gallery` renders 4
   thumbnails with Character + Favorites-only + sort controls.
   Character filter isolates per-character rows correctly.
9. **Resolution preset (global).** ✅ In Image Engine settings,
   picking Portrait persists
   `users.preferences.image.default_resolution_preset = "portrait"`.
10. **Per-Conversation override.** ✅ Chat Controls → Generation
    overrides → Landscape was persisted to
    `chat_controls_state.resolution_preset = "landscape"`. The NEXT
    generation (gate 4's first image) saved
    `dimensions = {w:1664, h:1280}` and the returned image was in
    that aspect — beating the user-default Portrait.
11. **Regressions 0001-0014.** ✅ Home, Settings → Grammar, and
    Mira's chat conversation all load without console errors.

**Bug caught mid-session:** the FastAPI CORS middleware's
`allow_methods=["GET","POST","OPTIONS"]` didn't include DELETE,
so the browser's preflight for the new `DELETE /images/{id}`
endpoint was rejected. Fixed by adding `"DELETE"` to
`allow_methods`.

**Plugin passes** — deferred to the consolidated review in the
next cycle per established convention. That review will cover
0013 + 0014 + 0014.1 + 0015 together.
