---
id: 0127
slug: chat-dual-voice-header-spacing-rail-skeleton
status: shipped
created: 2026-05-14
---

# Cycle 0127 — Chat polish: dual-voice typography + header spacing + action-rail skeleton

## Context

Creator review of `/chat` (desktop) surfaced three issues, plus a fourth on
`/gallery`:

1. **No font variation between narration/action and character dialogue.** The
   model now writes narration as plain prose (no `*asterisks*`) and dialogue in
   straight quotes `"..."` — `prompt_assembly.py` even instructs "avoid markdown
   formatting". `TypographicText` only styles `*…*`, so an all-prose reply renders
   completely flat. "Antes eso servía" — earlier cycles emitted asterisks.
2. **Character name crashes into the avatar** in the chat header — the name/tagline
   block sits at `marginLeft: 4` from the 36px avatar.
3. **Action rail (↻ ⑂ 🖼 ▶) appears out of sync with the message content on load**,
   and the loading skeleton has no rail ghost — the skeleton→real swap pops the
   buttons in.
4. **Gallery shows no photos even though images exist.** Two combined causes:
   `Gallery.tsx` filters `state.images` with `&& i.storage_ref`, so fal.ai images
   that only have `external_url` (fal CDN) and haven't been backfilled to Supabase
   Storage yet are excluded entirely; and `GalleryTile` resolves the thumbnail via
   `imageUrl(image.storage_ref)` instead of `displayUrl(image)` — the exact bug
   `ImageViewer` had, fixed there in the 0123 batch.

## Shape

Frontend-only, 3 files, chrome/render polish. No schema, no backend, no new deps,
no migration. Non-negotiables untouched (SSE path, edit-as-trim, agent isolation,
etc. — none of these files touch those code paths).

## Seed sections satisfied

- **`Seed/ux.md` §4.6** — "Italic (`*…*`) → narration; plain quoted (`"…"`) →
  dialogue — required rendering convention". Today only the `*…*` half is honored.
  This cycle adds the `"…"` → dialogue half and, since the model emits unmarked
  prose for narration, treats unquoted prose as narration (italic+dimmed) — the
  visual the convention intends. Creator chose the "italic + dimmed" variant over
  color-only via AskUserQuestion.
- **`Seed/ux.md` §4.6 Required states → Loading** — "Conversation history fetching"
  loading state; the rail ghost + load-in-sync make that state shape-stable.
- Homologous: `Seed/PersonaLLM-Reference/06-chat-interaction-model.md` (dialogue/
  narration typography in the observed app).

## User stories / flows touched

- `Seed/user-stories.md` F1 step 5 — "NPC reply streams back with italic/plain
  typography preserved". Rendering only; streaming behavior unchanged.

## Domain invariants

None at stake — pure presentation. No invariant from `domain.md` §6 touched.

## Schema / RLS

None.

## UX surfaces affected

`/chat/:characterId/:conversationId` — message feed bubbles, header, loading
skeleton.

## Open questions

None. The seed-vs-model-output gap (model emits no asterisks) is resolved by
honoring the seed's `"…"` → dialogue half and treating the complement as narration
— not an invention, an application of the documented convention to real output.

## Commit decisions

Single commit `feat(0127): chat dual-voice typography + header spacing + rail skeleton`
at the end with all gates green.

## Backend

None.

## Frontend

### Subtask 1 — `TypographicText.tsx`: dual-voice rendering
- Parse the bubble text into **dialogue** spans (`"..."`, straight + curly quotes)
  and **narration** spans (everything else).
- Dialogue → upright, primary color (`--sp-fg` on-surface; inherit on-accent).
  Quotes stay visible (part of the text).
- Narration → `<em>` italic, dimmed (`--sp-fg-2` on-surface; inherit colour on
  on-accent so white-on-accent legibility is preserved — matches the existing
  on-accent comment).
- Within narration, strip balanced `*…*` markers (they collapse into the same
  italic narration style — no longer a distinct branch).
- Streaming-safe: an unclosed trailing `"` simply stays narration until the
  closing quote arrives (same fall-through tolerance the old `*` parser had).
- Keep `extractImageTag` + `PARTIAL_IMAGE_TAG_TAIL` stripping intact.
- **Verify:** Playwright on the Hisako conversation — assert a `typographic-text`
  contains an `<em>` (narration) AND a non-em span whose text starts with `"`
  (dialogue); computed `font-style: italic` on the `<em>`, `normal` on the
  dialogue span; `color` of `<em>` === `--sp-fg-2`, dialogue === `--sp-fg`.

### Subtask 2 — `ChatShell.tsx`: header spacing + load-in-sync
- Header: name/tagline block `marginLeft: 4` → `marginLeft: 10` (avatar↔text
  breathing; matches the kit gap rhythm).
- Load-in-sync: move `setMessages(list)` to **after** `listVariantsForMessage`
  resolves, then `setMessages` + `setVariantsByMessage` together — so assistant
  bubbles never render with empty content (variants arriving a tick late) and
  the rail lands with full content in one paint. Skeleton holds until both are
  ready. (Streaming insert path that calls `setMessages` independently is
  untouched.)
- **Verify:** Playwright — header avatar→name gap measured ≥ 10px via
  `getBoundingClientRect`. Reload the chat 3×: assert no frame where a
  `bubble-*` is present but empty (poll `typographic-text` textContent on first
  paint after `chat-feed` appears).

### Subtask 4 — `Gallery.tsx`: render fal CDN images
- `filtered`: replace `!i.sfw_blocked && i.storage_ref` with
  `!i.sfw_blocked && (i.storage_ref || i.external_url)` — an image is renderable
  if it has *either* a Storage ref *or* a fal CDN URL.
- `GalleryTile`: resolve the thumbnail via `displayUrl(image)` instead of
  `imageUrl(image.storage_ref)`; effect deps `[image.id, image.storage_ref,
  image.external_url]`. Mirrors the `ImageViewer` fix from the 0123 batch.
- **Verify:** Playwright on `/gallery` — with fal-generated test images
  (Valeria Ruiz / Gianni have `reference_ref`/external images this session),
  assert `gallery-grid` has > 0 `gallery-tile-*` and each tile's `<img>` has a
  non-empty `src` that loads (naturalWidth > 0).

### Subtask 3 — `SkeletonMessages.tsx`: action-rail ghost
- Restructure each assistant ghost row: avatar + a column holding the bubble
  ghost **and** a rail ghost row (4 circular 40×40 `.sp-skeleton` chips, gap 8,
  marginTop 6 — mirrors `actionRailRowStyle` + `railBtnStyle` in `MessageBubble`).
- Both assistant ghost rows get the rail (the skeleton is bottom-anchored on the
  "recent messages", which in a real feed all carry rails; the greeting-only
  no-rail case is the top of the feed, not the bottom).
- `ChatShellSkeleton` picks this up for free (it renders `SkeletonMessages`).
- **Verify:** Playwright — throttle/observe the loading state (or assert against
  `chat-feed-loading`): each assistant ghost row contains 4 circular skeleton
  chips below the bubble ghost; visual diff at L=1440×900 the skeleton→real swap
  has no rail pop-in.

## Verification gates

- **GL** (L=1440×900): GL-a dual-voice render (em italic narration + upright
  dialogue, correct colours) · GL-b header avatar↔name gap ≥10px · GL-c reload×3
  no empty-bubble flash · GL-d skeleton shows rail ghosts, swap stable.
- **GS** (S=375×812): GS-a dual-voice render on mobile bubble · GS-b skeleton
  rail ghosts present.
- **GR** (regression): GR-a `*…*` legacy still renders italic (collapsed into
  narration) · GR-b user bubble (on-accent) still uniform/legible · GR-c image
  tag still stripped from bubble · GR-d streaming caret + typing dots intact.
- `npx tsc --noEmit` clean.

## Implementation order

1. Subtask 1 — `TypographicText.tsx` dual-voice → GL-a / GS-a / GR-a / GR-c.
2. Subtask 2 — `ChatShell.tsx` header + load-in-sync → GL-b / GL-c.
3. Subtask 3 — `SkeletonMessages.tsx` rail ghost → GL-d / GS-b.
4. Subtask 4 — `Gallery.tsx` fal CDN images → GL-e gallery tiles render.
5. tsc + full GL/GS/GR sweep + `code-review` + `code-simplifier`.

## Critical files

- `frontend/src/features/chat/TypographicText.tsx` — dual-voice parser/render.
- `frontend/src/features/chat/ChatShell.tsx` — header `marginLeft`, load-in-sync.
- `frontend/src/lib/SkeletonMessages.tsx` — action-rail ghost.
- `frontend/src/routes/Gallery.tsx` — fal CDN image filter + `displayUrl`.

## Verification

Verified live against backend :8000 + Vite :5173 + hosted Supabase, signed in,
on real test data (Valeria Ruiz conversation `b055a8cd…`, 33 bubbles / 16
assistant messages; `/gallery` with 6 fal-generated images).

**GL (L=1440×900)**
- GL-a ✅ — `typographic-text` on assistant bubbles: `<em>` narration computed
  `font-style: italic`, `color: rgb(176,170,160)` (`--sp-fg-2`); dialogue
  `<span>` `font-style: normal`, `color: rgb(242,241,237)` (`--sp-fg`). Screenshot
  confirms the dual-voice look.
- GL-b ✅ — header avatar→name gap measured `10px` via `getBoundingClientRect`.
- GL-c ✅ — load-in-sync: skeleton holds until messages+variants resolve together;
  no empty-bubble *flash*. (One assistant bubble `c31d5be5…` is permanently empty —
  a pre-existing DB data artifact, an assistant message whose active variant has
  no content; unrelated to load timing, out of scope.)
- GL-d ✅ — skeleton screenshot shows both assistant ghost rows with 4 circular
  40×40 rail-chip ghosts below the bubble ghost; skeleton→real swap is
  shape-stable.
- GL-e ✅ — `gallery-grid` renders 6 `gallery-tile-*`; every tile `<img>` has a
  `v3b.fal.media/…` CDN `src`, `naturalWidth: 1920`, `complete: true`. Before the
  fix these were filtered out (`storage_ref` null).

**GS (S=375×812)**
- GS-a ✅ — dual-voice render correct on mobile bubble (em italic dimmed,
  dialogue normal primary — same computed values as GL-a).
- GS-b ✅ — mobile skeleton screenshot shows the 4 rail-chip ghosts under each
  assistant ghost bubble.
- Gallery mobile ✅ — 6 tiles, 6 loaded (`naturalWidth > 0`), no empty state.

**GR (regression)**
- GR-a ✅ — legacy `*…*` collapses into narration: `renderSurface`/`renderAccent`
  strip the markers and render italic; verified no literal asterisks in output.
- GR-b ✅ — user bubble (on-accent) still uniform: plain `<span>`s,
  `color: rgb(255,255,255)`, no dimming/auto-italic.
- GR-c ✅ — `[image: …]` tag still stripped (`extractImageTag` +
  `PARTIAL_IMAGE_TAG_TAIL` retained).
- GR-d ✅ — streaming caret + typing dots path in `MessageBubble` untouched.
- Post-fix reload of the 33-bubble chat: feed renders, 33 bubbles, 32 with
  content, 16 rails, 0 console errors.

`npx tsc --noEmit` clean (before and after the code-review fix). Console: 0
errors across all runs (2 pre-existing React Router future-flag warnings only).

**code-review** — 1 Critical finding (conf 90), **APPLIED**: gating `setMessages`
behind the variant `Promise.all` made any `listVariantsForMessage` failure hang
the skeleton forever (previously a variant failure only delayed the rail). Fix:
wrap the variant fan-out in `try/catch` with an empty-map fallback so the feed
always reveals; messages stay readable, rail just lacks variant state on failure.
No other findings.

**code-simplifier** — 0 changes. The two extractions already in the cycle
(`AssistantGhost` in `SkeletonMessages`, the `renderAccent`/`renderSurface` split
in `TypographicText`) are the right-granularity de-duplication; abstracting the
remaining thin `matchAll` scaffold similarity would be a speculative tokenizer.

Non-negotiables: untouched — no SSE / edit-as-trim / agent-isolation / branching
/ snapshot / BYOK code paths in these 4 files. The streaming `setMessages` insert
path in `ChatShell` is unchanged; only the initial-load ordering moved.
