import Foundation
import Observation
import SwiftUI
import Supabase

/// State + commands behind the Home tab. Owns `[Conversation]`, the user's
/// persona, and a `characters` lookup so each card can render its accent
/// + avatar. Direct Zone-B Supabase reads (no backend hop).
@MainActor
@Observable
final class HomeViewModel {
    enum LoadState: Sendable, Equatable {
        case idle
        case loading
        case loaded
        case error(String)
    }

    private(set) var loadState: LoadState = .idle
    private(set) var conversations: [Conversation] = []
    private(set) var persona: UserPersona?
    /// `character_id` → `Character` snapshot used to render accent + avatar.
    private(set) var charactersByID: [String: Character] = [:]

    private let client: SupabaseClient

    init(client: SupabaseClient) {
        self.client = client
    }

    func load() async {
        loadState = .loading
        do {
            async let conversationsTask = fetchConversations()
            async let charactersTask = fetchCharacters()
            async let personaTask = fetchPersona()

            let (conv, chars, pers) = try await (conversationsTask, charactersTask, personaTask)

            self.conversations = conv
            self.charactersByID = Dictionary(uniqueKeysWithValues: chars.map { ($0.id, $0) })
            self.persona = pers
            self.loadState = .loaded
        } catch {
            self.loadState = .error(error.localizedDescription)
        }
    }

    func delete(_ conversation: Conversation) async {
        // Optimistic local removal.
        let snapshot = conversations
        conversations.removeAll { $0.id == conversation.id }
        do {
            try await client.from("conversations").delete().eq("id", value: conversation.id).execute()
        } catch {
            // Roll back on failure.
            conversations = snapshot
            loadState = .error(error.localizedDescription)
        }
    }

    func accent(for conversation: Conversation) -> SwiftUI.Color {
        guard let charID = conversation.character_id,
              let hex = charactersByID[charID]?.accent_color else {
            return Theme.Color.brand1
        }
        return SwiftUI.Color(hex: Self.parseHex(hex) ?? 0xF5B547)
    }

    func avatarURL(for conversation: Conversation) -> URL? {
        guard let charID = conversation.character_id,
              let ref = charactersByID[charID]?.avatar_ref,
              !ref.isEmpty else {
            return nil
        }
        // Storage buckets are public-readable for avatars in this project's setup;
        // signed URL helper lands in Phase 3 when People grid needs more bullet-proof access.
        return URL(string: "\(SupabaseConfig.url.absoluteString)/storage/v1/object/public/avatars/\(ref)")
    }

    // MARK: queries

    private func fetchConversations() async throws -> [Conversation] {
        let response: [Conversation] = try await client
            .from("conversations")
            .select("id, title, character_id, character_snapshot, last_message_at, updated_at")
            .order("updated_at", ascending: false)
            .limit(50)
            .execute()
            .value
        return response
    }

    private func fetchCharacters() async throws -> [Character] {
        let response: [Character] = try await client
            .from("characters")
            .select("id, name, avatar_ref, accent_color, updated_at")
            .execute()
            .value
        return response
    }

    private func fetchPersona() async throws -> UserPersona? {
        let rows: [UserPersona] = try await client
            .from("user_personas")
            .select("id, name, photo_ref")
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    /// Parses leading-#-or-not hex like `"#F5B547"` or `"F5B547"`.
    static func parseHex(_ raw: String) -> UInt32? {
        var s = raw
        if s.hasPrefix("#") { s.removeFirst() }
        return UInt32(s, radix: 16)
    }
}
