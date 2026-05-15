import Foundation
import Observation
import SwiftUI
import Supabase

@MainActor
@Observable
final class ChatViewModel {
    enum LoadState: Sendable, Equatable {
        case idle
        case loading
        case loaded
        case error(String)
    }

    let conversationID: String
    let character: Character?
    let accent: SwiftUI.Color
    let avatarURL: URL?

    private(set) var loadState: LoadState = .idle
    private(set) var items: [MessageItem] = []

    private let client: SupabaseClient

    init(conversationID: String, character: Character?, accent: SwiftUI.Color, avatarURL: URL?, client: SupabaseClient) {
        self.conversationID = conversationID
        self.character = character
        self.accent = accent
        self.avatarURL = avatarURL
        self.client = client
    }

    func load() async {
        loadState = .loading
        do {
            let messages: [Message] = try await client
                .from("messages")
                .select("id, conversation_id, role, text, active_variant_id, created_at, edited_at")
                .eq("conversation_id", value: conversationID)
                .order("created_at", ascending: true)
                .execute()
                .value

            let variantIDs = messages.compactMap(\.active_variant_id)
            var variantsByID: [String: MessageVariant] = [:]
            if !variantIDs.isEmpty {
                let variants: [MessageVariant] = try await client
                    .from("message_variants")
                    .select("id, message_id, content, created_at")
                    .in("id", values: variantIDs)
                    .execute()
                    .value
                variantsByID = Dictionary(uniqueKeysWithValues: variants.map { ($0.id, $0) })
            }

            self.items = messages.map { message in
                let variant = message.active_variant_id.flatMap { variantsByID[$0] }
                return MessageItem(message: message, activeVariant: variant)
            }
            self.loadState = .loaded
        } catch {
            self.loadState = .error(error.localizedDescription)
        }
    }

    var characterName: String { character?.name ?? "Character" }
}
