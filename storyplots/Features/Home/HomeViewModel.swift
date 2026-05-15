import Foundation
import Observation
import OSLog
import Supabase
import SwiftUI

private let homeLog = Logger(subsystem: "com.storyplots.ios", category: "home")

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
    private(set) var characters: [Character] = []
    private(set) var persona: UserPersona?
    /// `nil` until the first load attempts a fetch — used by the Grammar widget
    /// to render either "—" (no data yet) or a percent.
    private(set) var grammarAccuracy: Double?
    /// User preference for the grammar "master" toggle (from `users.preferences.grammar.master`).
    private(set) var grammarMasterEnabled: Bool = false

    var searchText: String = ""

    let client: SupabaseClient

    init(client: SupabaseClient) {
        self.client = client
    }

    var filtered: [Character] {
        let needle = searchText.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return characters }
        return characters.filter { char in
            let bag = [char.name, char.tagline ?? "", char.scenario ?? ""].joined(separator: " ").lowercased()
            return bag.contains(needle)
        }
    }

    func load() async {
        loadState = .loading
        do {
            async let charactersTask = fetchCharacters()
            async let personaTask = fetchPersona()
            async let grammarTask = fetchGrammar()
            async let prefsTask = fetchGrammarPref()

            let (chars, pers, accuracy, masterOn) = try await (charactersTask, personaTask, grammarTask, prefsTask)
            self.characters = chars
            self.persona = pers
            self.grammarAccuracy = accuracy
            self.grammarMasterEnabled = masterOn
            self.loadState = .loaded
        } catch {
            self.loadState = .error(error.localizedDescription)
        }
    }

    func accent(for character: Character) -> SwiftUI.Color {
        guard let hex = character.accent_color else { return Theme.Color.brand1 }
        return SwiftUI.Color(hex: HomeViewModel.parseHex(hex) ?? 0xF5B547)
    }

    func avatarRef(for character: Character) -> String? {
        guard let ref = character.avatar_ref, !ref.isEmpty else { return nil }
        return ref
    }

    func toggleGrammarMaster() async {
        grammarMasterEnabled.toggle()
        do {
            try await persistGrammarMaster(enabled: grammarMasterEnabled)
        } catch {
            homeLog.error("toggle grammar master failed: \(error.localizedDescription, privacy: .public)")
            grammarMasterEnabled.toggle()
        }
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

    private func fetchPersona() async throws -> UserPersona? {
        let rows: [UserPersona] = try await client
            .from("user_personas")
            .select("id, name, photo_ref")
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    /// Soft-fails: returns nil if the row/column doesn't exist yet.
    private func fetchGrammar() async -> Double? {
        struct AggregateRow: Decodable {
            let last_aggregate_pct: Double?
        }
        do {
            let rows: [AggregateRow] = try await client
                .from("grammar_aggregates")
                .select("last_aggregate_pct")
                .limit(1)
                .execute()
                .value
            return rows.first?.last_aggregate_pct
        } catch {
            homeLog.info("grammar_aggregates unavailable: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    private func fetchGrammarPref() async -> Bool {
        struct Row: Decodable { let preferences: AnyCodable? }
        do {
            let rows: [Row] = try await client
                .from("users")
                .select("preferences")
                .limit(1)
                .execute()
                .value
            guard let prefs = rows.first?.preferences?.value as? [String: Any],
                  let grammar = prefs["grammar"] as? [String: Any],
                  let master = grammar["master"] as? Bool else {
                return false
            }
            return master
        } catch {
            return false
        }
    }

    private func persistGrammarMaster(enabled: Bool) async throws {
        struct Row: Decodable { let preferences: AnyCodable? }
        let rows: [Row] = try await client
            .from("users")
            .select("preferences")
            .limit(1)
            .execute()
            .value
        var prefs = (rows.first?.preferences?.value as? [String: Any]) ?? [:]
        var grammar = (prefs["grammar"] as? [String: Any]) ?? [:]
        grammar["master"] = enabled
        prefs["grammar"] = grammar
        guard let data = try? JSONSerialization.data(withJSONObject: prefs),
              let prefsString = String(data: data, encoding: .utf8) else { return }
        struct Update: Encodable { let preferences: String }
        let uid = try await client.auth.session.user.id.uuidString
        try await client
            .from("users")
            .update(Update(preferences: prefsString))
            .eq("id", value: uid)
            .execute()
    }

    /// Parses leading-#-or-not hex like `"#F5B547"` or `"F5B547"`.
    static func parseHex(_ raw: String) -> UInt32? {
        var s = raw
        if s.hasPrefix("#") { s.removeFirst() }
        return UInt32(s, radix: 16)
    }
}
