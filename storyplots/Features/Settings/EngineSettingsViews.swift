import SwiftUI
import Supabase

// MARK: - Image Engine

/// Read-only summary of the active image provider config. Editing the
/// underlying provider_configs row is intentionally deferred — these
/// values come from a longer-form flow.
struct ImageEngineSettingsView: View {
    let client: SupabaseClient

    @State private var rows: [ProviderConfigSummary] = []
    @State private var loadState: LoadState = .idle

    enum LoadState: Sendable, Equatable { case idle, loading, loaded, error(String) }

    struct ProviderConfigSummary: Decodable, Identifiable, Sendable {
        let id: String
        let label: String?
        let base_url: String?
        let workflow_config: WorkflowConfig?
        let is_active: Bool?

        struct WorkflowConfig: Decodable, Sendable {
            let checkpoint: String?
            let style_default: String?
        }
    }

    var body: some View {
        Form {
            Section {
                Text("Image generation runs against the active provider you've configured on the web client. Switch providers from there for now.")
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg3)
            }
            if rows.isEmpty {
                Section("Providers") {
                    if case .loading = loadState {
                        ProgressView()
                    } else {
                        Text("No image providers configured.")
                            .foregroundStyle(Theme.Color.fg3)
                    }
                }
            } else {
                Section("Providers") {
                    ForEach(rows) { row in
                        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                            HStack {
                                Text(row.label ?? row.id)
                                    .font(.headline)
                                Spacer()
                                if row.is_active == true {
                                    Text("ACTIVE")
                                        .font(.caption2.weight(.semibold))
                                        .padding(.horizontal, 6).padding(.vertical, 2)
                                        .background(Theme.Color.successSoft, in: Capsule())
                                        .foregroundStyle(Theme.Color.success)
                                }
                            }
                            if let base = row.base_url {
                                Text(base).font(.caption).foregroundStyle(Theme.Color.fg3)
                            }
                            if let cp = row.workflow_config?.checkpoint {
                                Text("Checkpoint: \(cp)").font(.caption).foregroundStyle(Theme.Color.fg2)
                            }
                            if let style = row.workflow_config?.style_default {
                                Text("Default style: \(style)").font(.caption).foregroundStyle(Theme.Color.fg2)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
        .navigationTitle("Image Engine")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        loadState = .loading
        do {
            let r: [ProviderConfigSummary] = try await client
                .from("provider_configs")
                .select("id, label, base_url, workflow_config, is_active")
                .eq("kind", value: "image")
                .execute()
                .value
            rows = r
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }
}

// MARK: - Memory Engine

/// Toggles for `users.memory_enabled` + retrieval params + extraction prompt.
struct MemoryEngineSettingsView: View {
    let client: SupabaseClient

    @State private var enabled: Bool = true
    @State private var topK: Int = 8
    @State private var minSimilarity: Double = 0.6
    @State private var extractionPrompt: String = ""
    @State private var loadState: LoadState = .idle
    @State private var saving: Bool = false

    enum LoadState: Sendable, Equatable { case idle, loading, loaded, error(String) }

    var body: some View {
        Form {
            Section {
                Toggle("Memory enabled", isOn: $enabled)
                    .onChange(of: enabled) { _, _ in
                        Haptics.selection()
                        Task { await save() }
                    }
            }
            Section("Retrieval") {
                Stepper(value: $topK, in: 1...32) {
                    HStack { Text("Top K"); Spacer(); Text("\(topK)").foregroundStyle(Theme.Color.fg2) }
                }
                .onChange(of: topK) { _, _ in Task { await save() } }
                VStack(alignment: .leading) {
                    HStack {
                        Text("Min similarity")
                        Spacer()
                        Text(String(format: "%.2f", minSimilarity))
                            .foregroundStyle(Theme.Color.fg2)
                            .monospacedDigit()
                    }
                    Slider(value: $minSimilarity, in: 0...1, step: 0.05) {
                        EmptyView()
                    } onEditingChanged: { ended in
                        if ended { Task { await save() } }
                    }
                }
            }
            Section("Extraction prompt") {
                TextEditor(text: $extractionPrompt)
                    .frame(minHeight: 120)
                Button(saving ? "Saving…" : "Save extraction prompt") {
                    Task { await save() }
                }
                .disabled(saving)
            }
        }
        .navigationTitle("Memory")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        loadState = .loading
        do {
            struct Row: Decodable {
                let memory_enabled: Bool?
                let memory_top_k: Int?
                let memory_min_similarity: Double?
                let memory_extraction_prompt: String?
            }
            let rows: [Row] = try await client
                .from("users")
                .select("memory_enabled, memory_top_k, memory_min_similarity, memory_extraction_prompt")
                .limit(1)
                .execute()
                .value
            if let row = rows.first {
                enabled = row.memory_enabled ?? true
                topK = row.memory_top_k ?? 8
                minSimilarity = row.memory_min_similarity ?? 0.6
                extractionPrompt = row.memory_extraction_prompt ?? ""
            }
            loadState = .loaded
        } catch {
            // Soft-fail — columns may not all exist; keep defaults.
            loadState = .loaded
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        do {
            struct Update: Encodable {
                let memory_enabled: Bool
                let memory_top_k: Int
                let memory_min_similarity: Double
                let memory_extraction_prompt: String
            }
            if let uid = try? await client.auth.session.user.id.uuidString {
                try await client
                    .from("users")
                    .update(Update(memory_enabled: enabled, memory_top_k: topK, memory_min_similarity: minSimilarity, memory_extraction_prompt: extractionPrompt))
                    .eq("id", value: uid)
                    .execute()
            }
        } catch {
            // Soft-fail.
        }
    }
}

// MARK: - Voice

/// Lists TTS providers + voice picker. Voices are fetched lazily from the
/// backend pass-through endpoint for the active TTS provider.
struct VoiceSettingsView: View {
    let client: SupabaseClient

    @State private var providers: [ProviderConfigSummary] = []
    @State private var voices: [Voice] = []
    @State private var activeVoiceID: String?
    @State private var loadState: LoadState = .idle

    enum LoadState: Sendable, Equatable { case idle, loading, loaded, error(String) }

    struct ProviderConfigSummary: Decodable, Identifiable, Sendable {
        let id: String
        let provider_type: String?
        let label: String?
        let voice_id_default: String?
        let is_active: Bool?
    }

    struct Voice: Decodable, Identifiable, Sendable {
        let voice_id: String
        let name: String?
        var id: String { voice_id }
    }

    var body: some View {
        Form {
            Section("TTS providers") {
                if providers.isEmpty {
                    Text("No TTS providers configured.").foregroundStyle(Theme.Color.fg3)
                } else {
                    ForEach(providers) { p in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(p.label ?? p.provider_type ?? p.id).font(.headline)
                                if let voice = p.voice_id_default {
                                    Text("Default voice: \(voice)").font(.caption).foregroundStyle(Theme.Color.fg3)
                                }
                            }
                            Spacer()
                            if p.is_active == true {
                                Text("ACTIVE")
                                    .font(.caption2.weight(.semibold))
                                    .padding(.horizontal, 6).padding(.vertical, 2)
                                    .background(Theme.Color.successSoft, in: Capsule())
                                    .foregroundStyle(Theme.Color.success)
                            }
                        }
                    }
                }
            }
            if !voices.isEmpty {
                Section("Available voices") {
                    ForEach(voices) { voice in
                        HStack {
                            Text(voice.name ?? voice.voice_id)
                            Spacer()
                            if voice.voice_id == activeVoiceID {
                                Image(systemName: "checkmark").foregroundStyle(Theme.Color.brand1)
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            Haptics.selection()
                            Task { await setActive(voice) }
                        }
                    }
                }
            }
        }
        .navigationTitle("Voice")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadProviders() }
    }

    private func loadProviders() async {
        loadState = .loading
        do {
            let p: [ProviderConfigSummary] = try await client
                .from("provider_configs")
                .select("id, provider_type, label, voice_id_default, is_active")
                .eq("kind", value: "tts")
                .execute()
                .value
            providers = p
            activeVoiceID = p.first(where: { $0.is_active == true })?.voice_id_default
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }

    private func setActive(_ voice: Voice) async {
        // Persistence path lives in TestFlight cycle — for now reflect locally.
        activeVoiceID = voice.voice_id
    }
}
