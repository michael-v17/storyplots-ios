import SwiftUI
import Supabase

/// Upserts per-conversation overrides into `chat_controls_state`.
struct ChatControlsPanelView: View {
    let conversationID: String
    let client: SupabaseClient

    @State private var imageResolutionPreset: String = ""
    @State private var imageStyleOverride: String = "default"
    @State private var temperatureOverride: Double = 0.8
    @State private var maxTokensOverride: Int = 800
    @State private var loadState: LoadState = .idle
    @State private var saving: Bool = false
    @State private var error: String?
    @Environment(\.dismiss) private var dismiss

    enum LoadState: Sendable, Equatable { case idle, loading, loaded, error(String) }

    private let resolutionOptions = [
        ("default", "Inherit from engine"),
        ("square_1024", "Square 1024"),
        ("portrait", "Portrait"),
        ("landscape", "Landscape"),
        ("tall_portrait", "Tall portrait"),
        ("wide_landscape", "Wide landscape")
    ]

    private let styleOptions = ["default", "realistic", "anime", "custom"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Image overrides") {
                    Picker("Resolution", selection: $imageResolutionPreset) {
                        ForEach(resolutionOptions, id: \.0) { opt in
                            Text(opt.1).tag(opt.0)
                        }
                    }
                    Picker("Style", selection: $imageStyleOverride) {
                        ForEach(styleOptions, id: \.self) { opt in
                            Text(opt.capitalized).tag(opt)
                        }
                    }
                }
                Section("Text generation") {
                    VStack(alignment: .leading) {
                        HStack {
                            Text("Temperature")
                            Spacer()
                            Text(String(format: "%.2f", temperatureOverride))
                                .foregroundStyle(Theme.Color.fg2)
                                .monospacedDigit()
                        }
                        Slider(value: $temperatureOverride, in: 0.1...1.5, step: 0.05) {
                            EmptyView()
                        } onEditingChanged: { _ in Haptics.selection() }
                    }
                    Stepper(value: $maxTokensOverride, in: 100...4096, step: 100) {
                        HStack {
                            Text("Max tokens")
                            Spacer()
                            Text("\(maxTokensOverride)").foregroundStyle(Theme.Color.fg2)
                        }
                    }
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
                let image_resolution_preset: String?
                let image_style_override: String?
                let temperature_override: Double?
                let max_tokens_override: Int?
            }
            let rows: [Row] = try await client
                .from("chat_controls_state")
                .select("image_resolution_preset, image_style_override, temperature_override, max_tokens_override")
                .eq("conversation_id", value: conversationID)
                .limit(1)
                .execute()
                .value
            if let row = rows.first {
                imageResolutionPreset = row.image_resolution_preset ?? "default"
                imageStyleOverride = row.image_style_override ?? "default"
                temperatureOverride = row.temperature_override ?? 0.8
                maxTokensOverride = row.max_tokens_override ?? 800
            } else {
                imageResolutionPreset = "default"
            }
            loadState = .loaded
        } catch {
            // Soft-fail — first save creates the row.
            imageResolutionPreset = "default"
            loadState = .loaded
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        do {
            struct Payload: Encodable {
                let conversation_id: String
                let image_resolution_preset: String?
                let image_style_override: String?
                let temperature_override: Double
                let max_tokens_override: Int
            }
            let payload = Payload(
                conversation_id: conversationID,
                image_resolution_preset: imageResolutionPreset == "default" ? nil : imageResolutionPreset,
                image_style_override: imageStyleOverride == "default" ? nil : imageStyleOverride,
                temperature_override: temperatureOverride,
                max_tokens_override: maxTokensOverride
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
