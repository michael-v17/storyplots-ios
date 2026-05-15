import SwiftUI
import Supabase

struct AppShellView: View {
    @Environment(AuthStore.self) private var auth

    @State private var selection: SidebarDestination? = .home
    @State private var sidebarVisibility: NavigationSplitViewVisibility = .automatic
    @State private var detailPath = NavigationPath()
    @State private var sidebar: SidebarViewModel

    init(client: SupabaseClient) {
        _sidebar = State(initialValue: SidebarViewModel(client: client))
    }

    var body: some View {
        NavigationSplitView(columnVisibility: $sidebarVisibility) {
            SidebarView(
                selection: $selection,
                detailPath: $detailPath,
                sidebarVisibility: $sidebarVisibility,
                model: sidebar
            )
        } detail: {
            NavigationStack(path: $detailPath) {
                detailRoot
                    .navigationDestination(for: SidebarRoute.self) { route in
                        switch route {
                        case .characterChats(let characterID):
                            if let row = sidebar.row(for: characterID) {
                                CharacterChatsView(
                                    character: row.character,
                                    conversations: row.conversations,
                                    accent: sidebar.accent(for: row.character),
                                    avatarRef: sidebar.avatarRef(for: row.character),
                                    client: auth.client
                                )
                            } else {
                                EmptyStateView(
                                    systemImage: "exclamationmark.triangle",
                                    title: "Character unavailable",
                                    message: "This conversation can't be opened from here."
                                )
                            }
                        }
                    }
            }
        }
        .navigationSplitViewStyle(.balanced)
        .tint(Theme.Color.brand1)
        .task {
            if sidebar.loadState == .idle { await sidebar.load() }
        }
    }

    @ViewBuilder
    private var detailRoot: some View {
        switch selection ?? .home {
        case .home:
            HomeView(client: auth.client)
        case .characters:
            PeopleView(client: auth.client)
        case .gallery:
            GalleryView(client: auth.client)
        }
    }
}
