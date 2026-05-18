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
    /// Map of character_id → most recent conversation we have for that
    /// character. Backs both the YOUR CAST activity sort and the Recent
    /// strip's tap-into-chat shortcut.
    private(set) var latestConversationByCharacter: [String: LatestConversation] = [:]

    struct LatestConversation: Sendable, Equatable {
        let id: String
        let lastActivityISO: String?
    }

    /// Convenience for HomeView: returns the conversation id to jump into
    /// when the user taps the character's avatar in the Recent strip.
    func mostRecentConversationID(forCharacterID id: String) -> String? {
        latestConversationByCharacter[id]?.id
    }

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
            async let conversationsTask = fetchLatestConversationsByCharacter()
            async let personaTask = fetchPersona()
            async let grammarTask = fetchGrammar()
            async let prefsTask = fetchGrammarPref()

            let (chars, latest, pers, accuracy, masterOn) = try await (charactersTask, conversationsTask, personaTask, grammarTask, prefsTask)
            self.latestConversationByCharacter = latest
            self.characters = Self.sortByActivity(chars, activity: latest)
            self.persona = pers
            self.grammarAccuracy = accuracy
            self.grammarMasterEnabled = masterOn
            self.loadState = .loaded
            // Self-heal: existing users who turned grammar on with the
            // old key-mismatched build have `master=true` but no
            // `inline_enabled` set. Without the second flag the backend
            // never runs grammar, so the inline correction pill never
            // appears even with obvious typos. If we see that combo,
            // silently seed `inline_enabled=true` once so corrections
            // start firing without forcing the user to re-toggle.
            if masterOn {
                Task { await migrateInlineEnabledIfMissing() }
            }
        } catch {
            self.loadState = .error(error.localizedDescription)
        }
    }

    /// One-shot migration: if `users.preferences.grammar.master` is true
    /// but `inline_enabled` was never written, persist
    /// `inline_enabled=true`. Skips the write entirely once the key
    /// exists, so this is safe to call on every load.
    private func migrateInlineEnabledIfMissing() async {
        struct Row: Decodable { let preferences: AnyCodable? }
        do {
            let rows: [Row] = try await client
                .from("users")
                .select("preferences")
                .limit(1)
                .execute()
                .value
            var prefs = (rows.first?.preferences?.value as? [String: Any]) ?? [:]
            var grammar = (prefs["grammar"] as? [String: Any]) ?? [:]
            // If the inline_enabled key is already present (even as
            // false), respect the user's explicit choice — only seed
            // when the key is genuinely missing.
            guard grammar["inline_enabled"] == nil else { return }
            grammar["inline_enabled"] = true
            prefs["grammar"] = grammar
            struct Update: Encodable { let preferences: AnyJSON }
            let uid = try await client.auth.session.user.id.uuidString
            try await client
                .from("users")
                .update(Update(preferences: PreferencesEncoding.anyJSON(from: prefs)))
                .eq("id", value: uid)
                .execute()
            homeLog.info("seeded grammar.inline_enabled=true (legacy-key migration)")
        } catch {
            homeLog.info("inline_enabled migration skipped: \(error.localizedDescription, privacy: .public)")
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


    /// Fetch the most-recent conversation per character so YOUR CAST can sort
    /// by activity and the Recent strip can shortcut straight into that chat.
    private func fetchLatestConversationsByCharacter() async throws -> [String: LatestConversation] {
        struct Row: Decodable {
            let id: String
            let character_id: String?
            let last_message_at: String?
            let updated_at: String?
        }
        let rows: [Row] = try await client
            .from("conversations")
            .select("id, character_id, last_message_at, updated_at")
            .order("last_message_at", ascending: false)
            .order("updated_at", ascending: false)
            .execute()
            .value
        var byCharacter: [String: LatestConversation] = [:]
        for row in rows {
            guard let cid = row.character_id, byCharacter[cid] == nil else { continue }
            let stamp = row.last_message_at ?? row.updated_at
            byCharacter[cid] = LatestConversation(id: row.id, lastActivityISO: stamp)
        }
        return byCharacter
    }

    /// Sort characters so the most-recently-active ones lead YOUR CAST, falling
    /// back to character.updated_at when no conversation exists yet.
    private static func sortByActivity(
        _ characters: [Character],
        activity: [String: LatestConversation]
    ) -> [Character] {
        characters.sorted { lhs, rhs in
            let lhsActivity = activity[lhs.id]?.lastActivityISO ?? ""
            let rhsActivity = activity[rhs.id]?.lastActivityISO ?? ""
            if lhsActivity != rhsActivity {
                return lhsActivity > rhsActivity
            }
            let lhsUpdated = lhs.updated_at ?? ""
            let rhsUpdated = rhs.updated_at ?? ""
            return lhsUpdated > rhsUpdated
        }
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
        // Default `inline_enabled` to true the first time the user turns
        // master on from this widget — the backend AND-gates inline
        // corrections on both flags, so without this they'd toggle the
        // Home widget on, send a typo, and see no correction strip.
        // Once the user explicitly toggles it from Settings the saved
        // value sticks (we only set it here if missing).
        if grammar["inline_enabled"] == nil {
            grammar["inline_enabled"] = true
        }
        prefs["grammar"] = grammar
        // Send as JSONB *object*, not a JSON-encoded string. See note in
        // `PreferenceFamilyStore.save` — the backend reads this column with
        // `prefs.get("grammar")` and explodes on a string with
        // `'str' object has no attribute 'get'`.
        struct Update: Encodable { let preferences: AnyJSON }
        let uid = try await client.auth.session.user.id.uuidString
        try await client
            .from("users")
            .update(Update(preferences: PreferencesEncoding.anyJSON(from: prefs)))
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
