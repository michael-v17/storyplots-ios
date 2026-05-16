import Foundation
import OSLog
import Supabase

private let personaLog = Logger(subsystem: "com.storyplots.ios", category: "persona-edit")

/// Drives `PersonaEditView`. Loads/saves a single `user_personas` row, uploads
/// a user-supplied photo to the `avatars` bucket, and proxies AI-avatar
/// generation through `POST /personas/me/generate-avatar`.
///
/// One row per (user_id, id). RLS auto-fills `user_id` on insert.
@MainActor
@Observable
final class PersonaEditViewModel {
    enum SaveState: Sendable, Equatable {
        case idle
        case saving
        case saved
        case error(String)
    }

    private(set) var existingID: String?
    var name: String = ""
    var appearance: String = ""
    var backgroundStory: String = ""
    var photoRef: String?
    private(set) var saveState: SaveState = .idle
    private(set) var isInitialLoad: Bool = true

    private let client: SupabaseClient

    init(client: SupabaseClient, personaID: String? = nil) {
        self.client = client
        self.existingID = personaID
        self.isInitialLoad = personaID != nil
    }

    var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && saveState != .saving
    }

    func load() async {
        guard let id = existingID else {
            isInitialLoad = false
            return
        }
        do {
            struct Row: Decodable {
                let id: String
                let name: String?
                let appearance: AnyCodable?
                let background_story: String?
                let photo_ref: String?
            }
            let rows: [Row] = try await client
                .from("user_personas")
                .select("id, name, appearance, background_story, photo_ref")
                .eq("id", value: id)
                .limit(1)
                .execute()
                .value
            if let row = rows.first {
                name = row.name ?? ""
                appearance = Self.decodeAppearance(row.appearance)
                backgroundStory = row.background_story ?? ""
                photoRef = row.photo_ref
            }
        } catch {
            saveState = .error(error.localizedDescription)
        }
        isInitialLoad = false
    }

    /// Insert or update. Returns the row id on success.
    @discardableResult
    func save() async -> String? {
        guard canSave else { return nil }
        saveState = .saving
        do {
            let trimmedName = name.trimmingCharacters(in: .whitespaces)
            let appearancePayload = appearance.isEmpty ? nil : AppearancePayload(extras: appearance)
            let backgroundValue = backgroundStory.isEmpty ? nil : backgroundStory

            if let id = existingID {
                struct Update: Encodable {
                    let name: String
                    let appearance: AppearancePayload?
                    let background_story: String?
                }
                try await client
                    .from("user_personas")
                    .update(Update(name: trimmedName, appearance: appearancePayload, background_story: backgroundValue))
                    .eq("id", value: id)
                    .execute()
                saveState = .saved
                return id
            } else {
                struct Insert: Encodable {
                    let name: String
                    let appearance: AppearancePayload?
                    let background_story: String?
                }
                struct InsertedRow: Decodable {
                    let id: String
                }
                let inserted: [InsertedRow] = try await client
                    .from("user_personas")
                    .insert(Insert(name: trimmedName, appearance: appearancePayload, background_story: backgroundValue))
                    .select("id")
                    .execute()
                    .value
                if let newID = inserted.first?.id {
                    existingID = newID
                }
                saveState = .saved
                return existingID
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
            // Best-effort cleanup of the avatar.
            if let ref = photoRef, !ref.isEmpty {
                _ = try? await client.storage.from("avatars").remove(paths: [ref])
            }
            try await client.from("user_personas").delete().eq("id", value: id).execute()
            saveState = .saved
            return true
        } catch {
            saveState = .error(error.localizedDescription)
            return false
        }
    }

    /// Upload user-picked photo bytes to the `avatars` bucket at
    /// `{user_id}/persona-{ts}.{ext}` and persist `photo_ref` on the row.
    /// Mirrors `base/frontend/src/lib/persona.ts uploadAvatar`.
    @discardableResult
    func uploadPhoto(data: Data, fileExtension: String) async -> String? {
        saveState = .saving
        do {
            // Ensure the row exists before we attach a photo to it.
            if existingID == nil {
                guard await save() != nil else { return nil }
            }
            guard let personaID = existingID else { return nil }

            let session = try await client.auth.session
            let userID = session.user.id.uuidString
            let timestamp = Int(Date().timeIntervalSince1970 * 1000)
            let cleanExt = fileExtension.lowercased().trimmingCharacters(in: .punctuationCharacters)
            let safeExt = cleanExt.isEmpty ? "png" : cleanExt
            let path = "\(userID)/persona-\(timestamp).\(safeExt)"

            _ = try await client.storage
                .from("avatars")
                .upload(path, data: data, options: FileOptions(contentType: contentType(for: safeExt), upsert: false))

            let previous = photoRef

            struct Update: Encodable { let photo_ref: String }
            try await client
                .from("user_personas")
                .update(Update(photo_ref: path))
                .eq("id", value: personaID)
                .execute()
            photoRef = path

            if let previous, !previous.isEmpty, previous != path {
                _ = try? await client.storage.from("avatars").remove(paths: [previous])
            }

            saveState = .saved
            return path
        } catch {
            personaLog.error("upload failed: \(error.localizedDescription, privacy: .public)")
            saveState = .error(error.localizedDescription)
            return nil
        }
    }

    /// POST `/personas/me/generate-avatar`. Backend writes `user_personas.photo_ref`
    /// to a new preview and returns it. We refetch into the view model so the
    /// avatar re-renders immediately.
    @discardableResult
    func generateAvatar() async -> String? {
        saveState = .saving
        do {
            // Ensure the row exists — backend looks up the user's persona by RLS.
            if existingID == nil {
                guard await save() != nil else { return nil }
            }

            let session = try await client.auth.session
            let jwt = session.accessToken
            var request = URLRequest(url: BackendConfig.url
                .appendingPathComponent("personas")
                .appendingPathComponent("me")
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
            struct AvatarResponse: Decodable { let photo_ref: String? }
            let decoded = try JSONDecoder().decode(AvatarResponse.self, from: data)
            if let newRef = decoded.photo_ref {
                photoRef = newRef
            }
            saveState = .saved
            return decoded.photo_ref
        } catch {
            saveState = .error(error.localizedDescription)
            return nil
        }
    }

    /// Backend stores `appearance` as JSONB with sub-keys like `skin`, `eyes`,
    /// `hair`, `extras`. The iOS editor is a single multiline field, so we round-
    /// trip through `extras` (preferred), falling back to any plain string value
    /// or a concatenation of non-empty sub-fields.
    private static func decodeAppearance(_ field: AnyCodable?) -> String {
        guard let value = field?.value else { return "" }
        if let dict = value as? [String: Any] {
            if let extras = dict["extras"] as? String, !extras.isEmpty {
                return extras
            }
            let joined = ["skin", "eyes", "hair", "extras"]
                .compactMap { (dict[$0] as? String)?.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
                .joined(separator: "\n")
            return joined
        }
        if let str = value as? String { return str }
        return ""
    }

    struct AppearancePayload: Encodable {
        let extras: String?
    }

    private func contentType(for ext: String) -> String {
        switch ext {
        case "jpg", "jpeg": return "image/jpeg"
        case "webp":        return "image/webp"
        case "heic":        return "image/heic"
        case "gif":         return "image/gif"
        default:            return "image/png"
        }
    }
}
