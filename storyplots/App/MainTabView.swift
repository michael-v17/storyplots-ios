import SwiftUI

/// The three-tab shell once a user is signed in. Each tab is a separate
/// `NavigationStack` so deep navigation in one tab does not affect others.
struct MainTabView: View {
    enum Tab: Hashable { case home, people, settings }
    @State private var selection: Tab = .home
    @Environment(AuthStore.self) private var auth

    var body: some View {
        TabView(selection: $selection) {
            NavigationStack {
                HomeView(client: auth.client)
            }
            .tabItem { Label("Home", systemImage: "bubble.left.and.bubble.right.fill") }
            .tag(Tab.home)

            NavigationStack {
                PeopleView(client: auth.client)
            }
            .tabItem { Label("People", systemImage: "person.2.fill") }
            .tag(Tab.people)

            NavigationStack {
                SettingsPlaceholder()
                    .navigationTitle("Settings")
                    .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
                    .toolbarBackgroundVisibility(.visible, for: .navigationBar)
            }
            .tabItem { Label("Settings", systemImage: "gearshape.fill") }
            .tag(Tab.settings)
        }
    }
}
