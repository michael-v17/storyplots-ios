import Foundation

/// Subset of the `character_snapshot` JSONB stored on each conversation —
/// we only decode the name for the conversation card. Other fields (system_prompt,
/// personality, etc.) are decoded by the chat flow when it lands in Phase 4-5.
struct CharacterSnapshot: Decodable, Sendable, Equatable {
    let name: String
}

/// `public.conversations` row — direct PostgREST shape, Zone B.
struct Conversation: Decodable, Identifiable, Sendable, Equatable {
    let id: String
    let title: String
    let character_id: String?
    let character_snapshot: CharacterSnapshot?
    let last_message_at: String?
    let updated_at: String

    var characterName: String { character_snapshot?.name ?? "Character" }
}
