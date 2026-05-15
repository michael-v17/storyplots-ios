import SwiftUI
import Supabase

struct VisualRoleplaySettingsView: View {
    let client: SupabaseClient

    @State private var autoMode: Bool = false
    @State private var pov: String = "third_person"
    @State private var customInstructions: String = ""
    @State private var saving: Bool = false

    var body: some View {
        Form {
            Section("Mode") {
                Toggle("Auto mode", isOn: $autoMode)
                    .onChange(of: autoMode) { _, _ in
                        Haptics.selection()
                        Task { await save() }
                    }
                    .tint(Theme.Color.brand1)
                Picker("POV", selection: $pov) {
                    Text("First person").tag("first_person")
                    Text("Third person").tag("third_person")
                }
                .pickerStyle(.segmented)
                .onChange(of: pov) { _, _ in
                    Haptics.selection()
                    Task { await save() }
                }
            }

            Section("Custom instructions") {
                TextEditor(text: $customInstructions)
                    .font(Theme.FontStyle.body)
                    .foregroundStyle(Theme.Color.fg)
                    .frame(minHeight: 120)
                    .onChange(of: customInstructions) { _, _ in
                        Task { await save() }
                    }
                Text("Override how the visual prompt is built for image generation.")
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg3)
            }

            Section {
                if saving {
                    HStack {
                        ProgressView().tint(Theme.Color.brand1)
                        Text("Saving…")
                            .font(Theme.FontStyle.timestamp)
                            .foregroundStyle(Theme.Color.fg3)
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.Color.bg)
        .navigationTitle("Visual roleplay")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
        .task { await load() }
    }

    private func load() async {
        let store = PreferenceFamilyStore(client: client, family: "visual_roleplay")
        let prefs = (try? await store.load()) ?? [:]
        if let a = prefs["auto_mode"] as? Bool { autoMode = a }
        if let p = prefs["pov"] as? String { pov = p }
        if let i = prefs["custom_instructions"] as? String { customInstructions = i }
    }

    private func save() async {
        saving = true; defer { saving = false }
        let store = PreferenceFamilyStore(client: client, family: "visual_roleplay")
        try? await store.save([
            "auto_mode": autoMode,
            "pov": pov,
            "custom_instructions": customInstructions
        ])
    }
}
