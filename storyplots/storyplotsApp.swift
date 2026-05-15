import SwiftUI

/// Scene root. Forces dark mode per `seed/creator-vision.md` §8.1 + open-questions Q2.2.
/// Light mode is deferred to a post-MVP phase.
@main
struct storyplotsApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    init() {
        // Bump the shared URLCache so AsyncImage can hold many more avatars +
        // generated images in memory and on disk during a session. Signed URLs
        // rotate per Supabase TTL, so this is intra-session caching; cross-
        // launch image caching by stable storage_ref would need a custom cache.
        URLCache.shared = URLCache(
            memoryCapacity: 50 * 1024 * 1024,
            diskCapacity: 300 * 1024 * 1024
        )
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
