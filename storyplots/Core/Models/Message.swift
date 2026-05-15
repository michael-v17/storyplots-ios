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
/// (or the user's text). What `ChatView` actually renders.
struct MessageItem: Identifiable, Sendable, Equatable {
    let id: String
    let role: MessageRole
    let body: String
    let createdAt: String

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
