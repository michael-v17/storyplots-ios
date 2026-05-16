import SwiftUI
import PhotosUI
import Supabase

/// Edits one `user_personas` row. Avatar section mirrors the character editor:
/// tap to open the fullscreen viewer, upload a photo from the library, or
/// generate one via the backend's persona AI route.
struct PersonaEditView: View {
    @State private var model: PersonaEditViewModel
    @State private var pickerItem: PhotosPickerItem?
    @State private var showAvatarFullscreen: Bool = false
    @State private var showDeleteConfirm: Bool = false
    @Environment(\.dismiss) private var dismiss

    let onSaved: () -> Void
    let onDeleted: () -> Void

    init(client: SupabaseClient,
         personaID: String? = nil,
         onSaved: @escaping () -> Void = {},
         onDeleted: @escaping () -> Void = {}) {
        _model = State(initialValue: PersonaEditViewModel(client: client, personaID: personaID))
        self.onSaved = onSaved
        self.onDeleted = onDeleted
    }

    var body: some View {
        Form {
            Section("Identity") {
                TextField("Name", text: $model.name)
                    .textInputAutocapitalization(.words)
            }

            Section("Avatar") {
                VStack(alignment: .center, spacing: Theme.Spacing.s3) {
                    Button {
                        guard model.photoRef != nil else { return }
                        Haptics.impact(.light)
                        showAvatarFullscreen = true
                    } label: {
                        AvatarView(
                            avatarRef: model.photoRef,
                            name: model.name.isEmpty ? "?" : model.name,
                            accent: Theme.Color.brand1,
                            size: 132,
                            ringWidth: 2
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(model.photoRef == nil)
                    .accessibilityLabel("Tap to view avatar")
                    .frame(maxWidth: .infinity)

                    PhotosPicker(selection: $pickerItem, matching: .images) {
                        Label("Upload from library", systemImage: "photo.on.rectangle.angled")
                            .foregroundStyle(Theme.Color.fg)
                    }
                    .onChange(of: pickerItem) { _, newValue in
                        guard let newValue else { return }
                        Task { await consumePicker(newValue) }
                    }

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

            Section("Appearance") {
                TextField("Appearance", text: $model.appearance, axis: .vertical)
                    .lineLimit(3...8)
            }

            Section("Background") {
                TextField("Background", text: $model.backgroundStory, axis: .vertical)
                    .lineLimit(4...12)
            }

            if case .error(let m) = model.saveState {
                Section {
                    Text(m)
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.destructive)
                }
            }

            if model.existingID != nil {
                Section {
                    Button(role: .destructive) {
                        showDeleteConfirm = true
                    } label: {
                        if model.saveState == .saving {
                            ProgressView()
                        } else {
                            Text("Delete persona")
                        }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.Color.bg)
        .navigationTitle(model.existingID == nil ? "New persona" : "Edit persona")
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
        .confirmationDialog("Delete this persona?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
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
            Text("This removes the persona and its avatar. Existing conversations keep their persona_snapshot.")
        }
        .fullScreenCover(isPresented: $showAvatarFullscreen) {
            AvatarFullscreenViewer(avatarRef: model.photoRef) {
                showAvatarFullscreen = false
            }
        }
        .task { await model.load() }
    }

    private func consumePicker(_ item: PhotosPickerItem) async {
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else { return }
            let ext = item.supportedContentTypes
                .first?.preferredFilenameExtension
                ?? "png"
            _ = await model.uploadPhoto(data: data, fileExtension: ext)
        } catch {
            // Surfaced through model.saveState when upload itself fails; reading
            // the picked item failed silently here is fine.
        }
        pickerItem = nil
    }
}
