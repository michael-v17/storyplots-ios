import Testing
@testable import storyplots

@MainActor
struct SupabaseManagerTests {

    @Test("SupabaseManager.shared exposes a SupabaseClient (real or fallback)")
    func sharedExists() {
        let manager = SupabaseManager.shared
        // In the storyplots app: isConfigured == true (Info.plist keys wired).
        // In the test bundle: isConfigured == false (test bundle doesn't carry the keys).
        // Either way, `client` is non-nil and the property reads do not throw.
        _ = manager.client
        _ = manager.isConfigured
    }
}
