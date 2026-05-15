import SwiftUI
import Supabase

/// Edit a character. Reached via the "Edit" toolbar on `CharacterDetailView`.
struct CharacterEditView: View {
    @State private var model: CharacterEditViewModel
    @Environment(\.dismiss) private var dismiss
    let onSaved: () -> Void
    let onDeleted: () -> Void
    @State private var showDeleteConfirm = false

    init(client: SupabaseClient, character: Character, onSaved: @escaping () -> Void, onDeleted: @escaping () -> Void) {
        _model = State(initialValue: CharacterEditViewModel(client: client, character: character))
        self.onSaved = onSaved
        self.onDeleted = onDeleted
    }

    var body: some View {
        Form {
            Section("Identity") {
                TextField("Name", text: $model.name)
                TextField("Tagline", text: $model.tagline)
            }

            Section("Scenario") {
                TextField("Scenario", text: $model.scenario, axis: .vertical)
                    .lineLimit(3...8)
            }

            Section("System prompt") {
                TextField("System prompt", text: $model.systemPrompt, axis: .vertical)
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

            Section {
                Button(role: .destructive) {
                    showDeleteConfirm = true
                } label: {
                    if model.saveState == .saving {
                        ProgressView()
                    } else {
                        Text("Delete character")
                    }
                }
            }
        }
        .navigationTitle("Edit character")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task {
                        if await model.save() != nil {
                            onSaved()
                            dismiss()
                        }
                    }
                }
                .disabled(!model.canSave)
            }
        }
        .confirmationDialog("Delete this character?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task {
                    if await model.delete() {
                        onDeleted()
                        dismiss()
                    }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently removes the character. Existing conversations keep their character_snapshot.")
        }
    }
}
