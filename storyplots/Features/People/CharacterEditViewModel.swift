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

    init(client: SupabaseClient, character: Character? = nil) {
        self.client = client
        self.existingID = character?.id
        self.name = character?.name ?? ""
        self.tagline = character?.tagline ?? ""
        self.scenario = character?.scenario ?? ""
        self.systemPrompt = character?.system_prompt ?? ""
        self.accentHex = character?.accent_color ?? "#F5B547"
        self.avatarRef = character?.avatar_ref
    }

    var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && saveState != .saving
    }

    /// Saves to Supabase via upsert. Returns the saved row id on success.
    @discardableResult
    func save() async -> String? {
        guard canSave else { return nil }
        saveState = .saving
        do {
            // Insert or update directly.
            if let id = existingID {
                struct UpdatePayload: Encodable {
                    let name: String
                    let tagline: String?
                    let scenario: String?
                    let system_prompt: String
                    let accent_color: String
                }
                let payload = UpdatePayload(
                    name: name.trimmingCharacters(in: .whitespaces),
                    tagline: tagline.isEmpty ? nil : tagline,
                    scenario: scenario.isEmpty ? nil : scenario,
                    system_prompt: systemPrompt,
                    accent_color: normalizedAccent()
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
                    let append_appearance_to_image_prompts: Bool
                    let character_memory_enabled: Bool
                }
                let payload = InsertPayload(
                    name: name.trimmingCharacters(in: .whitespaces),
                    tagline: tagline.isEmpty ? nil : tagline,
                    scenario: scenario.isEmpty ? nil : scenario,
                    system_prompt: systemPrompt,
                    accent_color: normalizedAccent(),
                    mode: "roleplay",
                    english_style: "neutral_american",
                    append_appearance_to_image_prompts: false,
                    character_memory_enabled: false
                )
                let inserted: [Character] = try await client
                    .from("characters")
                    .insert(payload)
                    .select("id, name, tagline, avatar_ref, accent_color, scenario, age, gender, system_prompt, mode, updated_at")
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

    private func normalizedAccent() -> String {
        let trimmed = accentHex.trimmingCharacters(in: .whitespaces)
        return trimmed.hasPrefix("#") ? trimmed : "#" + trimmed
    }
}
