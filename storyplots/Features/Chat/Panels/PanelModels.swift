import Foundation

/// `public.lorebook_entries` row.
struct LorebookEntry: Codable, Identifiable, Sendable, Equatable {
    let id: String
    var conversation_id: String
    var title: String
    var keywords: [String]?
    var body: String
    var token_estimate: Int?
    var enabled: Bool?
}

/// `public.authors_notes` row (PK = conversation_id).
struct AuthorsNote: Codable, Sendable, Equatable {
    var conversation_id: String
    var notes_text: String
    var injection_depth: Int?
}

/// `public.memory_document_chunks` row — read + delete only.
struct MemoryChunk: Decodable, Identifiable, Sendable, Equatable {
    let id: String
    let conversation_id: String?
    let text: String
    let token_estimate: Int?
    let chunk_index: Int?
    let created_at: String?
}

/// `public.grammar_corrections` row — read + delete only.
struct GrammarCorrection: Decodable, Identifiable, Sendable, Equatable {
    let id: String
    let conversation_id: String?
    let user_message_id: String?
    let original_text: String?
    let corrected_text: String?
    let explanation: String?
    let error_categories: [String]?
    let edit_distance: Int?
    let created_at: String?
}

/// `public.chat_controls_state` row — per-conversation overrides.
struct ChatControlsState: Codable, Sendable, Equatable {
    var conversation_id: String
    var image_provider_id: String?
    var image_resolution_preset: String?
    var image_style_override: String?
    var temperature_override: Double?
    var max_tokens_override: Int?
}

/// Ephemeral overrides sent on the next `/chat` POST. Not persisted in DB.
struct GenerationOverrides: Sendable, Equatable {
    var pov: String? = nil
    var shotFraming: String? = nil
    var resolutionPreset: String? = nil
    var promptOverride: String? = nil
    var styleOverride: String? = nil

    var isEmpty: Bool {
        pov == nil && shotFraming == nil && resolutionPreset == nil &&
        promptOverride == nil && styleOverride == nil
    }
}
