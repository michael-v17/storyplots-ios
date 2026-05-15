import SwiftUI
import Supabase

struct AppShellView: View {
    @Environment(AuthStore.self) private var auth

    @State private var selection: SidebarDestination = .home
    @State private var detailPath = NavigationPath()
    @State private var sidebar: SidebarViewModel
    @State private var showSidebar: Bool = false

    init(client: SupabaseClient) {
        _sidebar = State(initialValue: SidebarViewModel(client: client))
    }

    var body: some View {
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
        .tint(Theme.Color.brand1)
        .task {
            if sidebar.loadState == .idle { await sidebar.load() }
        }
        .sheet(isPresented: $showSidebar) {
            SidebarSheet(
                selection: $selection,
                detailPath: $detailPath,
                model: sidebar,
                dismiss: { showSidebar = false }
            )
            .environment(auth)
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .environment(AppShellEnvironment(openSidebar: { showSidebar = true }))
    }

    @ViewBuilder
    private var detailRoot: some View {
        switch selection {
        case .home:
            HomeView(client: auth.client)
        case .characters:
            PeopleView(client: auth.client)
        case .gallery:
            GalleryView(client: auth.client)
        }
    }
}

/// Environment-scoped hook so destination views can open the sidebar from
/// their own toolbar without owning the state.
@Observable
final class AppShellEnvironment {
    var openSidebar: () -> Void

    init(openSidebar: @escaping () -> Void) {
        self.openSidebar = openSidebar
    }
}
