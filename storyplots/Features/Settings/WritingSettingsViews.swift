import SwiftUI
import Supabase

// MARK: - Generic JSON preferences editor

/// Reads + writes a single key under `users.preferences` (JSONB column).
/// Used by Roleplay / Writing Styles / Grammar / Visual Roleplay screens.
final class PreferenceFamilyStore: @unchecked Sendable {
    let client: SupabaseClient
    let family: String

    init(client: SupabaseClient, family: String) {
        self.client = client
        self.family = family
    }

    func load() async throws -> [String: Any] {
        struct Row: Decodable { let preferences: AnyCodable? }
        let rows: [Row] = try await client
            .from("users")
            .select("preferences")
            .limit(1)
            .execute()
            .value
        guard let prefs = rows.first?.preferences?.value as? [String: Any] else {
            return [:]
        }
        return (prefs[family] as? [String: Any]) ?? [:]
    }

    func save(_ family_values: [String: Any]) async throws {
        // Merge into the existing preferences JSON.
        struct Row: Decodable { let preferences: AnyCodable? }
        let rows: [Row] = try await client
            .from("users")
            .select("preferences")
            .limit(1)
            .execute()
            .value
        var prefs = (rows.first?.preferences?.value as? [String: Any]) ?? [:]
        prefs[family] = family_values
        // Send as a JSONB *object*, not a JSON-encoded string. PostgREST
        // stores a String value inside a JSONB column verbatim — including
        // the surrounding quotes — which then breaks any backend code that
        // does `prefs.get("grammar")` because it gets a `str`, not a dict.
        // AnyJSON (from supabase-swift's Helpers, re-exported via PostgREST)
        // serializes inline as the right JSON shape.
        struct Update: Encodable { let preferences: AnyJSON }
        if let uid = try? await client.auth.session.user.id.uuidString {
            try await client
                .from("users")
                .update(Update(preferences: PreferencesEncoding.anyJSON(from: prefs)))
                .eq("id", value: uid)
                .execute()
        }
    }
}

/// Bridge between Foundation `[String: Any]` JSON dicts and supabase-swift's
/// strongly-typed `AnyJSON`. Used when writing back into a JSONB column so the
/// payload serializes as a JSON object instead of a quoted string.
enum PreferencesEncoding {
    static func anyJSON(from value: Any?) -> AnyJSON {
        switch value {
        case nil, is NSNull:
            return .null
        case let bool as Bool:
            return .bool(bool)
        case let int as Int:
            return .integer(int)
        case let int as Int64:
            return .integer(Int(int))
        case let double as Double:
            return .double(double)
        case let float as Float:
            return .double(Double(float))
        case let number as NSNumber:
            // NSNumber boxes both Bool and numerics; the Bool branch above
            // catches Swift native Bools, but Foundation can hand us
            // NSNumber-wrapped numerics from JSONSerialization round-trips.
            if CFNumberIsFloatType(number) {
                return .double(number.doubleValue)
            }
            return .integer(number.intValue)
        case let string as String:
            return .string(string)
        case let array as [Any]:
            return .array(array.map { anyJSON(from: $0) })
        case let dict as [String: Any]:
            var object: JSONObject = [:]
            for (key, val) in dict {
                object[key] = anyJSON(from: val)
            }
            return .object(object)
        default:
            return .null
        }
    }
}

/// Type-erased JSON wrapper for decoding arbitrary preferences shapes.
struct AnyCodable: Codable, @unchecked Sendable {
    let value: Any?

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let v = try? container.decode([String: AnyCodable].self) {
            self.value = v.mapValues { $0.value as Any }
        } else if let v = try? container.decode([AnyCodable].self) {
            self.value = v.map { $0.value as Any }
        } else if let v = try? container.decode(Bool.self) {
            self.value = v
        } else if let v = try? container.decode(Int.self) {
            self.value = v
        } else if let v = try? container.decode(Double.self) {
            self.value = v
        } else if let v = try? container.decode(String.self) {
            self.value = v
        } else {
            self.value = nil
        }
    }

    func encode(to encoder: Encoder) throws { /* not used here */ }
}

// MARK: - Roleplay

struct RoleplaySettingsView: View {
    let client: SupabaseClient

    @State private var mode: String = "balanced"
    @State private var injectionDepth: Int = 4
    @State private var enabled: Bool = true
    @State private var saving: Bool = false

    var body: some View {
        Form {
            Toggle("Enabled", isOn: $enabled)
                .onChange(of: enabled) { _, _ in Haptics.selection(); Task { await save() } }
            Picker("Default mode", selection: $mode) {
                Text("Casual").tag("casual")
                Text("Balanced").tag("balanced")
                Text("Immersive").tag("immersive")
            }
            .onChange(of: mode) { _, _ in Task { await save() } }
            Stepper(value: $injectionDepth, in: 1...12) {
                HStack { Text("Injection depth"); Spacer(); Text("\(injectionDepth)").foregroundStyle(Theme.Color.fg2) }
            }
            .onChange(of: injectionDepth) { _, _ in Task { await save() } }
        }
        .navigationTitle("Roleplay")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        let store = PreferenceFamilyStore(client: client, family: "roleplay")
        let prefs = (try? await store.load()) ?? [:]
        if let m = prefs["mode"] as? String { mode = m }
        if let d = prefs["injection_depth"] as? Int { injectionDepth = d }
        if let e = prefs["enabled"] as? Bool { enabled = e }
    }

    private func save() async {
        saving = true; defer { saving = false }
        let store = PreferenceFamilyStore(client: client, family: "roleplay")
        try? await store.save([
            "mode": mode,
            "injection_depth": injectionDepth,
            "enabled": enabled
        ])
    }
}

// MARK: - Writing Styles

struct WritingStylesSettingsView: View {
    let client: SupabaseClient

    @State private var tone: String = "literary"
    @State private var pov: String = "third_person"
    @State private var tense: String = "past"
    @State private var customInstructions: String = ""

    var body: some View {
        Form {
            Picker("Tone", selection: $tone) {
                Text("Literary").tag("literary")
                Text("Conversational").tag("conversational")
                Text("Cinematic").tag("cinematic")
                Text("Pulp").tag("pulp")
            }
            .onChange(of: tone) { _, _ in Task { await save() } }
            Picker("POV", selection: $pov) {
                Text("First person").tag("first_person")
                Text("Second person").tag("second_person")
                Text("Third person").tag("third_person")
            }
            .onChange(of: pov) { _, _ in Task { await save() } }
            Picker("Tense", selection: $tense) {
                Text("Past").tag("past")
                Text("Present").tag("present")
            }
            .onChange(of: tense) { _, _ in Task { await save() } }
            Section("Custom instructions") {
                TextEditor(text: $customInstructions)
                    .frame(minHeight: 120)
                Button("Save instructions") { Task { await save() } }
            }
        }
        .navigationTitle("Writing styles")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        let store = PreferenceFamilyStore(client: client, family: "writing_style")
        let prefs = (try? await store.load()) ?? [:]
        if let v = prefs["tone"] as? String { tone = v }
        if let v = prefs["pov"] as? String { pov = v }
        if let v = prefs["tense"] as? String { tense = v }
        if let v = prefs["custom_instructions"] as? String { customInstructions = v }
    }

    private func save() async {
        let store = PreferenceFamilyStore(client: client, family: "writing_style")
        try? await store.save([
            "tone": tone,
            "pov": pov,
            "tense": tense,
            "custom_instructions": customInstructions
        ])
    }
}

// MARK: - Grammar

struct GrammarSettingsView: View {
    let client: SupabaseClient

    @State private var enabled: Bool = true
    @State private var inline: Bool = true
    @State private var rewriteGate: Bool = false
    @State private var strikeThreshold: Int = 3

    var body: some View {
        Form {
            Toggle("Grammar agent enabled", isOn: $enabled)
                .onChange(of: enabled) { _, _ in Haptics.selection(); Task { await save() } }
            Toggle("Inline corrections", isOn: $inline)
                .onChange(of: inline) { _, _ in Task { await save() } }
            Toggle("Rewrite gate", isOn: $rewriteGate)
                .onChange(of: rewriteGate) { _, _ in Task { await save() } }
            Stepper(value: $strikeThreshold, in: 1...10) {
                HStack { Text("Strike threshold"); Spacer(); Text("\(strikeThreshold)").foregroundStyle(Theme.Color.fg2) }
            }
            .onChange(of: strikeThreshold) { _, _ in Task { await save() } }
        }
        .navigationTitle("Grammar")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        let store = PreferenceFamilyStore(client: client, family: "grammar")
        let prefs = (try? await store.load()) ?? [:]
        if let v = prefs["enabled"] as? Bool { enabled = v }
        if let v = prefs["inline"] as? Bool { inline = v }
        if let v = prefs["rewrite_gate"] as? Bool { rewriteGate = v }
        if let v = prefs["strike_threshold"] as? Int { strikeThreshold = v }
    }

    private func save() async {
        let store = PreferenceFamilyStore(client: client, family: "grammar")
        try? await store.save([
            "enabled": enabled,
            "inline": inline,
            "rewrite_gate": rewriteGate,
            "strike_threshold": strikeThreshold
        ])
    }
}
