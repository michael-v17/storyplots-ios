# Plan: Fase 12 — Device-testing Polish Round

## Summary

Seven issues surfaced from real-device QA on iPhone 14 Pro (post commit
`cc78042`). They cluster around five themes: **(1) persistent image
caching across cold launches**, **(2) persona-avatar UI gap**,
**(3) scenario-start failure that isn't cold start**, **(4) conversation
list lacks message preview**, **(5) chat header is dead-weight + composer
chrome looks unnative**, **(6) settings/profile/persona model is
muddled**, and **(7) several missing tap-to-preview avatar affordances**.

Each is small in isolation but they bunch in two of the most frequent
flows (Home → cast → chat, Settings → profile). One plan, one phase,
one commit per logical group — three commits total.

## User story

As a real-world iOS user opening StoryPlots between Wi-Fi and LTE, on
warm relaunches and after long pauses, with multiple personas and several
characters with active conversations,
I want images to feel locally-cached, conversations to be visually
distinguishable, chat chrome to feel iOS-native, profile/persona scopes
to be coherent, and every prominent avatar to be tappable for preview,
so that the app stops feeling like a beta and starts feeling like
something I'd open daily.

## Problems → Solutions

| # | Problem | Solution |
|---|---|---|
| 1 | AsyncImage re-downloads every launch even when nothing changed. | Add an actor-backed `ImageCache` keyed by **stable storage_ref** that persists decoded bytes to `Caches/StoryPlotsImages/` for 7 days. New `CachedRemoteImage` view used by `AvatarView`, `GalleryTile`, `MessageImageThumbnail`, character tiles. |
| 2 | Persona profile sheet only edits text — no avatar picker / generator. | Add `PhotosPicker` upload + "Generate with AI" button (mirrors `CharacterEditView`'s avatar section). Backend already has `POST /personas/me/generate-avatar` per `seed/api-contract.md` §3.7. |
| 3 | "Couldn't start a conversation" appears on a warm backend. | Surface the actual PostgREST error (not the generic copy) for diagnosis; add the missing required columns to the conversation insert if the error reveals a schema gap; keep the cold-start retry. |
| 4 | `ConversationCardView` in `CharacterChatsView` shows title + relative time but no message preview, so all rows look identical when title defaults to "New Conversation". | Fetch the last user/assistant message for each conversation (single `IN` query) and render a 1-line snippet under the title. |
| 5 | `ChatView` nav-bar title (avatar + character name) is decorative — no edit / preview action. Composer + send button look unstyled. | Make the principal toolbar item tappable → present a `CharacterDetailSheet` with avatar (tappable → fullscreen) + name + tagline + scenario + an "Edit character" CTA. Re-style composer: `bg2` rounded field, brand-gradient circular send, attachment chip aligned. |
| 6 | Profile sheet ("Identity / Appearance / Background") mixes user-level (email, display name) with persona-level (appearance, background). User can have many personas; appearance lives per-persona. | Split into two screens. **ProfileView** = display name + email only. **PersonaListView** = list of personas with "+ Add", each pushes **PersonaEditView** = name + appearance + background + photo. Surface the persona list under Settings → Experience → Personas. |
| 7 | Avatars in CharacterLandingView, CharacterChatsView nav bar, and ChatView nav bar are not tappable for preview. | Wire each to the `AvatarFullscreenViewer` already built for `CharacterEditView`. |

## Seed sections cited

- `seed/api-contract.md` §3.7 (personas/me/generate-avatar), §3.5 (conversations insert)
- `seed/ux.md` §5 (chat), §6 (settings)
- `seed/design.md` §6 (composer chrome), §6.5 (materials)
- `seed/creator-vision.md` §6 (non-negotiables — no UI libs, Theme tokens only, native feel)

## Non-negotiables applicable (creator-vision §6)

- No third-party UI libraries — `ImageCache` is hand-built around `NSCache` + `FileManager`.
- All colors / spacing / fonts via `Theme.*`.
- Swift Concurrency only (actor for cache).
- Backend untouched (using existing endpoints).

---

## Mandatory reading

| Priority | File | Why |
|---|---|---|
| P0 | `storyplots/Core/DesignSystem/AvatarView.swift` | swap of resolution + image loader needs to keep current API |
| P0 | `storyplots/Core/Supabase/SupabaseStorage.swift` | signed URL cache; new cache integrates here |
| P0 | `storyplots/Features/Settings/ProfileView.swift` | structure to split |
| P0 | `storyplots/Features/Chat/ComposerView.swift` | restyle target |
| P0 | `storyplots/Features/Chat/ChatView.swift` | toolbar wiring + sheet present |
| P0 | `storyplots/Features/People/CharacterLandingView.swift` | error surfacing + avatar tap |
| P0 | `storyplots/Features/Sidebar/CharacterChatsView.swift` | preview enrichment + nav bar avatar |
| P0 | `storyplots/Features/Home/ConversationCardView.swift` | snippet placement |
| P1 | `storyplots/Features/People/AvatarFullscreenViewer.swift` | reuse |
| P1 | `storyplots/Features/People/CharacterEditView.swift` | mirror for ProfileView avatar section |
| P1 | `base/frontend/src/lib/conversations.ts` | reference for `character_snapshot` schema shape |

## External documentation

| Topic | Source | Takeaway |
|---|---|---|
| `URLSession` disk cache lifecycle | Apple Developer | per-URL keying; we need per-storage_ref keying — so we layer our own cache |
| `FileManager.default.urls(for: .cachesDirectory)` | Apple Developer | OS may purge `Caches/` under memory pressure; OK as soft cache |
| `NSCache` cost-based eviction | Apple Developer | use `setObject(_:forKey:cost:)` with byte count |

---

## Patterns to mirror

### CACHE_ACTOR
See `SupabaseStorageHelper` for the actor-as-singleton pattern using
`@unchecked Sendable` final class. Same shape for `ImageCache`.

### TASK_ID_INVALIDATION
See `AvatarView.task(id: refKey)` — when `refKey` changes, the prior
load task is cancelled. `CachedRemoteImage` does the same against the
storage_ref key.

### SHEET_PRESENT_FROM_TOOLBAR
See `CharacterEditView`'s `fullScreenCover(isPresented:)` — same idiom
for the character-detail sheet from the ChatView toolbar.

### TYPED_PAYLOADS for Supabase writes
Same as `LorebookPanelView`'s `Insert` struct.

### THEME_TOKEN_USAGE
No hex, no system fonts outside `Theme.FontStyle`, no Material outside
`Theme.Material.*`.

---

## Files to change

### CREATE (8 files)

| File | Purpose |
|---|---|
| `storyplots/Core/Caching/ImageCache.swift` | Actor singleton: in-memory NSCache + disk write under `Caches/StoryPlotsImages/` keyed by SHA-256(storage_ref). 7-day TTL on disk. |
| `storyplots/Core/Caching/CachedRemoteImage.swift` | SwiftUI view replacing `AsyncImage(url:)` where the source has a stable identifier. Falls back to AsyncImage when no identifier. |
| `storyplots/Features/Chat/CharacterDetailSheet.swift` | Sheet presented from ChatView nav-bar tap. Avatar (tappable → fullscreen), name, tagline, scenario, "Edit character" link. |
| `storyplots/Features/Settings/PersonaListView.swift` | List of `user_personas` with "+ New persona" row. |
| `storyplots/Features/Settings/PersonaEditView.swift` | Edit one persona (name + appearance + background + photo upload + AI-generate). |
| `storyplots/Features/Settings/PersonaEditViewModel.swift` | Loads / saves single persona; generate-avatar via `POST /personas/me/generate-avatar`. |
| `storyplots/Features/Chat/ChatHeaderTitle.swift` | Tappable principal toolbar item (avatar + name + tagline/typing). |
| `.claude/PRPs/reports/0012-phase-12-device-polish-report.md` | Written at end. |

### UPDATE (10 files)

| File | Change |
|---|---|
| `storyplots/Core/DesignSystem/AvatarView.swift` | swap `AsyncImage` for `CachedRemoteImage` |
| `storyplots/Features/Gallery/GalleryView.swift` (`GalleryTile`) | same swap |
| `storyplots/Features/Chat/MessageImageRail.swift` (`MessageImageThumbnail`) | same swap |
| `storyplots/Features/People/CharacterCardView.swift` | same swap |
| `storyplots/Features/Sidebar/CharacterChatsView.swift` | add nav-bar avatar tap → `AvatarFullscreenViewer`; enrich rows with message snippet |
| `storyplots/Features/Home/ConversationCardView.swift` | render snippet line under title |
| `storyplots/Features/People/CharacterLandingView.swift` | tap hero avatar → `AvatarFullscreenViewer`; surface real error text |
| `storyplots/Features/Chat/ChatView.swift` | wire tappable toolbar → `CharacterDetailSheet` |
| `storyplots/Features/Chat/ComposerView.swift` | restyle field + send button per `seed/design.md` §6 |
| `storyplots/Features/Settings/ProfileView.swift` | trim to display name + email only |
| `storyplots/Features/Settings/SettingsView.swift` | add `personas` row under Experience |

---

## Step-by-step tasks

### T1 — `ImageCache` actor + `CachedRemoteImage` view (FOUNDATION)

- **Action**: Build the cache + the SwiftUI loader, swap callsites.
- **Implement**:
  - `actor ImageCache`: `func data(for ref: String, fallback: @Sendable () async throws -> Data) async throws -> Data`. SHA-256 keys the on-disk file (`Caches/StoryPlotsImages/<hex>`). Memory tier uses `NSCache<NSString, NSData>` with `totalCostLimit = 100 MB`. Disk read on miss, fallback download on disk miss, all writes back-fill memory + disk. Disk entries older than 7 days are purged on cache init.
  - `CachedRemoteImage`: takes `storageRef: String?` + `signedURLResolver: @Sendable (String) async -> URL?`. On `.task(id: ref)` resolves URL → checks ImageCache → downloads on miss. Renders `Image(uiImage:)` when ready.
  - Replace `AsyncImage` in `AvatarView`, `GalleryTile`, `MessageImageThumbnail`, `CharacterCardView`.
- **Verify**: cold launch → scroll Home → kill app → relaunch → avatars + recent strip appear with no spinner.

### T2 — Persona avatar UI in `PersonaEditView` + Settings rewire

- **Action**: Split profile from persona; build the persona editor with photo upload + AI-generate.
- **Implement**:
  - `ProfileView` shrinks to: read-only email, editable display name, "Sign out" CTA. Drop appearance/background.
  - `PersonaListView`: query `user_personas`, render rows (`AvatarView` + name + "Tap to edit"). Trailing `+` button.
  - `PersonaEditView`: form with name + appearance + background; Avatar section identical to `CharacterEditView`'s — tappable `AvatarView` (132pt) + `PhotosPicker` row + "Generate with AI" button. New avatar refs saved on persona update.
  - `PersonaEditViewModel`: load by `id`, save via direct PostgREST upsert; `generateAvatar()` → `POST /personas/me/generate-avatar` with `{ persona_id }` body.
  - Settings → Experience section gains `Personas` row → `PersonaListView`.
- **Verify**: settings → personas → tap one → upload photo from library → save → row reflects new avatar.

### T3 — Conversation snippet preview + `CharacterChatsView` enrichment

- **Action**: Show 1-line message preview per conversation row + tap nav-bar avatar for preview.
- **Implement**:
  - Augment `SidebarViewModel`-style fetch for `CharacterChatsView`: after loading conversations, query `messages` once with `.in("conversation_id", values: ids).order("created_at", ascending: false)` then group-by-id keeping first per conv. Add a `lastMessagePreview: [String: String]` map.
  - `ConversationCardView` gets an optional `previewText`. Renders below title in `FontStyle.meta`, single-line, `fg3`.
  - `CharacterChatsView` toolbar principal: wrap avatar + name in a Button → `AvatarFullscreenViewer`.
- **Verify**: Gianni → 1 conversation → row shows the first ~80 chars of his last reply; tapping the small nav-bar avatar opens the fullscreen viewer.

### T4 — `ChatHeaderTitle` + `CharacterDetailSheet` + composer restyle

- **Action**: Make the chat header functional and the composer iOS-native.
- **Implement**:
  - `ChatHeaderTitle`: principal toolbar item; tap → present `CharacterDetailSheet`. Hides "typing…" indicator since that's chat state; show only when streaming.
  - `CharacterDetailSheet`: medium detent. Tappable hero avatar (132pt) → fullscreen viewer. Below: name (h2), tagline (meta), scenario (callout). Bottom: brand-gradient capsule "Edit character" → `CharacterEditView`.
  - `ComposerView`: rebuild the text field as `bg2` rounded rect (`Theme.Radius.card`) with 1pt `borderSoft` overlay; send button becomes a 36pt circle with `brandGradient` fill + `fgOnBrand` arrow icon; attach chip aligned with the field's vertical center.
- **Verify**: tap chat header → sheet slides up with all the character info + edit CTA. Composer feels iMessage-adjacent.

### T5 — `CharacterLandingView` error surfacing + hero avatar tap

- **Action**: Reveal the real backend error + add the avatar preview.
- **Implement**:
  - `CharacterLandingView.startError` becomes the localized error string from the catch path, not the generic. Wrap PostgRESTError to expose `.message` and `.code` when present.
  - Hero avatar: wrap in Button → `AvatarFullscreenViewer`.
  - **Investigate** the actual non-cold-start failure: my hypothesis is missing `character_snapshot` (NOT NULL on the table) — web sends a fat snapshot, iOS sends only `character_id + title`. Build a minimal snapshot from the loaded `Character` and include it in the insert if the error confirms.
- **Verify**: tap a scenario → if real schema-level error, see it; if cold start, see retry copy; if it works after the fix, full chat opens.

---

## Cold-start handling (already done, kept for reference)

- App-launch fire-and-forget `GET /health` (`storyplotsApp.init`).
- `createConversation` retries once after 2.5s with "Waking up the backend…" label.
- T5 builds on this — only shows a real error when both attempts fail with a non-timeout response.

---

## Testing strategy

### Unit tests

| Test | Input | Expected |
|---|---|---|
| `ImageCacheTests.diskHitReturnsBytes` | seed disk file then `data(for:)` | returns cached bytes, no fallback call |
| `ImageCacheTests.diskMissPopulatesBoth` | empty cache + fallback closure | memory + disk both contain bytes after |
| `ImageCacheTests.expiryPurgesOldFiles` | seed file with mtime > 7d | purge on init removes it |
| `CharacterChatsViewModelTests.previewSnippets` | 3 convs + 5 messages | each conv keyed to its newest message text |

### Manual flows on device

- [ ] Cold launch on LTE → Home loads, avatars appear from cache.
- [ ] Pull-refresh Home → no re-download for unchanged characters.
- [ ] Open Settings → Profile shows only display name + email; Experience has Personas.
- [ ] Personas → add one with photo from library → row updates.
- [ ] Open chat → tap header → sheet with avatar + edit CTA.
- [ ] Composer: type, send, generate image — chrome looks coherent with rest of app.
- [ ] Sidebar → Gianni → conversation row shows snippet of his last message.
- [ ] CharacterChatsView nav-bar avatar tap → fullscreen viewer.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Image cache disk path lifetime — iOS may purge Caches/ aggressively under low storage. | Medium | Low | Fall through to network on miss. By design. |
| Persona schema differences vs character: avatar_ref may be `photo_ref` in `user_personas` table. | High | Medium | Verify column name from `seed/schema.md` or by inspecting an existing row; adapt the upsert. |
| Backend `/personas/me/generate-avatar` may need different body shape than `/characters/{id}/generate-avatar`. | Medium | Low | Check `base/backend/app/routes/personas.py` shape during T2. |
| `character_snapshot` may be required at DB level — would explain the warm-backend failure. | High | Medium | Build snapshot from loaded `Character`; T5 confirms with surfaced error. |
| Composer restyle may break voice keyboard / focus behavior. | Low | Medium | Preserve `TextField` focus modifiers and `submitLabel`; only restyle background + send button. |

---

## Commit grouping

1. **`feat(cache): persistent on-device image cache via ImageCache + CachedRemoteImage`** — T1 only.
2. **`fix(profile): split user profile from persona; persona editor with avatar`** — T2.
3. **`polish(chat): tappable header sheet, native composer, snippet previews, avatar tap`** — T3 + T4 + T5.

---

## Self-review

- Covers all 7 issues from the device QA report? ✅
- Cites seed sections? ✅ (api-contract §3.7 §3.5, ux §5 §6, design §6 §6.5, creator-vision §6).
- Non-negotiables respected? ✅ (no third-party libs, Theme tokens only, Swift Concurrency only, backend untouched).
- Subtasks atomic with executable Verify? ✅.
- Risks identified + mitigations? ✅.
- Reasonable scope for one cycle? Medium-XL — 8 new files, 10 modified, ~1200 lines. Single commit per group keeps blast radius local.
- Self-review per AUTONOMY.md §5 — passing.
