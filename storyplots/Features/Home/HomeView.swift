import SwiftUI
import Supabase

struct HomeView: View {
    @State private var model: HomeViewModel
    @State private var showPersonaSheet: Bool = false
    @State private var showCreateSheet: Bool = false
    @State private var showGenerateSheet: Bool = false
    @State private var showGrammarDashboard: Bool = false
    @State private var navigateTo: Character?
    @State private var openChat: ChatJump?
    @State private var searchText: String = ""

    /// Carries the bits ChatView needs when the user shortcuts into a
    /// conversation from the Recent strip instead of going through the
    /// landing card.
    struct ChatJump: Identifiable, Hashable {
        let character: Character
        let conversationID: String
        var id: String { conversationID }
    }

    @SceneStorage("home.layoutMode") private var layoutModeRaw: String = HomeLayoutMode.grid.rawValue
    @Namespace private var transitionNamespace

    private let client: SupabaseClient

    init(client: SupabaseClient) {
        _model = State(initialValue: HomeViewModel(client: client))
        self.client = client
    }

    private var layoutMode: HomeLayoutMode {
        HomeLayoutMode(rawValue: layoutModeRaw) ?? .grid
    }

    var body: some View {
        Group {
            switch model.loadState {
            case .idle:
                loadingState
            case .loading where model.characters.isEmpty:
                loadingState
            case .error(let message) where model.characters.isEmpty:
                errorState(message)
            default:
                contentState
            }
        }
        .background(Theme.Color.bg)
        .brandTopWash()
        .navigationBarTitleDisplayMode(.inline)
        // `.automatic` toolbar background lets iOS render the nav bar
        // clear when the user is at scroll-zero and fade in the glass
        // material only when content scrolls behind it. The wordmark
        // sits in the principal slot so it stays anchored regardless
        // of scroll — matches the Claude pattern where the title is
        // always present and the bar fades in beneath it.
        .toolbarBackground(.automatic, for: .navigationBar)
        .toolbarBackgroundVisibility(.automatic, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                SidebarToggleButton()
            }
            ToolbarItem(placement: .principal) {
                Image("Wordmark")
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 22)
                    .accessibilityLabel("StoryPlots")
            }
        }
        .searchable(text: $searchText, prompt: "Search characters")
        .onChange(of: searchText) { _, newValue in
            model.searchText = newValue
        }
        .refreshable {
            await model.load()
        }
        .task {
            if model.loadState == .idle { await model.load() }
        }
        .sheet(isPresented: $showPersonaSheet) {
            NavigationStack {
                ProfileView(client: client)
            }
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showCreateSheet) {
            CharacterCreateSheet(client: client) { _ in
                Task { await model.load() }
            }
        }
        .sheet(isPresented: $showGenerateSheet) {
            CharacterGenerateSheet(client: client) { _ in
                Task { await model.load() }
            }
        }
        .sheet(isPresented: $showGrammarDashboard) {
            NavigationStack {
                GrammarDashboardView(client: client)
            }
        }
        .navigationDestination(item: $navigateTo) { character in
            CharacterLandingView(
                character: character,
                accent: model.accent(for: character),
                avatarRef: model.avatarRef(for: character),
                client: client,
                onChanged: { Task { await model.load() } }
            )
        }
        .navigationDestination(item: $openChat) { jump in
            ChatView(
                conversationID: jump.conversationID,
                character: jump.character,
                accent: model.accent(for: jump.character),
                avatarRef: model.avatarRef(for: jump.character),
                client: client
            )
        }
    }

    private var contentState: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.s5) {
                HomeHeaderView(
                    personaName: model.persona?.name,
                    personaPhotoRef: model.persona?.photo_ref,
                    conversationCount: model.characters.count,
                    onAvatarTap: { showPersonaSheet = true }
                )

                if model.characters.isEmpty {
                    HomeNudge(onCreateCharacter: { showCreateSheet = true })
                        .padding(.horizontal, Theme.Spacing.s4)
                } else {
                    RecentCharactersStrip(
                        characters: model.characters,
                        accentResolver: { model.accent(for: $0) },
                        avatarRefResolver: { model.avatarRef(for: $0) },
                        onTap: { character in
                            // Recent strip is a "jump back into the most recent
                            // chat" shortcut — fall back to the landing card
                            // only when the character has no conversation yet.
                            if let convID = model.mostRecentConversationID(forCharacterID: character.id) {
                                openChat = ChatJump(character: character, conversationID: convID)
                            } else {
                                navigateTo = character
                            }
                        }
                    )

                    GrammarWidget(
                        accuracy: model.grammarAccuracy,
                        masterEnabled: model.grammarMasterEnabled,
                        onToggle: { Task { await model.toggleGrammarMaster() } },
                        onOpen: { showGrammarDashboard = true }
                    )
                    .padding(.horizontal, Theme.Spacing.s4)

                    castSection
                }
            }
            .padding(.top, Theme.Spacing.s3)
            .padding(.bottom, 100)
        }
    }

    // wordmarkHeader removed — the StoryPlots wordmark now lives in the
    // toolbar's principal slot so it stays anchored at the top regardless
    // of scroll position. See `.toolbar` in `body`.

    private var castSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
                Text("Your cast")
                    .font(.caption.weight(.semibold))
                    .tracking(1.5)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Color.fg3)
                Spacer(minLength: 0)
                if model.characters.count >= 3 {
                    Button(action: cycleLayout) {
                        Image(systemName: layoutMode.systemImage)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.Color.brand1)
                            .frame(width: 32, height: 32)
                            .background(Theme.Color.bg2, in: Circle())
                            .overlay(Circle().strokeBorder(Theme.Color.borderSoft, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Change layout")
                }
                Menu {
                    Button {
                        Haptics.impact(.medium)
                        showCreateSheet = true
                    } label: {
                        Label("Manual create", systemImage: "person.crop.circle.badge.plus")
                    }
                    Button {
                        Haptics.impact(.medium)
                        showGenerateSheet = true
                    } label: {
                        Label("Generate with AI", systemImage: "wand.and.stars")
                    }
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.fgOnBrand)
                        .frame(width: 32, height: 32)
                        .background(Theme.Color.brandGradient, in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("New persona")
            }
            .padding(.horizontal, Theme.Spacing.s4)

            let entries = model.filtered
            if entries.isEmpty {
                searchEmptyState
            } else {
                switch layoutMode {
                case .grid:    gridLayout(entries)
                case .circles: circlesLayout(entries)
                case .list:    listLayout(entries)
                }
            }
        }
    }

    private func gridLayout(_ entries: [Character]) -> some View {
        let columns = [
            GridItem(.flexible(), spacing: Theme.Spacing.s3),
            GridItem(.flexible(), spacing: Theme.Spacing.s3)
        ]
        return LazyVGrid(columns: columns, spacing: Theme.Spacing.s3) {
            ForEach(entries) { character in
                tile(character)
            }
        }
        .padding(.horizontal, Theme.Spacing.s4)
    }

    private func circlesLayout(_ entries: [Character]) -> some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: Theme.Spacing.s3), count: 4)
        return LazyVGrid(columns: columns, spacing: Theme.Spacing.s4) {
            ForEach(entries) { character in
                circle(character)
            }
        }
        .padding(.horizontal, Theme.Spacing.s4)
    }

    private func listLayout(_ entries: [Character]) -> some View {
        LazyVStack(spacing: Theme.Spacing.s2) {
            ForEach(entries) { character in
                listRow(character)
            }
        }
        .padding(.horizontal, Theme.Spacing.s4)
    }

    private func tile(_ character: Character) -> some View {
        Button(action: {
            Haptics.impact(.light)
            navigateTo = character
        }) {
            CharacterCardView(
                character: character,
                accent: model.accent(for: character),
                avatarRef: model.avatarRef(for: character)
            )
            .matchedTransitionSource(id: "home-card-\(character.id)", in: transitionNamespace)
        }
        .buttonStyle(.plain)
    }

    private func circle(_ character: Character) -> some View {
        Button(action: {
            Haptics.impact(.light)
            navigateTo = character
        }) {
            VStack(spacing: Theme.Spacing.s2) {
                AvatarView(
                    avatarRef: model.avatarRef(for: character),
                    name: character.name,
                    accent: model.accent(for: character),
                    size: 64,
                    ringWidth: 2
                )
                Text(character.name)
                    .font(Theme.FontStyle.timestamp.weight(.semibold))
                    .foregroundStyle(Theme.Color.fg1)
                    .lineLimit(1)
            }
        }
        .buttonStyle(.plain)
    }

    private func listRow(_ character: Character) -> some View {
        Button(action: {
            Haptics.impact(.light)
            navigateTo = character
        }) {
            HStack(spacing: Theme.Spacing.s3) {
                AvatarView(
                    avatarRef: model.avatarRef(for: character),
                    name: character.name,
                    accent: model.accent(for: character),
                    size: 48,
                    ringWidth: 1.5
                )
                VStack(alignment: .leading, spacing: 2) {
                    Text(character.name)
                        .font(Theme.FontStyle.body.weight(.semibold))
                        .foregroundStyle(Theme.Color.fg)
                        .lineLimit(1)
                    if let tagline = character.tagline, !tagline.isEmpty {
                        Text(tagline)
                            .font(Theme.FontStyle.meta)
                            .foregroundStyle(Theme.Color.fg3)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.fg4)
            }
            .padding(Theme.Spacing.s3)
            .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
        }
        .buttonStyle(.plain)
    }

    

    

    

    private var searchEmptyState: some View {
        Text("No matches for '\(searchText)'")
            .font(Theme.FontStyle.meta)
            .foregroundStyle(Theme.Color.fg3)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Spacing.s5)
    }

    private var loadingState: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.s4) {
                HomeHeaderView(
                    personaName: nil,
                    personaPhotoRef: nil,
                    conversationCount: 0,
                    onAvatarTap: { showPersonaSheet = true }
                )
                LazyVGrid(columns: [
                    GridItem(.flexible(), spacing: Theme.Spacing.s3),
                    GridItem(.flexible(), spacing: Theme.Spacing.s3)
                ], spacing: Theme.Spacing.s3) {
                    ForEach(0..<6, id: \.self) { _ in
                        CharacterSkeletonCard()
                    }
                }
                .padding(.horizontal, Theme.Spacing.s4)
            }
        }
        .disabled(true)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: Theme.Spacing.s3) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 36))
                .foregroundStyle(Theme.Color.destructive)
            Text("Something went wrong")
                .font(Theme.FontStyle.h3)
                .foregroundStyle(Theme.Color.fg)
            Text(message)
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.fg2)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Theme.Spacing.s4)
            Button("Retry") {
                Task { await model.load() }
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.Color.brand1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func cycleLayout() {
        Haptics.selection()
        layoutModeRaw = layoutMode.next.rawValue
    }
}
