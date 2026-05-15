import SwiftUI
import Supabase

struct PromptEditorView: View {
    let client: SupabaseClient

    @State private var template: String = ""
    @State private var saving: Bool = false

    var body: some View {
        Form {
            Section {
                TextEditor(text: $template)
                    .font(Theme.FontStyle.body.monospaced())
                    .foregroundStyle(Theme.Color.fg)
                    .frame(minHeight: 220)
                    .onChange(of: template) { _, _ in
                        Task { await save() }
                    }
            } header: {
                Text("Template")
            } footer: {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Placeholders")
                        .font(Theme.FontStyle.timestamp.weight(.semibold))
                        .foregroundStyle(Theme.Color.fg2)
                    placeholderRow("{{char}}", "Character's name")
                    placeholderRow("{{user}}", "Your persona's display name")
                    placeholderRow("{{persona}}", "Your persona block")
                    placeholderRow("{{scenario}}", "Active scenario body")
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.Color.bg)
        .navigationTitle("Prompt editor")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
        .task { await load() }
    }

    @ViewBuilder
    private func placeholderRow(_ token: String, _ description: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
            Text(token)
                .font(Theme.FontStyle.timestamp.monospaced().weight(.semibold))
                .foregroundStyle(Theme.Color.brand1)
            Text(description)
                .font(Theme.FontStyle.timestamp)
                .foregroundStyle(Theme.Color.fg3)
        }
    }

    private func load() async {
        let store = PreferenceFamilyStore(client: client, family: "prompt_editor")
        let prefs = (try? await store.load()) ?? [:]
        if let t = prefs["template"] as? String { template = t }
    }

    private func save() async {
        saving = true; defer { saving = false }
        let store = PreferenceFamilyStore(client: client, family: "prompt_editor")
        try? await store.save([
            "template": template
        ])
    }
}
