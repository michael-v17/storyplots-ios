import SwiftUI

/// Top-level view of the app. Phase 0 routes to `ScaffoldView`; Phase 1 switches between
/// `AuthFlow` and `MainTabView` based on `AuthState.isSignedIn`.
struct RootView: View {
    var body: some View {
        ScaffoldView()
    }
}

#Preview {
    RootView()
        .preferredColorScheme(.dark)
}
