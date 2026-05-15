import SwiftUI

/// Top-level view. Switches between the auth flow (signed-out) and the
/// `MainTabView` (signed-in). Restores the existing Supabase session on
/// cold launch so a returning user lands directly in the tab shell.
struct RootView: View {
    @State private var auth: AuthStore = AuthStore(client: SupabaseManager.shared.client)

    var body: some View {
        Group {
            if auth.isSignedIn {
                AppShellView(client: auth.client)
            } else {
                SignInView()
            }
        }
        .environment(auth)
        .animation(Theme.Motion.snappy, value: auth.isSignedIn)
        .task {
            await auth.restoreSession()
        }
    }
}

#Preview {
    RootView()
        .preferredColorScheme(.dark)
}
