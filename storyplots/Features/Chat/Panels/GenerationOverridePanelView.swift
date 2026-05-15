import SwiftUI

/// Ephemeral overrides for the next image generation — passed as the body
/// of `POST /messages/{id}/images` instead of persisted in the DB. The
/// parent (ChatView) owns the binding and forwards it into the
/// `requestImage` call.
struct GenerationOverridePanelView: View {
    @Binding var overrides: GenerationOverrides

    @State private var pov: String = "default"
    @State private var shotFraming: String = "default"
    @State private var resolutionPreset: String = "default"
    @State private var styleOverride: String = "default"
    @State private var promptOverride: String = ""
    @Environment(\.dismiss) private var dismiss

    private let povOptions = [("default", "Inherit"), ("first_person", "First person"), ("third_person", "Third person")]
    private let shotOptions = [
        ("default", "Inherit"),
        ("close-up", "Close-up"),
        ("portrait", "Portrait"),
        ("medium_shot", "Medium"),
        ("cowboy_shot", "Cowboy"),
        ("full_body", "Full body")
    ]
    private let resolutionOptions = [
        ("default", "Inherit"),
        ("square_1024", "Square 1024"),
        ("portrait", "Portrait"),
        ("landscape", "Landscape"),
        ("tall_portrait", "Tall portrait"),
        ("wide_landscape", "Wide landscape")
    ]
    private let styleOptions = [
        ("default", "Inherit"),
        ("realistic", "Realistic"),
        ("anime", "Anime"),
        ("custom", "Custom")
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("POV") {
                    Picker("POV", selection: $pov) {
                        ForEach(povOptions, id: \.0) { opt in Text(opt.1).tag(opt.0) }
                    }
                }
                Section("Shot framing") {
                    Picker("Shot", selection: $shotFraming) {
                        ForEach(shotOptions, id: \.0) { opt in Text(opt.1).tag(opt.0) }
                    }
                }
                Section("Resolution") {
                    Picker("Resolution", selection: $resolutionPreset) {
                        ForEach(resolutionOptions, id: \.0) { opt in Text(opt.1).tag(opt.0) }
                    }
                }
                Section("Style") {
                    Picker("Style", selection: $styleOverride) {
                        ForEach(styleOptions, id: \.0) { opt in Text(opt.1).tag(opt.0) }
                    }
                }
                Section {
                    TextEditor(text: $promptOverride)
                        .frame(minHeight: 80)
                } header: {
                    Text("Prompt override (bypasses refiner LLM)")
                } footer: {
                    Text("Applies only to the next image generation. Leave fields at Inherit to use engine defaults.")
                        .font(Theme.FontStyle.timestamp)
                        .foregroundStyle(Theme.Color.fg3)
                }
            }
            .navigationTitle("Generation Override")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Reset") { reset() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        Haptics.notify(.success)
                        commit()
                        dismiss()
                    }
                }
            }
            .onAppear { hydrate() }
        }
        .presentationDetents([.large])
    }

    private func hydrate() {
        pov = overrides.pov ?? "default"
        shotFraming = overrides.shotFraming ?? "default"
        resolutionPreset = overrides.resolutionPreset ?? "default"
        styleOverride = overrides.styleOverride ?? "default"
        promptOverride = overrides.promptOverride ?? ""
    }

    private func reset() {
        pov = "default"
        shotFraming = "default"
        resolutionPreset = "default"
        styleOverride = "default"
        promptOverride = ""
    }

    private func commit() {
        overrides = GenerationOverrides(
            pov: pov == "default" ? nil : pov,
            shotFraming: shotFraming == "default" ? nil : shotFraming,
            resolutionPreset: resolutionPreset == "default" ? nil : resolutionPreset,
            promptOverride: promptOverride.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : promptOverride,
            styleOverride: styleOverride == "default" ? nil : styleOverride
        )
    }
}
