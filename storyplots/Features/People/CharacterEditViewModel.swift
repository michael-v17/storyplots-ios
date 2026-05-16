import Foundation
import Observation
import SwiftUI
import Supabase

/// State + commands behind CharacterCreateSheet and CharacterEditView.
/// Phase 6 ships minimal CRUD (name, tagline, accent, scenario, system_prompt).
@MainActor
@Observable
final class CharacterEditViewModel {
    enum SaveState: Sendable, Equatable {
        case idle
        case saving
        case saved
        case error(String)
    }

    var name: String
    var tagline: String
    var scenario: String
    var systemPrompt: String
    /// Hex like `"#8B5CF6"` (with or without leading `#`).
    var accentHex: String

    private(set) var saveState: SaveState = .idle
    private let client: SupabaseClient
    let existingID: String?
    var avatarRef: String?
    /// Raw `characters.mode` enum value from the loaded row — surfaced read-only
    /// in the Settings tab (schema.md §2.3 says mode is immutable after creation).
    var modeRaw: String?

    // Avatar tab — fields beyond avatar + accent
    var appearanceDescription: String = ""
    var appendAppearanceToImagePrompts: Bool = true

    // Info tab — Personality / Goals / Worldbuilding jsonb sub-fields
    // (schema.md §2.3 lays out the exact keys per sub-object).
    var personalityCoreTraits: String = ""
    var personalityFears: String = ""
    var personalityCommunicationStyle: String = ""
    var personalityQuirks: String = ""

    var goalsPrimary: String = ""
    var goalsSecretDesire: String = ""
    var goalsFearsToOvercome: String = ""
    var goalsWouldSacrifice: String = ""

    var worldOrigin: String = ""
    var worldBackstory: String = ""
    var worldSetting: String = ""
    var worldSpecialAbilities: String = ""

    // Settings tab
    var characterMemoryEnabled: Bool = true
    var defaultPersonaID: String? = nil

    /// Personas owned by the user — fetched lazily in `loadDeep` to back the
    /// "Default persona" picker in the Settings tab.
    var availablePersonas: [PersonaOption] = []

    struct PersonaOption: Identifiable, Sendable, Equatable {
        let id: String
        let name: String
    }

    private(set) var deepLoaded: Bool = false

    init(client: SupabaseClient, character: Character? = nil) {
        self.client = client
        self.existingID = character?.id
        self.name = character?.name ?? ""
        self.tagline = character?.tagline ?? ""
        self.scenario = character?.scenario ?? ""
        self.systemPrompt = character?.system_prompt ?? ""
        self.accentHex = character?.accent_color ?? "#F5B547"
        self.avatarRef = character?.avatar_ref
        self.modeRaw = character?.mode
    }


    /// Fetch the JSONB sub-objects (personality / goals / worldbuilding) and
    /// the side fields that the shallow Character select skips (appearance,
    /// memory toggle, default_persona_id, etc.). Also loads the user's
    /// personas to back the "Default persona" picker. Idempotent.
    func loadDeep() async {
        guard !deepLoaded, let id = existingID else { return }
        struct PersonalityRow: Decodable {
            let core_traits: String?
            let fears_insecurities: String?
            let communication_style: String?
            let quirks_habits: String?
        }
        struct GoalsRow: Decodable {
            let primary_goal: String?
            let secret_desire: String?
            let fears_to_overcome: String?
            let would_sacrifice: String?
        }
        struct WorldRow: Decodable {
            let origin_birthplace: String?
            let backstory: String?
            let world_setting: String?
            let special_abilities: String?
        }
        struct Row: Decodable {
            let appearance_description: String?
            let append_appearance_to_image_prompts: Bool?
            let character_memory_enabled: Bool?
            let default_persona_id: String?
            let personality: PersonalityRow?
            let goals: GoalsRow?
            let worldbuilding: WorldRow?
        }
        do {
            let rows: [Row] = try await client
                .from("characters")
                .select("appearance_description, append_appearance_to_image_prompts, character_memory_enabled, default_persona_id, personality, goals, worldbuilding")
                .eq("id", value: id)
                .limit(1)
                .execute()
                .value
            if let row = rows.first {
                appearanceDescription = row.appearance_description ?? ""
                appendAppearanceToImagePrompts = row.append_appearance_to_image_prompts ?? true
                characterMemoryEnabled = row.character_memory_enabled ?? true
                defaultPersonaID = row.default_persona_id

                personalityCoreTraits = row.personality?.core_traits ?? ""
                personalityFears = row.personality?.fears_insecurities ?? ""
                personalityCommunicationStyle = row.personality?.communication_style ?? ""
                personalityQuirks = row.personality?.quirks_habits ?? ""

                goalsPrimary = row.goals?.primary_goal ?? ""
                goalsSecretDesire = row.goals?.secret_desire ?? ""
                goalsFearsToOvercome = row.goals?.fears_to_overcome ?? ""
                goalsWouldSacrifice = row.goals?.would_sacrifice ?? ""

                worldOrigin = row.worldbuilding?.origin_birthplace ?? ""
                worldBackstory = row.worldbuilding?.backstory ?? ""
                worldSetting = row.worldbuilding?.world_setting ?? ""
                worldSpecialAbilities = row.worldbuilding?.special_abilities ?? ""
            }

            // Personas for the Default-persona picker.
            struct PersonaRow: Decodable {
                let id: String
                let name: String?
            }
            let personas: [PersonaRow] = (try? await client
                .from("user_personas")
                .select("id, name")
                .order("created_at", ascending: true)
                .execute()
                .value) ?? []
            availablePersonas = personas.map {
                PersonaOption(id: $0.id, name: $0.name ?? "Untitled persona")
            }
        } catch {
            // Soft-fail — keep defaults. Editor still works on shallow fields.
        }
        deepLoaded = true
    }

    var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && saveState != .saving
    }

    /// Saves to Supabase via upsert. Returns the saved row id on success.
    @discardableResult
    func save() async -> String? {
        guard canSave else { return nil }
        saveState = .saving

        // Build JSONB sub-objects only if any field is non-empty so we don't
        // overwrite legitimate-null with a blob full of empty strings.
        struct PersonalityPayload: Encodable {
            let core_traits: String?
            let fears_insecurities: String?
            let communication_style: String?
            let quirks_habits: String?
        }
        struct GoalsPayload: Encodable {
            let primary_goal: String?
            let secret_desire: String?
            let fears_to_overcome: String?
            let would_sacrifice: String?
        }
        struct WorldPayload: Encodable {
            let origin_birthplace: String?
            let backstory: String?
            let world_setting: String?
            let special_abilities: String?
        }

        let personality: PersonalityPayload? = {
            let entries = [personalityCoreTraits, personalityFears, personalityCommunicationStyle, personalityQuirks]
            guard entries.contains(where: { !$0.isEmpty }) else { return nil }
            return PersonalityPayload(
                core_traits:        personalityCoreTraits.isEmpty ? nil : personalityCoreTraits,
                fears_insecurities: personalityFears.isEmpty ? nil : personalityFears,
                communication_style: personalityCommunicationStyle.isEmpty ? nil : personalityCommunicationStyle,
                quirks_habits:      personalityQuirks.isEmpty ? nil : personalityQuirks
            )
        }()
        let goals: GoalsPayload? = {
            let entries = [goalsPrimary, goalsSecretDesire, goalsFearsToOvercome, goalsWouldSacrifice]
            guard entries.contains(where: { !$0.isEmpty }) else { return nil }
            return GoalsPayload(
                primary_goal:       goalsPrimary.isEmpty ? nil : goalsPrimary,
                secret_desire:      goalsSecretDesire.isEmpty ? nil : goalsSecretDesire,
                fears_to_overcome:  goalsFearsToOvercome.isEmpty ? nil : goalsFearsToOvercome,
                would_sacrifice:    goalsWouldSacrifice.isEmpty ? nil : goalsWouldSacrifice
            )
        }()
        let world: WorldPayload? = {
            let entries = [worldOrigin, worldBackstory, worldSetting, worldSpecialAbilities]
            guard entries.contains(where: { !$0.isEmpty }) else { return nil }
            return WorldPayload(
                origin_birthplace:  worldOrigin.isEmpty ? nil : worldOrigin,
                backstory:          worldBackstory.isEmpty ? nil : worldBackstory,
                world_setting:      worldSetting.isEmpty ? nil : worldSetting,
                special_abilities:  worldSpecialAbilities.isEmpty ? nil : worldSpecialAbilities
            )
        }()

        do {
            if let id = existingID {
                struct UpdatePayload: Encodable {
                    let name: String
                    let tagline: String?
                    let scenario: String?
                    let system_prompt: String
                    let accent_color: String
                    let appearance_description: String?
                    let append_appearance_to_image_prompts: Bool
                    let character_memory_enabled: Bool
                    let default_persona_id: String?
                    let personality: PersonalityPayload?
                    let goals: GoalsPayload?
                    let worldbuilding: WorldPayload?
                }
                let payload = UpdatePayload(
                    name: name.trimmingCharacters(in: .whitespaces),
                    tagline: tagline.isEmpty ? nil : tagline,
                    scenario: scenario.isEmpty ? nil : scenario,
                    system_prompt: systemPrompt,
                    accent_color: normalizedAccent(),
                    appearance_description: appearanceDescription.isEmpty ? nil : appearanceDescription,
                    append_appearance_to_image_prompts: appendAppearanceToImagePrompts,
                    character_memory_enabled: characterMemoryEnabled,
                    default_persona_id: defaultPersonaID,
                    personality: personality,
                    goals: goals,
                    worldbuilding: world
                )
                try await client
                    .from("characters")
                    .update(payload)
                    .eq("id", value: id)
                    .execute()
                saveState = .saved
                return id
            } else {
                struct InsertPayload: Encodable {
                    let name: String
                    let tagline: String?
                    let scenario: String?
                    let system_prompt: String
                    let accent_color: String
                    let mode: String
                    let english_style: String
                    let appearance_description: String?
                    let append_appearance_to_image_prompts: Bool
                    let character_memory_enabled: Bool
                    let default_persona_id: String?
                    let personality: PersonalityPayload?
                    let goals: GoalsPayload?
                    let worldbuilding: WorldPayload?
                }
                let payload = InsertPayload(
                    name: name.trimmingCharacters(in: .whitespaces),
                    tagline: tagline.isEmpty ? nil : tagline,
                    scenario: scenario.isEmpty ? nil : scenario,
                    system_prompt: systemPrompt,
                    accent_color: normalizedAccent(),
                    mode: "roleplay",
                    english_style: "neutral_american",
                    appearance_description: appearanceDescription.isEmpty ? nil : appearanceDescription,
                    append_appearance_to_image_prompts: appendAppearanceToImagePrompts,
                    character_memory_enabled: characterMemoryEnabled,
                    default_persona_id: defaultPersonaID,
                    personality: personality,
                    goals: goals,
                    worldbuilding: world
                )
                struct InsertedRow: Decodable { let id: String }
                let inserted: [InsertedRow] = try await client
                    .from("characters")
                    .insert(payload)
                    .select("id")
                    .execute()
                    .value
                saveState = .saved
                return inserted.first?.id
            }
        } catch {
            saveState = .error(error.localizedDescription)
            return nil
        }
    }

    func delete() async -> Bool {
        guard let id = existingID else { return false }
        saveState = .saving
        do {
            try await client.from("characters").delete().eq("id", value: id).execute()
            saveState = .saved
            return true
        } catch {
            saveState = .error(error.localizedDescription)
            return false
        }
    }


    /// POST `/characters/{id}/generate-avatar`. On success, the backend
    /// writes a new `avatar_ref` to the row — we refetch the avatar_ref
    /// so the form reflects it.
    func generateAvatar() async -> String? {
        guard let id = existingID else { return nil }
        saveState = .saving
        do {
            let session = try await client.auth.session
            let jwt = session.accessToken
            var request = URLRequest(url: BackendConfig.url
                .appendingPathComponent("characters")
                .appendingPathComponent(id)
                .appendingPathComponent("generate-avatar"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
            request.timeoutInterval = 120
            request.httpBody = Data("{}".utf8)

            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                let body = String(data: data, encoding: .utf8) ?? "Unknown error"
                saveState = .error(body)
                return nil
            }
            struct AvatarResponse: Decodable { let avatar_ref: String? }
            let decoded = try JSONDecoder().decode(AvatarResponse.self, from: data)
            if let newRef = decoded.avatar_ref {
                avatarRef = newRef
            }
            saveState = .saved
            return decoded.avatar_ref
        } catch {
            saveState = .error(error.localizedDescription)
            return nil
        }
    }


    /// Upload user-picked photo bytes to the `avatars` bucket and persist
    /// `characters.avatar_ref`. Mirrors `PersonaEditViewModel.uploadPhoto`.
    @discardableResult
    func uploadPhoto(data: Data, fileExtension: String) async -> String? {
        guard let id = existingID else { return nil }
        saveState = .saving
        do {
            let session = try await client.auth.session
            let userID = session.user.id.uuidString
            let timestamp = Int(Date().timeIntervalSince1970 * 1000)
            let cleanExt = fileExtension.lowercased().trimmingCharacters(in: .punctuationCharacters)
            let safeExt = cleanExt.isEmpty ? "png" : cleanExt
            let path = "\(userID)/character-\(id)-\(timestamp).\(safeExt)"

            _ = try await client.storage
                .from("avatars")
                .upload(path, data: data, options: FileOptions(contentType: Self.contentType(for: safeExt), upsert: false))

            let previous = avatarRef

            struct Update: Encodable { let avatar_ref: String }
            try await client
                .from("characters")
                .update(Update(avatar_ref: path))
                .eq("id", value: id)
                .execute()
            avatarRef = path

            if let previous, !previous.isEmpty, previous != path {
                _ = try? await client.storage.from("avatars").remove(paths: [previous])
            }

            saveState = .saved
            return path
        } catch {
            saveState = .error(error.localizedDescription)
            return nil
        }
    }

    /// Clear the character's photo: null `avatar_ref` + best-effort storage cleanup.
    @discardableResult
    func removePhoto() async -> Bool {
        guard let id = existingID, let previous = avatarRef, !previous.isEmpty else { return false }
        saveState = .saving
        do {
            struct Update: Encodable { let avatar_ref: String? }
            try await client
                .from("characters")
                .update(Update(avatar_ref: nil))
                .eq("id", value: id)
                .execute()
            _ = try? await client.storage.from("avatars").remove(paths: [previous])
            avatarRef = nil
            saveState = .saved
            return true
        } catch {
            saveState = .error(error.localizedDescription)
            return false
        }
    }

    private static func contentType(for ext: String) -> String {
        switch ext {
        case "jpg", "jpeg": return "image/jpeg"
        case "webp":        return "image/webp"
        case "heic":        return "image/heic"
        case "gif":         return "image/gif"
        default:            return "image/png"
        }
    }

    private func normalizedAccent() -> String {
        let trimmed = accentHex.trimmingCharacters(in: .whitespaces)
        return trimmed.hasPrefix("#") ? trimmed : "#" + trimmed
    }
}
