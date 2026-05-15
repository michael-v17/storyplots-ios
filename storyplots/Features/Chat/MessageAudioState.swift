import Foundation

/// State machine for per-message TTS audio playback. Used by both
/// `ChatViewModel` (owner of state) and `MessageBubbleView` (consumer).
enum MessageAudioState: Sendable, Equatable {
    case idle
    case loading
    case playing
    case paused
    case error(String)
}
