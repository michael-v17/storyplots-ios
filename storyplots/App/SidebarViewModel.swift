import Foundation
import Observation
import Supabase
import SwiftUI

struct GroupedCharacterRow: Identifiable, Sendable, Equatable {
    let character: Character
    let conversations: [Conversation]

    var id: String { character.id }
    var count: Int { conversations.count }
    var lastMessageAt: String {
        conversations.first?.last_message_at ?? conversations.first?.updated_at ?? ""
    }
}

@MainActor
@Observable
final class SidebarViewModel {
    enum LoadState: Sendable, Equatable {
        case idle
        case loading
        case loaded
        case error(String)
    }

    private(set) var loadState: LoadState = .idle
    private(set) var characters: [Character] = []
    private(set) var conversationsByCharacter: [String: [Conversation]] = [:]
    private(set) var persona: UserPersona?

    let client: SupabaseClient

    init(client: SupabaseClient) {
        self.client = client
    }

    func load() async {
        loadState = .loading
        do {
            async let charactersTask = fetchCharacters()
            async let conversationsTask = fetchConversations()
            async let personaTask = fetchPersona()

            let (chars, convs, pers) = try await (charactersTask, conversationsTask, personaTask)

            self.characters = chars
            self.persona = pers
            self.conversationsByCharacter = Self.group(conversations: convs)
            self.loadState = .loaded
        } catch {
            self.loadState = .error(error.localizedDescription)
        }
    }

    /// Group rows for the sidebar — one row per character with conversations
    /// ordered by latest message; rows themselves sorted by their latest
    /// message timestamp (desc).
    var groupedRows: [GroupedCharacterRow] {
        let byID = Dictionary(uniqueKeysWithValues: characters.map { ($0.id, $0) })
        var rows: [GroupedCharacterRow] = []
        for (charID, convs) in conversationsByCharacter {
            guard let character = byID[charID] else { continue }
            rows.append(GroupedCharacterRow(character: character, conversations: convs))
        }
        rows.sort { $0.lastMessageAt > $1.lastMessageAt }
        return rows
    }

    func row(for characterID: String) -> GroupedCharacterRow? {
        groupedRows.first { $0.character.id == characterID }
    }

    func accent(for character: Character) -> SwiftUI.Color {
        guard let hex = character.accent_color else { return Theme.Color.brand1 }
        return SwiftUI.Color(hex: HomeViewModel.parseHex(hex) ?? 0xF5B547)
    }

    func avatarRef(for character: Character) -> String? {
        guard let ref = character.avatar_ref, !ref.isEmpty else { return nil }
        return ref
    }

    // MARK: queries

    private func fetchCharacters() async throws -> [Character] {
        try await client
            .from("characters")
            .select("id, name, tagline, avatar_ref, accent_color, scenario, age, gender, system_prompt, mode, updated_at")
            .order("updated_at", ascending: false)
            .execute()
            .value
    }

    private func fetchConversations() async throws -> [Conversation] {
        try await client
            .from("conversations")
            .select("id, title, character_id, character_snapshot, last_message_at, updated_at")
            .order("updated_at", ascending: false)
            .limit(200)
            .execute()
            .value
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

    private static func group(conversations: [Conversation]) -> [String: [Conversation]] {
        var result: [String: [Conversation]] = [:]
        for conv in conversations {
            guard let charID = conv.character_id else { continue }
            result[charID, default: []].append(conv)
        }
        // Order each character's conversations by latest first.
        for (key, arr) in result {
            result[key] = arr.sorted {
                ($0.last_message_at ?? $0.updated_at) > ($1.last_message_at ?? $1.updated_at)
            }
        }
        return result
    }
}
