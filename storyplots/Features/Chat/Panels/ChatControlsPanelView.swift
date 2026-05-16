import SwiftUI
import Supabase

/// Upserts per-conversation overrides into `chat_controls_state`.
struct ChatControlsPanelView: View {
    let conversationID: String
    let client: SupabaseClient

    @State private var resolutionPreset: String = "inherit"
    @State private var autoImages: Bool = false
    @State private var autoTTS: Bool = false
    @State private var loadState: LoadState = .idle
    @State private var saving: Bool = false
    @State private var error: String?
    @Environment(\.dismiss) private var dismiss

    enum LoadState: Sendable, Equatable { case idle, loading, loaded, error(String) }

    // Mirrors `_RESOLUTION_PRESETS` in base/backend/app/routes/image.py:57
    // (`inherit` = leave the DB value null so the engine default applies).
    private let resolutionOptions: [(String, String)] = [
        ("inherit",         "Inherit from engine"),
        ("square_1024",     "Square 1024×1024"),
        ("square_1408",     "Square 1408×1408"),
        ("portrait",        "Portrait 1280×1664"),
        ("landscape",       "Landscape 1664×1280"),
        ("tall_portrait",   "Tall portrait 1088×1920"),
        ("wide_landscape",  "Wide landscape 1920×1088"),
        ("ultra_tall",      "Ultra tall 1024×2048"),
        ("ultra_wide",      "Ultra wide 2048×1024")
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Image resolution") {
                    Picker("Preset", selection: $resolutionPreset) {
                        ForEach(resolutionOptions, id: \.0) { opt in
                            Text(opt.1).tag(opt.0)
                        }
                    }
                }
                Section("Automation") {
                    Toggle("Auto-generate images", isOn: $autoImages)
                    Toggle("Auto read-aloud (TTS)", isOn: $autoTTS)
                }
                if let error {
                    Section { Text(error).foregroundStyle(Theme.Color.destructive) }
                }
                Section {
                    Text("Per-conversation overrides — leave at defaults to inherit from your engine settings.")
                        .font(Theme.FontStyle.meta).foregroundStyle(Theme.Color.fg3)
                }
            }
            .navigationTitle("Chat Controls")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Saving…" : "Save") { Task { await save() } }
                        .disabled(saving)
                }
            }
            .task { await load() }
        }
        .presentationDetents([.large])
    }

    private func load() async {
        loadState = .loading
        do {
            struct Row: Decodable {
                let resolution_preset: String?
                let auto_images: Bool?
                let auto_tts: Bool?
            }
            let rows: [Row] = try await client
                .from("chat_controls_state")
                .select("resolution_preset, auto_images, auto_tts")
                .eq("conversation_id", value: conversationID)
                .limit(1)
                .execute()
                .value
            if let row = rows.first {
                resolutionPreset = row.resolution_preset ?? "inherit"
                autoImages = row.auto_images ?? false
                autoTTS = row.auto_tts ?? false
            }
            loadState = .loaded
        } catch {
            // First-time row simply doesn't exist yet — keep defaults.
            loadState = .loaded
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        do {
            let uid = try await client.auth.session.user.id.uuidString
            struct Payload: Encodable {
                let conversation_id: String
                let user_id: String
                let resolution_preset: String?
                let auto_images: Bool
                let auto_tts: Bool
            }
            let payload = Payload(
                conversation_id: conversationID,
                user_id: uid,
                resolution_preset: resolutionPreset == "inherit" ? nil : resolutionPreset,
                auto_images: autoImages,
                auto_tts: autoTTS
            )
            try await client
                .from("chat_controls_state")
                .upsert(payload, onConflict: "conversation_id")
                .execute()
            Haptics.notify(.success)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
