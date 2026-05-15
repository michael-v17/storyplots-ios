import SwiftUI

/// Scene root. Forces dark mode per `seed/creator-vision.md` §8.1 + open-questions Q2.2.
/// Light mode is deferred to a post-MVP phase.
@main
struct storyplotsApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.dark)
                .onOpenURL { url in
                    _ = DeepLink.parse(url)
                    // Phase 10.x routes the parsed deep-link into the NavigationStack.
                }
        }
    }
}
