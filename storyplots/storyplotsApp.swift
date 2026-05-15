import SwiftUI

/// Scene root. Forces dark mode per `seed/creator-vision.md` §8.1 + open-questions Q2.2.
/// Light mode is deferred to a post-MVP phase.
@main
struct storyplotsApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.dark)
        }
    }
}
