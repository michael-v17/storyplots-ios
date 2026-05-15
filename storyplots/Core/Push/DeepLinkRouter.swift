import Foundation

/// Resolves Universal Links (e.g. `storyplots.app/chat/<id>`) into typed
/// destinations. Phase 10 ships the parser; the iOS UI routes will land
/// when push notifications start arriving and the navigation graph is
/// stable enough to deep-link into.
enum DeepLink: Sendable, Equatable {
    case chat(conversationID: String)
    case character(characterID: String)

    static func parse(_ url: URL) -> DeepLink? {
        let parts = url.path.split(separator: "/", omittingEmptySubsequences: true).map(String.init)
        guard parts.count >= 2 else { return nil }
        switch parts[0] {
        case "chat":     return .chat(conversationID: parts[1])
        case "character": return .character(characterID: parts[1])
        default:          return nil
        }
    }
}
