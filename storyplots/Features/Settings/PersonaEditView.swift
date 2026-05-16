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
    @State private var showRemovePhotoConfirm: Bool = false
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
            Section {
                avatarHero
                    .listRowBackground(
                        LinearGradient(
                            colors: [Theme.Color.brand1.opacity(0.18), Theme.Color.brand2.opacity(0.08)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                PhotosPicker(selection: $pickerItem, matching: .images) {
                    Self.brandLabel("Upload from library", systemImage: "photo.on.rectangle.angled")
                }
                .onChange(of: pickerItem) { _, newValue in
                    guard let newValue else { return }
                    Task { await consumePicker(newValue) }
                }

                Button {
                    Haptics.impact(.medium)
                    Task { _ = await model.generateAvatar() }
                } label: {
                    Self.brandLabel("Generate with AI", systemImage: "wand.and.stars")
                }
                .disabled(model.saveState == .saving)

                if model.photoRef != nil {
                    Button(role: .destructive) {
                        showRemovePhotoConfirm = true
                    } label: {
                        Label {
                            Text("Remove photo")
                                .foregroundStyle(Theme.Color.destructive)
                        } icon: {
                            Image(systemName: "trash")
                                .foregroundStyle(Theme.Color.destructive)
                        }
                    }
                    .disabled(model.saveState == .saving)
                }
            } header: {
                Text("Avatar")
            }

            Section("Identity") {
                TextField("Name", text: $model.name)
                    .textInputAutocapitalization(.words)
            }

            Section {
                TextField("Describe how you look", text: $model.appearance, axis: .vertical)
                    .lineLimit(3...8)
            } header: {
                Text("Appearance")
            } footer: {
                Text("How you look — characters reference this when describing you on the page.")
                    .font(Theme.FontStyle.timestamp)
                    .foregroundStyle(Theme.Color.fg3)
            }

            Section {
                TextField("Your backstory and context", text: $model.backgroundStory, axis: .vertical)
                    .lineLimit(4...12)
            } header: {
                Text("Background")
            } footer: {
                Text("Backstory used to flesh out who you are — age, profession, history, anything relevant.")
                    .font(Theme.FontStyle.timestamp)
                    .foregroundStyle(Theme.Color.fg3)
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
                        HStack {
                            Spacer()
                            if model.saveState == .saving {
                                ProgressView()
                            } else {
                                Text("Delete persona")
                                    .foregroundStyle(Theme.Color.destructive)
                            }
                            Spacer()
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
        .confirmationDialog("Remove the current photo?", isPresented: $showRemovePhotoConfirm, titleVisibility: .visible) {
            Button("Remove photo", role: .destructive) {
                Task { _ = await model.removePhoto() }
            }
            Button("Cancel", role: .cancel) {}
        }
        .fullScreenCover(isPresented: $showAvatarFullscreen) {
            AvatarFullscreenViewer(avatarRef: model.photoRef) {
                showAvatarFullscreen = false
            }
        }
        .task { await model.load() }
    }

    @ViewBuilder
    private var avatarHero: some View {
        VStack(spacing: Theme.Spacing.s2) {
            Button {
                guard model.photoRef != nil else { return }
                Haptics.impact(.light)
                showAvatarFullscreen = true
            } label: {
                AvatarView(
                    avatarRef: model.photoRef,
                    name: model.name.isEmpty ? "?" : model.name,
                    accent: Theme.Color.brand1,
                    size: 120,
                    ringWidth: 2
                )
            }
            .buttonStyle(.plain)
            .disabled(model.photoRef == nil)
            .accessibilityLabel("Tap to view avatar")

            if model.photoRef == nil {
                Text("Add a photo or generate one with AI")
                    .font(Theme.FontStyle.timestamp)
                    .foregroundStyle(Theme.Color.fg3)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.Spacing.s3)
    }

    /// Same shape as `SettingsView.brandLabel` so the icon tints align with the
    /// rest of the Settings tree (amber on dark, body text on `fg`). `static`
    /// so it can be called from SwiftUI closures that the compiler infers as
    /// nonisolated (PhotosPicker's label, etc.).
    @ViewBuilder
    nonisolated private static func brandLabel(_ title: String, systemImage: String) -> some View {
        Label {
            Text(title)
                .foregroundStyle(Theme.Color.fg)
        } icon: {
            Image(systemName: systemImage)
                .foregroundStyle(Theme.Color.brand1)
        }
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
