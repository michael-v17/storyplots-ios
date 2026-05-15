import SwiftUI
import Supabase

/// Minimal create flow per `seed/roadmap.md` §Fase 6. Single sheet (rather
/// than 3-step wizard) for speed — Phase 7+ can split into wizard if the
/// scope justifies it.
struct CharacterCreateSheet: View {
    @State private var model: CharacterEditViewModel
    @Environment(\.dismiss) private var dismiss
    let onSaved: (String) -> Void

    init(client: SupabaseClient, onSaved: @escaping (String) -> Void) {
        _model = State(initialValue: CharacterEditViewModel(client: client))
        self.onSaved = onSaved
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Identity") {
                    TextField("Name", text: $model.name)
                    TextField("Tagline (optional)", text: $model.tagline)
                }

                Section("Scenario") {
                    TextField("Opening scenario", text: $model.scenario, axis: .vertical)
                        .lineLimit(3...8)
                }

                Section("System prompt") {
                    TextField("Personality, voice, rules…", text: $model.systemPrompt, axis: .vertical)
                        .lineLimit(5...20)
                }

                Section("Accent") {
                    AccentPicker(hex: $model.accentHex)
                        .padding(.vertical, Theme.Spacing.s2)
                }

                if case .error(let m) = model.saveState {
                    Section {
                        Text(m).foregroundStyle(Theme.Color.destructive).font(Theme.FontStyle.meta)
                    }
                }
            }
            .navigationTitle("New character")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            if let id = await model.save() {
                                onSaved(id)
                                dismiss()
                            }
                        }
                    }
                    .disabled(!model.canSave)
                }
            }
        }
    }
}
