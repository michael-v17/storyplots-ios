import SwiftUI
import Supabase

/// LLM-assisted character creation. Asks the user for an idea + a few knobs,
/// POSTs `/character-generate`, then prefills the standard create-wizard
/// form with the LLM result so the user can edit + save.
struct CharacterGenerateSheet: View {
    let client: SupabaseClient
    let onSaved: (String) -> Void

    @State private var idea: String = ""
    @State private var dramaLevel: String = "medium"
    @State private var nsfwAllowed: Bool = false
    @State private var genderHint: String = "any"
    @State private var ageRange: String = "any"
    @State private var toneHint: String = "any"

    @State private var generating: Bool = false
    @State private var error: String?
    @State private var prefill: CharacterRefineResult?

    @Environment(\.dismiss) private var dismiss

    private let dramaOptions = ["none", "light", "medium", "heavy"]
    private let genderOptions = ["any", "female", "male", "non_binary", "unspecified"]
    private let ageOptions = ["any", "young_adult", "adult", "mid_life", "older"]
    private let toneOptions = ["any", "slice_of_life", "contemporary", "historical", "fantasy", "scifi", "surreal"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Your idea") {
                    TextEditor(text: $idea).frame(minHeight: 120)
                    Text("\(idea.count) / 2000")
                        .font(Theme.FontStyle.timestamp).foregroundStyle(Theme.Color.fg3)
                }

                Section("Tuning") {
                    Picker("Drama level", selection: $dramaLevel) {
                        ForEach(dramaOptions, id: \.self) { Text($0.capitalized).tag($0) }
                    }
                    Picker("Gender hint", selection: $genderHint) {
                        ForEach(genderOptions, id: \.self) { Text($0.replacingOccurrences(of: "_", with: " ").capitalized).tag($0) }
                    }
                    Picker("Age range", selection: $ageRange) {
                        ForEach(ageOptions, id: \.self) { Text($0.replacingOccurrences(of: "_", with: " ").capitalized).tag($0) }
                    }
                    Picker("Tone", selection: $toneHint) {
                        ForEach(toneOptions, id: \.self) { Text($0.replacingOccurrences(of: "_", with: " ").capitalized).tag($0) }
                    }
                    Toggle("Allow NSFW content", isOn: $nsfwAllowed)
                }

                if let error {
                    Section { Text(error).foregroundStyle(Theme.Color.destructive) }
                }
            }
            .navigationTitle("Generate character")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(generating ? "Generating…" : "Generate") {
                        Task { await runGenerate() }
                    }
                    .disabled(generating || idea.count < 20 || idea.count > 2000)
                }
            }
            .sheet(item: $prefill) { result in
                GeneratedCharacterReviewSheet(
                    client: client,
                    prefill: result,
                    onSaved: { id in
                        onSaved(id)
                        dismiss()
                    }
                )
            }
        }
        .presentationDetents([.large])
    }

    private func runGenerate() async {
        generating = true
        defer { generating = false }
        error = nil
        do {
            let session = try await client.auth.session
            let jwt = session.accessToken
            var request = URLRequest(url: BackendConfig.url.appendingPathComponent("character-generate"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
            request.timeoutInterval = 90
            let body: [String: Any] = [
                "idea": idea,
                "drama_level": dramaLevel,
                "nsfw_allowed": nsfwAllowed,
                "gender_hint": genderHint,
                "age_range_hint": ageRange,
                "tone_hint": toneHint
            ]
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                let body = String(data: data, encoding: .utf8) ?? "Unknown error"
                error = body
                return
            }
            let decoded = try JSONDecoder().decode(CharacterRefineResult.self, from: data)
            Haptics.notify(.success)
            prefill = decoded
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// Response shape for /character-generate + /character-refine (subset).
struct CharacterRefineResult: Decodable, Identifiable, Sendable {
    var id: String { name + (tagline ?? "") }
    let name: String
    let tagline: String?
    let scenario: String?
    let system_prompt: String?
    let age: String?
    let gender: String?
    let mode: String?
}

private struct GeneratedCharacterReviewSheet: View {
    let client: SupabaseClient
    let prefill: CharacterRefineResult
    let onSaved: (String) -> Void

    @State private var model: CharacterEditViewModel
    @Environment(\.dismiss) private var dismiss

    init(client: SupabaseClient, prefill: CharacterRefineResult, onSaved: @escaping (String) -> Void) {
        self.client = client
        self.prefill = prefill
        self.onSaved = onSaved
        let m = CharacterEditViewModel(client: client)
        m.name = prefill.name
        m.tagline = prefill.tagline ?? ""
        m.scenario = prefill.scenario ?? ""
        m.systemPrompt = prefill.system_prompt ?? ""
        _model = State(initialValue: m)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Identity") {
                    TextField("Name", text: $model.name)
                    TextField("Tagline", text: $model.tagline)
                }
                Section("Scenario") {
                    TextField("Opening scenario", text: $model.scenario, axis: .vertical)
                        .lineLimit(3...10)
                }
                Section("System prompt") {
                    TextField("Personality, voice, rules", text: $model.systemPrompt, axis: .vertical)
                        .lineLimit(5...20)
                }
                Section("Accent") {
                    AccentPicker(hex: $model.accentHex)
                        .padding(.vertical, Theme.Spacing.s2)
                }
                if case .error(let m) = model.saveState {
                    Section { Text(m).foregroundStyle(Theme.Color.destructive).font(Theme.FontStyle.meta) }
                }
                Section {
                    Text("Generated with the Text Engine. Review and edit before saving — the LLM gets you 80% there.")
                        .font(Theme.FontStyle.meta).foregroundStyle(Theme.Color.fg3)
                }
            }
            .navigationTitle("Review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Discard") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            if let id = await model.save() {
                                Haptics.notify(.success)
                                onSaved(id)
                                dismiss()
                            }
                        }
                    }
                    .disabled(!model.canSave)
                }
            }
        }
        .presentationDetents([.large])
    }
}
