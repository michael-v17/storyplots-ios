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

            Section("Avatar") {
                VStack(alignment: .center, spacing: Theme.Spacing.s3) {
                    Button {
                        guard model.avatarRef != nil else { return }
                        Haptics.impact(.light)
                        showAvatarFullscreen = true
                    } label: {
                        AvatarView(
                            avatarRef: model.avatarRef,
                            name: model.name.isEmpty ? "?" : model.name,
                            accent: Color(hex: HomeViewModel.parseHex(model.accentHex) ?? 0xF5B547),
                            size: 132,
                            ringWidth: 2
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(model.avatarRef == nil)
                    .accessibilityLabel("Tap to view avatar")
                    .frame(maxWidth: .infinity)

                    Button {
                        Haptics.impact(.medium)
                        Task { _ = await model.generateAvatar() }
                    } label: {
                        HStack {
                            if model.saveState == .saving {
                                ProgressView()
                            } else {
                                Label("Generate avatar with AI", systemImage: "wand.and.stars")
                            }
                            Spacer()
                        }
                    }
                    .disabled(model.saveState == .saving)
                }
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
        .fullScreenCover(isPresented: $showAvatarFullscreen) {
            AvatarFullscreenViewer(avatarRef: model.avatarRef) {
                showAvatarFullscreen = false
            }
        }
    }

    @State private var showAvatarFullscreen: Bool = false
}
