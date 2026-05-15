import SwiftUI
import Supabase

struct MemorySettingsView: View {
    let client: SupabaseClient

    @State private var enabled: Bool = true
    @State private var retentionDays: Int = 30
    @State private var extractionFrequency: String = "every_turn"
    @State private var saving: Bool = false

    var body: some View {
        Form {
            Section("Memory") {
                Toggle("Enabled", isOn: $enabled)
                    .tint(Theme.Color.brand1)
                    .onChange(of: enabled) { _, _ in
                        Haptics.selection()
                        Task { await save() }
                    }
            }

            Section("Retention") {
                Stepper(value: $retentionDays, in: 7...365, step: 7) {
                    HStack {
                        Text("Days to retain")
                        Spacer()
                        Text("\(retentionDays)")
                            .foregroundStyle(Theme.Color.fg2)
                    }
                }
                .onChange(of: retentionDays) { _, _ in
                    Task { await save() }
                }
            }

            Section("Extraction") {
                Picker("Frequency", selection: $extractionFrequency) {
                    Text("Every turn").tag("every_turn")
                    Text("Every 3 turns").tag("every_three")
                    Text("Daily").tag("daily")
                    Text("Manual").tag("manual")
                }
                .onChange(of: extractionFrequency) { _, _ in
                    Haptics.selection()
                    Task { await save() }
                }
            }

            Section {
                Text("These user-facing preferences are separate from the Memory Engine (provider / model / embedding) under Engines.")
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg3)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.Color.bg)
        .navigationTitle("Memory")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
        .task { await load() }
    }

    private func load() async {
        let store = PreferenceFamilyStore(client: client, family: "memory")
        let prefs = (try? await store.load()) ?? [:]
        if let e = prefs["enabled"] as? Bool { enabled = e }
        if let d = prefs["retention_days"] as? Int { retentionDays = d }
        if let f = prefs["extraction_frequency"] as? String { extractionFrequency = f }
    }

    private func save() async {
        saving = true; defer { saving = false }
        let store = PreferenceFamilyStore(client: client, family: "memory")
        try? await store.save([
            "enabled": enabled,
            "retention_days": retentionDays,
            "extraction_frequency": extractionFrequency
        ])
    }
}
