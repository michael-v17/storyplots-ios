import SwiftUI

/// Scene root. Forces dark mode per `seed/creator-vision.md` §8.1 + open-questions Q2.2.
/// Light mode is deferred to a post-MVP phase.
@main
struct storyplotsApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    init() {
        URLCache.shared = URLCache(
            memoryCapacity: 50 * 1024 * 1024,
            diskCapacity: 300 * 1024 * 1024
        )
        // Render Free plan sleeps after ~15 min of inactivity. Fire a cheap
        // GET in the background at launch so the first user-driven request
        // doesn't have to wait for the cold start.
        Task.detached(priority: .utility) {
            var request = URLRequest(url: BackendConfig.url.appendingPathComponent("health"))
            request.timeoutInterval = 60
            _ = try? await URLSession.shared.data(for: request)
        }
    }

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
