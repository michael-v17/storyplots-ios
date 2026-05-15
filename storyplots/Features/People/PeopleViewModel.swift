import Foundation
import Observation
import SwiftUI
import Supabase

/// State + commands behind the People tab.
@MainActor
@Observable
final class PeopleViewModel {
    enum LoadState: Sendable, Equatable {
        case idle
        case loading
        case loaded
        case error(String)
    }

    private(set) var loadState: LoadState = .idle
    private(set) var characters: [Character] = []
    var searchText: String = ""

    private let client: SupabaseClient

    init(client: SupabaseClient) {
        self.client = client
    }

    var filtered: [Character] {
        let needle = searchText.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return characters }
        return characters.filter { $0.name.lowercased().contains(needle) }
    }

    func load() async {
        loadState = .loading
        do {
            let rows: [Character] = try await client
                .from("characters")
                .select("id, name, tagline, avatar_ref, accent_color, scenario, age, gender, system_prompt, mode, updated_at")
                .order("updated_at", ascending: false)
                .execute()
                .value
            self.characters = rows
            self.loadState = .loaded
        } catch {
            self.loadState = .error(error.localizedDescription)
        }
    }

    func accent(for character: Character) -> SwiftUI.Color {
        guard let hex = character.accent_color else { return Theme.Color.brand1 }
        return SwiftUI.Color(hex: HomeViewModel.parseHex(hex) ?? 0xF5B547)
    }

    /// Storage ref (path inside the `avatars` bucket). Used by `AvatarView`
    /// to resolve a signed URL on the actor.
    func avatarRef(for character: Character) -> String? {
        guard let ref = character.avatar_ref, !ref.isEmpty else { return nil }
        return ref
    }
}
