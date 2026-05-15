import SwiftUI
import Supabase
import PhotosUI
import OSLog
import ImageIO
import UniformTypeIdentifiers

private let importLog = Logger(subsystem: "com.storyplots.ios", category: "character-import")

/// Imports a character from a PNG card carrying the well-known `chara` /
/// `ccv3` tEXt chunk (Character Card v1/v2/v3). Posts the parsed payload to
/// `/character-refine` and presents a review-style sheet for the user to
/// confirm the refined result.
struct CharacterImportSheet: View {
    let client: SupabaseClient
    let onImported: (Character?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var pickerItem: PhotosPickerItem?
    @State private var phase: Phase = .idle
    @State private var refined: RefinedDraft?

    enum Phase: Equatable {
        case idle
        case loadingImage
        case parsing
        case refining
        case ready
        case error(String)
    }

    struct RefinedDraft: Equatable {
        var name: String
        var tagline: String
        var scenario: String
        var systemPrompt: String
        var firstMessage: String
        var format: CharacterCardFormat
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    intro
                } header: {
                    Text("Import character card")
                }

                Section {
                    PhotosPicker(
                        selection: $pickerItem,
                        matching: .images
                    ) {
                        Label {
                            Text(pickerItem == nil ? "Choose PNG card" : "Choose another PNG")
                                .foregroundStyle(Theme.Color.fg)
                        } icon: {
                            Image(systemName: "photo.badge.plus")
                                .foregroundStyle(Theme.Color.brand1)
                        }
                    }
                    .onChange(of: pickerItem) { _, newValue in
                        guard let newValue else { return }
                        Task { @MainActor in await consume(item: newValue) }
                    }
                }

                if case .error(let message) = phase {
                    Section {
                        Text(message)
                            .font(Theme.FontStyle.meta)
                            .foregroundStyle(Theme.Color.destructive)
                    }
                }

                if let draft = refined {
                    Section("Refined") {
                        Text(draft.name)
                            .font(Theme.FontStyle.body.weight(.semibold))
                            .foregroundStyle(Theme.Color.fg)
                        if !draft.tagline.isEmpty {
                            Text(draft.tagline)
                                .font(Theme.FontStyle.meta)
                                .foregroundStyle(Theme.Color.fg2)
                        }
                        Text("Detected: \(draft.format.rawValue)")
                            .font(Theme.FontStyle.timestamp)
                            .foregroundStyle(Theme.Color.fg3)
                    }
                }

                progressSection
            }
            .scrollContentBackground(.hidden)
            .background(Theme.Color.bg)
            .navigationTitle("Import")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(refined == nil || phase == .refining)
                }
            }
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("Pick a Character Card PNG (v1, v2, or v3). We'll parse the embedded JSON and let the backend refine it into a StoryPlots character.")
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.fg2)
        }
    }

    @ViewBuilder
    private var progressSection: some View {
        switch phase {
        case .loadingImage:
            Section { ProgressView("Reading image…").tint(Theme.Color.brand1) }
        case .parsing:
            Section { ProgressView("Parsing card…").tint(Theme.Color.brand1) }
        case .refining:
            Section { ProgressView("Refining with backend…").tint(Theme.Color.brand1) }
        default:
            EmptyView()
        }
    }

    private func consume(item: PhotosPickerItem) async {
        phase = .loadingImage
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                phase = .error("Couldn't read the picked image.")
                return
            }
            phase = .parsing
            let parsed: ParsedCharacterCard
            do {
                parsed = try CharacterCardParser.parse(pngData: data)
            } catch let error as CharacterCardParserError {
                phase = .error(error.userMessage)
                return
            }
            phase = .refining
            let draft = try await refine(parsed)
            refined = draft
            phase = .ready
        } catch {
            importLog.error("import failed: \(error.localizedDescription, privacy: .public)")
            phase = .error("Import failed: \(error.localizedDescription)")
        }
    }

    private func refine(_ parsed: ParsedCharacterCard) async throws -> RefinedDraft {
        let session = try await client.auth.session
        let jwt = session.accessToken
        var request = URLRequest(url: BackendConfig.url.appendingPathComponent("character-refine"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
        let body: [String: Any] = [
            "raw_card": parsed.rawCard,
            "format": parsed.format.rawValue,
            "group_size": 1
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 60

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            let body = String(data: data, encoding: .utf8) ?? ""
            importLog.error("refine http=\(code, privacy: .public) body=\(body, privacy: .public)")
            throw NSError(domain: "Import", code: code, userInfo: [NSLocalizedDescriptionKey: "Refine failed (HTTP \(code))"])
        }
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        let firstGroup = (json["groups"] as? [[String: Any]])?.first ?? json
        return RefinedDraft(
            name: (firstGroup["name"] as? String) ?? "Imported character",
            tagline: (firstGroup["tagline"] as? String) ?? "",
            scenario: (firstGroup["scenario"] as? String) ?? "",
            systemPrompt: (firstGroup["system_prompt"] as? String) ?? "",
            firstMessage: (firstGroup["first_message"] as? String) ?? "",
            format: parsed.format
        )
    }

    private func save() async {
        guard let draft = refined else { return }
        do {
            struct Insert: Encodable {
                let name: String
                let tagline: String?
                let scenario: String?
                let system_prompt: String?
                let mode: String
            }
            let payload = Insert(
                name: draft.name,
                tagline: draft.tagline.isEmpty ? nil : draft.tagline,
                scenario: draft.scenario.isEmpty ? nil : draft.scenario,
                system_prompt: draft.systemPrompt.isEmpty ? nil : draft.systemPrompt,
                mode: "roleplay"
            )
            let inserted: [Character] = try await client
                .from("characters")
                .insert(payload)
                .select("id, name, tagline, avatar_ref, accent_color, scenario, age, gender, system_prompt, mode, updated_at")
                .execute()
                .value
            onImported(inserted.first)
            dismiss()
        } catch {
            importLog.error("save failed: \(error.localizedDescription, privacy: .public)")
            phase = .error("Save failed: \(error.localizedDescription)")
        }
    }
}
