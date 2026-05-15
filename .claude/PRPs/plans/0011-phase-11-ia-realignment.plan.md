# Plan: Fase 11 — IA Realignment + Missing Surfaces

## Summary

Reemplazar `TabView` (3 tabs: Home/People/Settings) por `NavigationSplitView`
con sidebar/drawer espejando la web. Construir 6 surfaces que el seed prometía
"bajo Settings" pero nunca aterrizaron: **Gallery**, **Grammar dashboard**,
**Character Import**, **Visual Roleplay Settings**, **Prompt Editor**,
**Memory Settings** (split de MemoryEngine). Reorganizar **Home** alrededor
de Recent Characters + Grammar widget + HomeNudge en vez de lista de chats.
Resolver el feedback "no veo el logo por ningún lado" anclando el wordmark
permanentemente en el header del sidebar.

## User Story

As a StoryPlots iOS user,
I want todas las surfaces que existen en la web (Gallery, Grammar dashboard, Visual Roleplay, etc.) accesibles desde un sidebar con navegación clara y el logo siempre visible,
so that el app iOS sienta parity funcional con la web sin ser un port literal.

## Problem → Solution

**Current**: 3 tabs (Home = chats flat list with repeated characters; People = grid; Settings = hub con 9 sub-screens construidas y 6 prometidas sin construir). Logo invisible fuera de SignIn/Settings/About. Gallery, Grammar dashboard, Character Import, Visual Roleplay, Prompt Editor, Memory user-settings — ausentes.

**Desired**: `NavigationSplitView` con sidebar/drawer (iPhone se colapsa con hamburger button). Sidebar header carga wordmark permanente. 3 destinations top-level (Home / Characters / Gallery). Recent Chats agrupados por character en la sidebar. Persona card + Settings + Sign out en el footer. Las 6 surfaces faltantes construidas y accesibles.

## Metadata

- **Complexity**: XL (≈30 files, ~2500 lines including new + modified)
- **Source PRD**: `seed/roadmap.md` §Fase 11 (recién agregada en commit `4ba72df`)
- **PRD Phase**: Fase 11 — IA Realignment + Missing Surfaces
- **Estimated Files**: 25 new + 8 modified

---

## Seed sections (mandatory cites)

- `seed/ux.md` §2 (ARCH-001 rewrite) — NavigationSplitView design
- `seed/creator-vision.md` §6.6 + §6.11 — native-feel only en interactions; paridad estructural no negociable
- `seed/roadmap.md` §Fase 11 — exit criteria
- `seed/api-contract.md` §3.7 (images), §3.7.1 (gallery), §3.9 (insights/grammar dashboard), §3.5 (character-refine)
- `seed/design.md` §3 (tokens), §6.5 (materials)

## Non-negotiables aplicables (creator-vision §6)

- No web views (todo SwiftUI)
- No tokens hardcoded (todo Theme.*)
- Swift Concurrency, no Combine
- Backend intact, nuevos endpoints solo bajo `/api/v2/ios/`
- §6.11: paridad estructural — toda surface web vive en iOS

---

## UX Design

### Before (Fase 0–10 estado)

```
┌─────────────────────────────────────┐
│ Status bar (sometimes black void)   │
│ Custom header / large title         │
│                                     │
│   Chat #1 (Dra. Hisako)             │
│   Chat #2 (Dra. Hisako)             │
│   Chat #3 (Dra. Hisako)             │
│   Chat #4 (Tomás)                   │
│   …flat repeated…                   │
│                                     │
├─────┬─────┬─────────────────────────┤
│Home │Peopl│ Settings                │
└─────┴─────┴─────────────────────────┘

Settings only: 9 of 15 web sub-screens
No Gallery anywhere
No Grammar dashboard (only the settings page)
No logo visible
```

### After (Fase 11)

```
┌──────────┬───────────────────────┐
│ ☰        │  Home / Characters /  │
│ StoryPl. │  Gallery / Detail     │
│ ─────    │                       │
│ 🏠 Home  │  Recent Characters    │
│ 👥 Chars │  [horizontal scroll]  │
│ 🖼 Gal'y │                       │
│ ─────    │  Grammar widget       │
│ RECENT   │  [accuracy + master]  │
│ [M] Maya │                       │
│ ·3 chats │  HomeNudge if empty   │
│ [T] Tomás│                       │
│ ·2 chats │                       │
│ [H] Hisak│                       │
│ ·4 chats │                       │
│ ─────    │                       │
│ ◯ Persona│                       │
│ ⚙ Settin │                       │
│ ↩ SignOut│                       │
└──────────┴───────────────────────┘

iPhone: sidebar swipes in / out via gesture + hamburger
iPad: side-by-side automatic
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Top-level nav | TabView 3 tabs | Sidebar 3 destinations | Hamburger on iPhone |
| Logo visibility | Only SignIn + Settings small | Sidebar header permanent | Resolves "no veo logo" |
| Open chat | Tap Home row | Tap Recent group → CharacterChatsView → tap chat | More taps but no repeated rows |
| Find character | People tab | Characters destination OR sidebar group | Two paths OK |
| See images | None visible | Gallery destination | New surface |
| See grammar stats | None visible | Home widget OR Settings → Grammar dashboard link | New surface |
| Import character | None visible | Characters + Menu → Import | New flow |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| **P0** | `seed/ux.md` | §2 (the rewritten block) | Defines target IA |
| **P0** | `seed/roadmap.md` | §Fase 11 | Exit criteria + subtask list |
| **P0** | `seed/creator-vision.md` | §6.6, §6.11 | Non-negotiables that gate decisions |
| P0 | `storyplots/App/MainTabView.swift` | all | What we're replacing |
| P0 | `storyplots/App/storyplotsApp.swift` | all | Entry point to swap |
| P0 | `storyplots/App/RootView.swift` | all | Auth gate wrapper |
| **P1** | `base/frontend/src/features/shell/Sidebar.tsx` | all | Web sidebar reference patterns |
| **P1** | `base/frontend/src/features/shell/RecentChats.tsx` | all | Grouping behaviour reference |
| **P1** | `base/frontend/src/routes/Gallery.tsx` | all | Gallery layout + delete UX |
| **P1** | `base/frontend/src/routes/Grammar.tsx` | all | Dashboard layout |
| **P1** | `base/frontend/src/routes/CharacterImport.tsx` | all | PNG card import flow |
| **P1** | `base/frontend/src/routes/VisualRoleplaySettings.tsx` | all | Settings form |
| **P1** | `base/frontend/src/routes/PromptEditor.tsx` | all | Editor surface |
| **P1** | `base/frontend/src/routes/MemorySettings.tsx` | all | User-facing memory toggles |
| P2 | `storyplots/Features/Home/HomeView.swift` | all | Pattern to subset for the rebuild |
| P2 | `storyplots/Features/People/PeopleView.swift` | all | Reuse grid for Characters destination |
| P2 | `storyplots/Features/Settings/SettingsView.swift` | all | Hub pattern + brandLabel helper |
| P2 | `storyplots/Core/DesignSystem/Theme.swift` | all | Tokens to use |
| P2 | `storyplots/Core/DesignSystem/AvatarView.swift` | all | Signed-URL pattern |
| P2 | `storyplots/Core/DesignSystem/BrandTopWash.swift` | all | Wash modifier |
| P2 | `storyplots/Core/Supabase/SupabaseStorage.swift` | all | Storage helper |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| `NavigationSplitView` on iPhone | Apple Developer / WWDC 2024 (iOS 18+ refinements) | Use `.navigationSplitViewStyle(.balanced)` o `.automatic`; sidebar auto-collapses; selection driven by `@State` or `@SceneStorage` |
| `PhotosPicker` SwiftUI | Apple Developer | `import PhotosUI` + `PhotosPicker(selection:matching:)` returns `PhotosPickerItem`, load via `loadTransferable(type: Data.self)` |
| PNG tEXt chunk parsing | iOS `CGImageSource` API | `CGImageSourceCopyPropertiesAtIndex` returns dict with `kCGImagePropertyPNGDictionary` → key `tEXt` or `tEXtChunks` array of `{keyword, text}` |
| Character Card v1/v2/v3 schemas | community spec (chub.ai, RisuAI, Tavern) | v1 = flat `{name, description, personality, scenario, first_mes, mes_example}`; v2 = `{spec: "chara_card_v2", data: {…}}`; v3 = `{spec: "chara_card_v3", data: {…}}`. Backend `/character-refine` accepts all three via `format` field. |

No external research needed beyond the above — feature uses established internal patterns.

---

## Patterns to Mirror

### SWIFTUI_VIEW_NAMING
```swift
// SOURCE: storyplots/Features/Home/HomeView.swift:4
struct HomeView: View {
    @State private var model: HomeViewModel
    // ...
}
```
- `*View` suffix for SwiftUI views
- ViewModel injected via `@State private var model:` (Observable, MainActor)
- Private state, public init

### OBSERVABLE_VIEWMODEL
```swift
// SOURCE: storyplots/Features/People/PeopleViewModel.swift:7-25
@MainActor
@Observable
final class PeopleViewModel {
    enum LoadState: Sendable, Equatable {
        case idle, loading, loaded, error(String)
    }
    private(set) var loadState: LoadState = .idle
    private(set) var characters: [Character] = []
    private let client: SupabaseClient
    init(client: SupabaseClient) { self.client = client }
}
```

### SUPABASE_QUERY
```swift
// SOURCE: storyplots/Features/People/PeopleViewModel.swift:34-46
do {
    let rows: [Character] = try await client
        .from("characters")
        .select("id, name, tagline, avatar_ref, accent_color, ...")
        .order("updated_at", ascending: false)
        .execute()
        .value
    self.characters = rows
    self.loadState = .loaded
} catch {
    self.loadState = .error(error.localizedDescription)
}
```

### BACKEND_POST_AUTHENTICATED
```swift
// SOURCE: storyplots/Features/Chat/ChatViewModel.swift:runRequestImage
let session = try await client.auth.session
let jwt = session.accessToken
var request = URLRequest(url: BackendConfig.url
    .appendingPathComponent("characters")
    .appendingPathComponent(id)
    .appendingPathComponent("generate-avatar"))
request.httpMethod = "POST"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
request.httpBody = try JSONSerialization.data(withJSONObject: body)
request.timeoutInterval = 120
let (data, response) = try await URLSession.shared.data(for: request)
```

### THEME_TOKEN_USAGE
```swift
// SOURCE: storyplots/Features/Settings/SettingsView.swift:brandLabel
Label {
    Text(title).foregroundStyle(Theme.Color.fg)
} icon: {
    Image(systemName: systemImage).foregroundStyle(Theme.Color.brand1)
}
```
NO hex literals. All colors/spacing/fonts via `Theme.*`.

### EMPTY_STATE
```swift
// SOURCE: storyplots/Core/DesignSystem/EmptyStateView.swift
EmptyStateView(
    systemImage: "photo.stack",
    title: "No images yet",
    message: "Generate one inside a chat — they show up here.",
    actionTitle: "Browse characters",
    onAction: { /* nav */ }
)
```

### SHIMMER_SKELETON
```swift
// SOURCE: storyplots/Core/DesignSystem/Shimmer.swift
LazyVGrid(columns: columns) {
    ForEach(0..<6, id: \.self) { _ in CharacterSkeletonCard() }
}
```

### HAPTICS
```swift
// SOURCE: storyplots/Core/Haptics/Haptics.swift
Haptics.impact(.medium)       // on tap
Haptics.selection()           // on picker change
Haptics.notify(.success)      // on save
Haptics.notify(.warning)      // on destructive confirm
```

### AVATAR_VIEW
```swift
// SOURCE: storyplots/Core/DesignSystem/AvatarView.swift
AvatarView(
    avatarRef: character.avatar_ref,
    name: character.name,
    accent: accent,
    size: 32,
    ringWidth: 1.5
)
```
Resolves signed URL internally via `SupabaseStorageHelper.shared.avatarURL(path:)`.

### MATCHED_TRANSITION
```swift
// SOURCE: storyplots/Features/Home/HomeView.swift
NavigationLink {
    Destination()
        .navigationTransition(.zoom(sourceID: "char-\(id)", in: ns))
} label: {
    Card().matchedTransitionSource(id: "char-\(id)", in: ns)
}
```

### BRAND_WASH
```swift
// SOURCE: storyplots/Core/DesignSystem/BrandTopWash.swift
SomeRootView()
    .background(Theme.Color.bg)
    .brandTopWash()
```

### OSLOG_LOGGER
```swift
// SOURCE: storyplots/Features/Chat/ChatViewModel.swift:7
private let chatLog = Logger(subsystem: "com.storyplots.ios", category: "chat-stream")
// Use:
chatLog.info("event=\(name, privacy: .public)")
chatLog.error("failure: \(error.localizedDescription, privacy: .public)")
```

### SHEET_DETENTS
```swift
// SOURCE: storyplots/Features/Chat/Panels/MemoryPanelView.swift
NavigationStack {
    content
}
.presentationDetents([.medium, .large])
```

### TYPED_PAYLOADS
```swift
// SOURCE: storyplots/Features/Chat/Panels/LorebookPanelView.swift
struct Insert: Encodable {
    let conversation_id: String
    let title: String
    let keywords: [String]
    let body: String
}
try await client.from("lorebook_entries").insert(Insert(...)).execute()
```
Encodable structs declared inline at the use site — never `[String: Any]` for writes.

---

## Files to Change

### CREATE (25 files)

| File | Purpose |
|---|---|
| `storyplots/App/AppShellView.swift` | Root `NavigationSplitView` replacing `MainTabView` |
| `storyplots/App/SidebarView.swift` | Drawer content: wordmark, destinations, recents, footer |
| `storyplots/App/SidebarViewModel.swift` | Loads chars + grouped chats + persona for sidebar |
| `storyplots/App/SidebarDestination.swift` | Enum: home, characters, gallery |
| `storyplots/Features/Sidebar/RecentChatsList.swift` | Grouped-by-character list view |
| `storyplots/Features/Sidebar/SidebarPersonaCard.swift` | Footer persona card |
| `storyplots/Features/Sidebar/CharacterChatsView.swift` | Push from Recent row → list of chats for that character |
| `storyplots/Features/Home/HomeViewModelV2.swift` *(or refactor existing)* | Reorient model to load characters + grammar widget data |
| `storyplots/Features/Home/RecentCharactersStrip.swift` | Horizontal scroll of 5 character cards |
| `storyplots/Features/Home/GrammarWidget.swift` | Master toggle + accuracy snapshot |
| `storyplots/Features/Home/HomeNudge.swift` | Editorial card when characters.isEmpty |
| `storyplots/Features/Gallery/GalleryView.swift` | Top-level destination |
| `storyplots/Features/Gallery/GalleryViewModel.swift` | Query `generated_images` |
| `storyplots/Features/Grammar/GrammarDashboardView.swift` | Accuracy gauge + recent corrections + insights button |
| `storyplots/Features/Grammar/GrammarDashboardViewModel.swift` | Loads aggregates + corrections |
| `storyplots/Features/People/CharacterImportSheet.swift` | PHPicker + PNG parser + /character-refine |
| `storyplots/Core/Importers/CharacterCardParser.swift` | PNG tEXt chunk parser (v1/v2/v3) |
| `storyplots/Features/Settings/VisualRoleplaySettingsView.swift` | New settings sub-screen |
| `storyplots/Features/Settings/PromptEditorView.swift` | New settings sub-screen |
| `storyplots/Features/Settings/MemorySettingsView.swift` | Split from MemoryEngine |
| `.claude/PRPs/plans/0011-phase-11-ia-realignment.plan.md` | This plan |
| `.claude/PRPs/reports/0011-phase-11-ia-realignment-report.md` | Created at end |
| `storyplotsTests/SidebarTests.swift` | Sidebar load + grouping tests |
| `storyplotsTests/CharacterCardParserTests.swift` | PNG parser tests |
| `storyplotsTests/GalleryViewModelTests.swift` | Query + delete tests |

### UPDATE (8 files)

| File | Change |
|---|---|
| `storyplots/App/storyplotsApp.swift` | Entry point → `AppShellView` |
| `storyplots/App/RootView.swift` | Replace `MainTabView()` with `AppShellView()` |
| `storyplots/App/MainTabView.swift` | DELETE after smoke |
| `storyplots/Features/Home/HomeView.swift` | Rebuild around new strip + widget |
| `storyplots/Features/Home/HomeViewModel.swift` | Add character loading + grammar snapshot |
| `storyplots/Features/People/PeopleView.swift` | Rename label "People" → "Characters"; add Import to + Menu |
| `storyplots/Features/People/PeopleHeaderView.swift` | Label change |
| `storyplots/Features/Settings/SettingsView.swift` | Add rows: Visual Roleplay, Prompt Editor, Memory (settings) |
| `storyplots/Features/Settings/EngineSettingsViews.swift` | Split MemoryEngine (provider/model only) |

## NOT Building

- **Pixel-perfect web mirror.** iOS interactions stay native (sheets, push, swipe, long-press).
- **Custom drawer with manual gesture handling.** Trusting `NavigationSplitView` system behavior on iPhone.
- **LaunchScreen storyboard with wordmark.** Pending separate cycle (needs Xcode UI work).
- **Full snapshot test harness with swift-snapshot-testing SPM dep.** Manual RenderPreview verification of critical surfaces only.
- **iPad-specific tuning.** Verified iPhone 17 Pro Max only; iPad gets default `NavigationSplitView` behavior.
- **Multi-persona switching.** Single persona model from Fase 9; out of scope.
- **Insights run UI loop.** "Run insights" button posts and returns; no streaming progress.
- **Character Card v3 advanced features** (group cards, embeds). Parse `name + description + scenario + first_mes` only — enough to populate the edit form.

---

## Step-by-Step Tasks

### Task 1: AppShellView + SidebarDestination enum

- **ACTION**: Create the new root container that hosts `NavigationSplitView`.
- **IMPLEMENT**:
  - `enum SidebarDestination: String, Hashable, CaseIterable { case home, characters, gallery }`
  - `struct AppShellView: View` with `@State private var selection: SidebarDestination? = .home`, `@State private var sidebarVisibility: NavigationSplitViewVisibility = .automatic`
  - Body: `NavigationSplitView(columnVisibility: $sidebarVisibility) { SidebarView(selection: $selection, client: ...) } detail: { NavigationStack { destinationView } }`
  - `destinationView` switches on `selection` → `HomeView` / `PeopleView` / `GalleryView`.
- **MIRROR**: SWIFTUI_VIEW_NAMING, OBSERVABLE_VIEWMODEL
- **IMPORTS**: `SwiftUI`, `Supabase`
- **GOTCHA**: On iPhone, `NavigationSplitView` collapses to `.detailOnly` by default; the hamburger button appears in nav-bar leading automatically. Don't `.toolbar(.hidden, for: .navigationBar)` on the inner views or hamburger disappears.
- **VALIDATE**: Build green; app launches; swipe-from-edge or tap hamburger opens drawer.

### Task 2: SidebarViewModel (loads chars + groups chats + persona)

- **ACTION**: ViewModel that powers the sidebar.
- **IMPLEMENT**:
  - `@MainActor @Observable final class SidebarViewModel`
  - State: `characters: [Character]`, `conversationsByCharacter: [String: [Conversation]]`, `persona: UserPersona?`, `loadState: LoadState`.
  - `func load() async`: parallel fetch characters + conversations (order by `last_message_at desc`) + persona (first row).
  - `func groupedRows() -> [GroupedCharacterRow]` returns `[{character, count, lastMessageAt}]` sorted by lastMessageAt desc.
  - `struct GroupedCharacterRow: Identifiable { let character: Character; let conversations: [Conversation]; var id: String { character.id }; var lastMessageAt: String { conversations.first?.last_message_at ?? conversations.first?.updated_at ?? "" } }`
- **MIRROR**: OBSERVABLE_VIEWMODEL, SUPABASE_QUERY
- **IMPORTS**: `Foundation`, `Observation`, `Supabase`, `SwiftUI`
- **GOTCHA**: Conversations with `character_id == nil` go to a "Misc" group (or skipped — choose skip for MVP).
- **VALIDATE**: With seed data showing repeated characters, `groupedRows().count <= characters.count`.

### Task 3: SidebarView

- **ACTION**: The drawer content: wordmark header, destinations, recents, footer.
- **IMPLEMENT**:
  - Header: `Image("Wordmark").resizable().scaledToFit().frame(maxHeight: 44)`, padding.
  - Section "Destinations": `List(selection: $selection)` with 3 NavigationLink-like rows (use `Label(SidebarDestination.title, systemImage: SidebarDestination.icon)`). Tagged with the enum case.
  - Section "Recent": for each grouped row, a row with `AvatarView(avatarRef:, name:, accent:, size: 32)` + name + `Text("\(count) chats").font(meta).foregroundStyle(fg3)`. Tap → set selection to a sentinel that pushes `CharacterChatsView` on the detail stack via `path` binding (or use `@SceneStorage` Int + tap pushes by setting path).
  - Section "footer": `SidebarPersonaCard`, `Settings` link, `Sign out` button.
- **MIRROR**: AVATAR_VIEW, THEME_TOKEN_USAGE, HAPTICS, EMPTY_STATE
- **IMPORTS**: `SwiftUI`, `Supabase`
- **GOTCHA**: When iPhone drawer dismisses on selection, we want destination changes to dismiss but Recent row taps push WITHIN the current detail stack. Solve via two paths: destination tap = update `selection` binding; Recent tap = use a `@Binding var path: NavigationPath` from AppShell, append `CharacterChatsView` payload + dismiss drawer.
- **VALIDATE**: Wordmark visible at top; destinations highlight current selection; tapping Recent row dismisses drawer and shows CharacterChatsView.

### Task 4: CharacterChatsView

- **ACTION**: List of chats for a single character (pushed from sidebar Recent row).
- **IMPLEMENT**:
  - `struct CharacterChatsView: View` taking `character: Character`, `conversations: [Conversation]`, `client: SupabaseClient`.
  - List with `ConversationCardView` per conversation (already exists). Tap → push `ChatView`.
  - Title: character name, with avatar + accent dot in nav bar.
- **MIRROR**: SWIFTUI_VIEW_NAMING, MATCHED_TRANSITION
- **IMPORTS**: `SwiftUI`, `Supabase`
- **GOTCHA**: This view is pushed onto the detail stack via `NavigationPath`. Don't wrap in another `NavigationStack`.
- **VALIDATE**: Pushed view shows correct conversations; tapping one pushes `ChatView`.

### Task 5: HomeView rebuild

- **ACTION**: Replace conversation list with Recent Characters strip + Grammar widget + HomeNudge.
- **IMPLEMENT**:
  - `RecentCharactersStrip` — `ScrollView(.horizontal)` of 5 character cards (use existing `CharacterCardView` at width 200).
  - `GrammarWidget` — accuracy gauge + master toggle, reads `grammar_aggregates` + `users.preferences.grammar.master`.
  - `HomeNudge` — when `characters.isEmpty`, show editorial card with "Create character" CTA.
  - Update `HomeViewModel` to load characters + grammar snapshot in parallel (drop conversations from this model).
- **MIRROR**: BRAND_WASH, EMPTY_STATE, SUPABASE_QUERY
- **IMPORTS**: `SwiftUI`, `Supabase`
- **GOTCHA**: Grammar widget needs `loadAggregate` equivalent — port from `base/frontend/src/lib/insights.ts`. For MVP just query `grammar_aggregates.last_aggregate_pct` if column exists; else soft-fail with "—".
- **VALIDATE**: Home shows characters horizontal, widget vertical below, NudgeCard when empty.

### Task 6: GalleryView + GalleryViewModel

- **ACTION**: New top-level destination.
- **IMPLEMENT**:
  - Query: `generated_images` ordered by `created_at desc`, fields `id, message_id, conversation_id, character_id, prompt, refined_prompt, dimensions, storage_ref, external_url, engine, style, sfw_blocked, created_at`.
  - Render: `LazyVGrid(columns: 2)` of square thumbnails (`MessageImageThumbnail` extracted as standalone).
  - Tap → present `ImageViewer` fullscreen.
  - Long-press → confirmation dialog → `DELETE /images/{id}` via backend (mirrors `ChatViewModel.deleteImage`).
  - Empty state when no images.
- **MIRROR**: SUPABASE_QUERY, BACKEND_POST_AUTHENTICATED, THEME_TOKEN_USAGE, EMPTY_STATE, MATCHED_TRANSITION
- **IMPORTS**: `SwiftUI`, `Supabase`
- **GOTCHA**: `MessageImageThumbnail` lives in `Features/Chat/MessageImageRail.swift` — extract or duplicate as `GalleryThumbnail`.
- **VALIDATE**: Grid renders signed-URL images; tap opens viewer; delete works against backend.

### Task 7: GrammarDashboardView + ViewModel

- **ACTION**: Standalone dashboard (distinct from `GrammarSettingsView` which is config).
- **IMPLEMENT**:
  - Load `grammar_aggregates` (1 row) + `grammar_corrections` last 20 ordered desc.
  - UI: large accuracy ring (Swift Charts `Gauge` or custom `Circle().trim`) + top-3 error categories (capsules) + last 20 corrections list + "Run insights now" button → `POST /insights/run` with auth.
  - Push target from `GrammarWidget` tap on Home + from `Settings → Writing → Grammar` (currently routed to GrammarSettings — make it a hub with two links: "Settings" + "Dashboard").
- **MIRROR**: SUPABASE_QUERY, BACKEND_POST_AUTHENTICATED, THEME_TOKEN_USAGE
- **IMPORTS**: `SwiftUI`, `Charts`, `Supabase`
- **GOTCHA**: `grammar_aggregates` row may not exist for new users — handle nil. `error_categories` could be empty.
- **VALIDATE**: Dashboard renders with seed data; "Run insights" returns 200.

### Task 8: CharacterCardParser + CharacterImportSheet

- **ACTION**: PNG tEXt chunk parsing + import flow.
- **IMPLEMENT**:
  - `enum CharacterCardFormat: String { case v1, v2, v3 }`
  - `struct ParsedCharacterCard { let format: CharacterCardFormat; let rawCard: [String: Any] }`
  - `enum CharacterCardParserError: Error { case noTextChunks, decodeFailed, unsupportedFormat }`
  - Parser uses `CGImageSourceCreateWithData(data, nil)` → `CGImageSourceCopyPropertiesAtIndex(0)` → reads `kCGImagePropertyPNGDictionary` → looks for `tEXt` / `tEXtChunks` / common keys (`chara`, `ccv3`, etc.).
  - The well-known card-export convention: keyword `chara` holds base64-encoded JSON. Decode base64 → JSON → detect format by `spec` field.
  - Sheet: PhotosPicker → load Data → parser → POST `/character-refine` with `{raw_card, format, group_size: 1}` → on success, present `GeneratedCharacterReviewSheet` (reuse from `CharacterGenerateSheet.swift`) prefilled with the refined result.
- **MIRROR**: TYPED_PAYLOADS, BACKEND_POST_AUTHENTICATED, OSLOG_LOGGER
- **IMPORTS**: `SwiftUI`, `PhotosUI`, `CoreGraphics`, `ImageIO`, `Supabase`, `OSLog`
- **GOTCHA**: PhotosPicker on iOS 26 returns `PhotosPickerItem` — load via `await item.loadTransferable(type: Data.self)`. Some PNG cards put the chunk under non-standard keys; iterate dict instead of looking up specific key.
- **VALIDATE**: Pick a known v2 PNG card → refine response decoded → review sheet appears.

### Task 9: VisualRoleplaySettingsView + PromptEditorView + MemorySettingsView

- **ACTION**: Three new settings sub-screens.
- **IMPLEMENT**:
  - **VisualRoleplaySettingsView**: Form with `Toggle("Auto mode")`, `Picker("POV", [first_person, third_person])`, `TextEditor("Custom instructions")`. Persist to `users.preferences.visual_roleplay` via the same `PreferenceFamilyStore` helper in `WritingSettingsViews.swift`.
  - **PromptEditorView**: `TextEditor(text: $template).font(.body.monospaced())` with a help footer listing `{{char}}`, `{{user}}`, `{{persona}}`, `{{scenario}}`. Persist to `users.preferences.prompt_template` (string).
  - **MemorySettingsView**: user-facing toggles (master enabled, retention days stepper, extraction frequency picker). Split from `MemoryEngineSettingsView` which keeps provider/model/embedding only.
- **MIRROR**: TYPED_PAYLOADS, SUPABASE_QUERY, THEME_TOKEN_USAGE
- **IMPORTS**: `SwiftUI`, `Supabase`
- **GOTCHA**: `users.preferences` is JSONB; load → mutate dict → write entire dict back per `PreferenceFamilyStore.save`. Already implemented; reuse.
- **VALIDATE**: Each view loads + saves; values persist across app relaunch.

### Task 10: Wire SettingsView with new rows + Settings → Grammar hub

- **ACTION**: Update `SettingsView` Form to surface the new sub-screens.
- **IMPLEMENT**:
  - Add row "Visual Roleplay" → `VisualRoleplaySettingsView`.
  - Add row "Prompt editor" → `PromptEditorView`.
  - Add row "Memory" (settings) → `MemorySettingsView`.
  - Existing "Memory" stays as "Memory Engine" (provider/model only).
  - Existing "Grammar" row becomes a hub: tap shows a sheet or push to a small index with `[Dashboard, Settings]` links — or keep two rows: "Grammar dashboard" + "Grammar settings".
- **MIRROR**: THEME_TOKEN_USAGE, brand-amber icon helper.
- **IMPORTS**: `SwiftUI`
- **VALIDATE**: All routes reachable; no dead destination case.

### Task 11: Replace TabView with AppShellView at app root

- **ACTION**: Final wire-up.
- **IMPLEMENT**:
  - `RootView` (or `storyplotsApp`) calls `AppShellView()` instead of `MainTabView()`.
  - Delete `MainTabView.swift` after a smoke pass confirms no other reference.
  - Remove `.tint(Theme.Color.brand1)` from `MainTabView` and re-apply on `AppShellView` if needed (NavigationSplitView accent picks up `.tint` on parent).
- **MIRROR**: app structure already in `RootView.swift`.
- **IMPORTS**: `SwiftUI`
- **VALIDATE**: App launches into the sidebar layout. Sign-out → sign-in still works.

### Task 12: Smoke test + RenderPreview snapshots

- **ACTION**: End-to-end interactive verification + minimal snapshots.
- **IMPLEMENT**:
  - Boot `xvp@storyplots.app`, walk all destinations.
  - Capture screenshots via `mcp__XcodeBuildMCP__screenshot` for: drawer open, Home, Characters, Gallery, CharacterChatsView, GrammarDashboard, Import sheet, new Settings views.
  - Document deltas with default + Increase Contrast in `.claude/PRPs/reports/0011-phase-11-ia-realignment-report.md`.
- **VALIDATE**: All surfaces render; no obvious chrome glitches.

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `SidebarViewModelTests.groupingFlattensRepeats` | 4 conversations with same `character_id` | `groupedRows().count == 1`, `conversations.count == 4` | Yes |
| `SidebarViewModelTests.sortsByLatestMessage` | 3 chars with different last_message_at | groupedRows ordered desc by latest | Yes |
| `CharacterCardParserTests.parsesV2Base64` | PNG bytes with `chara` tEXt chunk holding base64 v2 JSON | `format == .v2`, `rawCard["spec"] == "chara_card_v2"` | Yes |
| `CharacterCardParserTests.failsWithoutTextChunk` | PNG without tEXt | throws `.noTextChunks` | Yes |
| `GalleryViewModelTests.queryOrdering` | mocked client returning 3 rows | rows ordered desc by created_at | No |

### Edge Cases Checklist

- [ ] Empty characters list — sidebar shows empty Recent section.
- [ ] No persona row — sidebar footer shows "Set up persona" CTA.
- [ ] Network error during initial load — sidebar shows error state with retry.
- [ ] Permission denied for PhotosPicker — sheet shows guidance.
- [ ] PNG without text chunks — Import sheet shows "Card format unsupported".
- [ ] sfw_blocked image in Gallery — render placeholder card, no signed URL request.
- [ ] User signs out from sidebar footer — returns to SignInView cleanly.
- [ ] Dynamic Type accessibility-large — drawer adapts, no text clipping.

---

## Validation Commands

### Static Analysis
```bash
xcodebuild -project storyplots.xcodeproj -scheme storyplots \
  -destination "platform=iOS Simulator,id=DDA5A72A-6CE0-429D-9317-93E8FA50A3A4" \
  build
```
EXPECT: Zero warnings (except the existing `where` warning at ChatView line ~150), zero errors.

### Unit Tests
```bash
xcodebuild test -project storyplots.xcodeproj -scheme storyplots \
  -destination "platform=iOS Simulator,id=DDA5A72A-6CE0-429D-9317-93E8FA50A3A4"
```
EXPECT: All tests pass. New tests for sidebar grouping + parser + gallery.

### Build + Install + Smoke
Via XcodeBuildMCP:
```
mcp__XcodeBuildMCP__build_run_sim
```
EXPECT: App launches into sidebar (drawer accessible via hamburger).

### Manual Validation Checklist

- [ ] Cold launch → SignIn (if signed out) → app shell appears, drawer accessible.
- [ ] Hamburger / swipe-from-edge → drawer opens, wordmark visible at top.
- [ ] Tap each of 3 destinations → detail column updates, drawer auto-dismisses on iPhone.
- [ ] Recent group with 4 conversations → tap → CharacterChatsView lists 4 → tap one → ChatView with full message history.
- [ ] Home renders Recent Characters horizontally + Grammar widget below + Nudge when empty.
- [ ] Gallery renders all generated images; tap → fullscreen viewer; long-press → delete confirm.
- [ ] Characters + Menu → Import → pick PNG → review sheet appears with prefilled fields.
- [ ] Settings shows new rows; each new sub-screen loads and saves.
- [ ] Sign out from sidebar footer works.

---

## Acceptance Criteria

- [ ] `AppShellView` replaces `MainTabView` at app root.
- [ ] Sidebar with wordmark, 3 destinations, grouped Recent Chats, persona + Settings + Sign out footer.
- [ ] Home: Recent Characters strip + Grammar widget + HomeNudge.
- [ ] Gallery destination exists and works end-to-end.
- [ ] Grammar dashboard exists and works.
- [ ] CharacterImport flow exists and works for v2 cards minimum.
- [ ] VisualRoleplay, PromptEditor, MemorySettings views exist + persist.
- [ ] Settings → Writing has rows for the new sub-screens.
- [ ] No TabView references remain in the codebase.
- [ ] All tests pass; no new warnings.

## Completion Checklist

- [ ] Code follows discovered patterns (see Patterns to Mirror).
- [ ] Error handling: `LoadState.error(String)` enum throughout view models.
- [ ] Logging: `Logger(subsystem: "com.storyplots.ios", category: "<feat>")` per feature.
- [ ] Tests follow Swift Testing patterns (`@Test`, `#expect`).
- [ ] No `Color(hex:)` literals; everything via `Theme.*`.
- [ ] Documentation: HANDOFF.md updated at phase close.
- [ ] Self-contained — no additional codebase searching needed during implementation.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `NavigationSplitView` drawer UX on iPhone feels off vs Apple Mail | Medium | Medium | If creator dislikes, swap to custom drawer in a follow-up cycle. The data model + destinations are unchanged so the swap is local to AppShellView. |
| PNG tEXt parsing fails for an obscure card format | High | Low | Show clear "Card format unsupported" message; offer Manual / Generate as fallback paths in the same sheet. |
| Recent grouping confuses users who have 1 chat per character | Low | Low | Add a "single-chat" row variant: avatar + name + last-message snippet (no count). |
| Grammar widget query fails (no aggregate row) | Medium | Low | Render dash "—" instead of accuracy; widget still tappable for the dashboard which handles empty state. |
| Migration leaves orphan code (MainTabView still imported) | Medium | Low | Final smoke task explicitly verifies the deletion. |

## Notes

- **Confidence score**: 8/10 for single-pass implementation. The riskiest piece is the PNG parser (Task 8); allocate extra time to test against real Character Card v2 + v3 samples from chub.ai or similar.
- **Estimated wall-clock**: 3h–3h 45m end-to-end. Tasks 1–4 are the architectural rewire (~75 min), tasks 5–9 add the missing surfaces (~90 min), tasks 10–12 wire + verify (~30 min).
- **Sequencing**: 1 → 2 → 3 → 4 must be done in order (foundation). 5–9 can parallelize but I'll execute sequentially for review clarity. 10 → 11 → 12 close the phase.
- **Self-review** (per AUTONOMY.md §5):
  - Cubre exit criteria de `seed/roadmap.md §Fase 11`? ✅
  - Cita seed sections correctas? ✅ (ux.md §2 post-ARCH-001, creator-vision §6.11, roadmap §Fase 11)
  - Liquid Glass gates aplicables incluidas? ✅ (Task 12 captures Default + Increase Contrast)
  - Subtasks atómicas con Verify ejecutable? ✅ (each task has ACTION/IMPLEMENT/VALIDATE)
  - Non-negotiables creator-vision §6 respetadas? ✅ (no web views, Theme tokens only, Swift Concurrency, backend untouched, §6.11 paridad estructural is the WHOLE POINT)
