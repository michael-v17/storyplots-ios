import Foundation

enum MessageRole: String, Codable, Sendable, Equatable {
    case user
    case assistant
    case system
}

/// `public.messages` row.
struct Message: Decodable, Identifiable, Sendable, Equatable {
    let id: String
    let conversation_id: String
    let role: MessageRole
    let text: String?
    let active_variant_id: String?
    let created_at: String
    let edited_at: String?
}

/// `public.message_variants` row.
struct MessageVariant: Decodable, Identifiable, Sendable, Equatable {
    let id: String
    let message_id: String
    let content: String
    let created_at: String
}

/// Display-ready item combining a `Message` with the active variant's content
/// (or the user's text). What `ChatView` actually renders. Also constructable
/// directly for streaming placeholders the backend hasn't persisted yet.
struct MessageItem: Identifiable, Sendable, Equatable {
    var id: String
    var role: MessageRole
    var body: String
    var createdAt: String
    /// Transient flag (not persisted) that marks the first assistant message
    /// of a conversation when its body matches the character's stored
    /// `scenario`. `ChatView` swaps the renderer to `ScenarioCardView` so the
    /// scene-setting message reads as a distinct top-of-thread card per
    /// PersonaLLM's chat anatomy.
    var isScenario: Bool = false

    init(message: Message, activeVariant: MessageVariant?) {
        self.id = message.id
        self.role = message.role
        switch message.role {
        case .assistant:
            self.body = activeVariant?.content ?? message.text ?? ""
        case .user, .system:
            self.body = message.text ?? ""
        }
        self.createdAt = message.created_at
    }
}
