import SwiftUI
import PhotosUI
import Supabase

/// 3-tab character editor matching PersonaLLM-Reference §3
/// (Avatar / Info / Settings — see base/Seed/PersonaLLM-Reference/04-screens/
/// character-info.md). Avatar tab opens with a hero in the same visual
/// language the persona editor uses, themed by the character's accent.
struct CharacterEditView: View {
    enum Tab: String, CaseIterable, Identifiable {
        case avatar  = "Avatar"
        case info    = "Info"
        case settings = "Settings"
        var id: String { rawValue }
    }

    @State private var model: CharacterEditViewModel
    @State private var activeTab: Tab = .avatar
    @State private var pickerItem: PhotosPickerItem?
    @State private var showAvatarFullscreen: Bool = false
    @State private var showDeleteConfirm: Bool = false
    @State private var showRemovePhotoConfirm: Bool = false
    @Environment(\.dismiss) private var dismiss

    let onSaved: () -> Void
    let onDeleted: () -> Void

    init(client: SupabaseClient, character: Character, onSaved: @escaping () -> Void, onDeleted: @escaping () -> Void) {
        _model = State(initialValue: CharacterEditViewModel(client: client, character: character))
        self.onSaved = onSaved
        self.onDeleted = onDeleted
    }

    private var accentColor: Color {
        Color(hex: HomeViewModel.parseHex(model.accentHex) ?? 0xF5B547)
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("Section", selection: $activeTab) {
                ForEach(Tab.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, Theme.Spacing.s4)
            .padding(.top, Theme.Spacing.s2)
            .padding(.bottom, Theme.Spacing.s2)
            .background(Theme.Color.bg)

            Form {
                switch activeTab {
                case .avatar:   avatarTab
                case .info:     infoTab
                case .settings: settingsTab
                }

                if case .error(let m) = model.saveState {
                    Section {
                        Text(m)
                            .font(Theme.FontStyle.meta)
                            .foregroundStyle(Theme.Color.destructive)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.Color.bg)
        }
        .background(Theme.Color.bg)
        .navigationTitle("Edit character")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.automatic, for: .navigationBar)
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
        .confirmationDialog("Remove the current photo?", isPresented: $showRemovePhotoConfirm, titleVisibility: .visible) {
            Button("Remove photo", role: .destructive) {
                Task { _ = await model.removePhoto() }
            }
            Button("Cancel", role: .cancel) {}
        }
        .fullScreenCover(isPresented: $showAvatarFullscreen) {
            AvatarFullscreenViewer(avatarRef: model.avatarRef) {
                showAvatarFullscreen = false
            }
        }
        .task { await model.loadDeep() }
    }

    // MARK: - Avatar tab

    @ViewBuilder
    private var avatarTab: some View {
        Section {
            avatarHero
                .listRowBackground(heroBackground)
        } header: {
            Text("Avatar")
        }

        Section {
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

            if model.avatarRef != nil {
                Button(role: .destructive) {
                    showRemovePhotoConfirm = true
                } label: {
                    Label {
                        Text("Remove photo").foregroundStyle(Theme.Color.destructive)
                    } icon: {
                        Image(systemName: "trash").foregroundStyle(Theme.Color.destructive)
                    }
                }
                .disabled(model.saveState == .saving)
            }
        }

        Section {
            TextField("Describe how the character looks", text: $model.appearanceDescription, axis: .vertical)
                .lineLimit(3...8)
            Toggle("Append to image prompts", isOn: $model.appendAppearanceToImagePrompts)
        } header: {
            Text("Appearance description")
        } footer: {
            Text("Used by AI avatar generation. When the toggle is on, this also gets prepended to every in-chat image prompt so the character stays visually consistent.")
                .font(Theme.FontStyle.timestamp)
                .foregroundStyle(Theme.Color.fg3)
        }

        Section {
            AccentPicker(hex: $model.accentHex)
                .padding(.vertical, Theme.Spacing.s2)
        } header: {
            Text("Accent color")
        } footer: {
            Text("Tints the chat surface, send button, and avatar ring for this character.")
                .font(Theme.FontStyle.timestamp)
                .foregroundStyle(Theme.Color.fg3)
        }
    }

    @ViewBuilder
    private var avatarHero: some View {
        VStack(spacing: Theme.Spacing.s2) {
            Button {
                guard model.avatarRef != nil else { return }
                Haptics.impact(.light)
                showAvatarFullscreen = true
            } label: {
                AvatarView(
                    avatarRef: model.avatarRef,
                    name: model.name.isEmpty ? "?" : model.name,
                    accent: accentColor,
                    size: 120,
                    ringWidth: 2
                )
            }
            .buttonStyle(.plain)
            .disabled(model.avatarRef == nil)
            .accessibilityLabel("Tap to view avatar")

            if model.avatarRef == nil {
                Text("Add a photo or generate one with AI")
                    .font(Theme.FontStyle.timestamp)
                    .foregroundStyle(Theme.Color.fg3)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.Spacing.s3)
    }

    private var heroBackground: some View {
        LinearGradient(
            colors: [accentColor.opacity(0.20), accentColor.opacity(0.06)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    // MARK: - Info tab

    @ViewBuilder
    private var infoTab: some View {
        Section("Identity") {
            TextField("Name", text: $model.name)
                .textInputAutocapitalization(.words)
            TextField("Tagline", text: $model.tagline)
        }

        Section {
            TextField("System prompt", text: $model.systemPrompt, axis: .vertical)
                .lineLimit(5...20)
        } header: {
            HStack {
                Text("System prompt")
                Spacer()
                Text("\(model.systemPrompt.count) / 2000")
                    .font(Theme.FontStyle.timestamp.monospacedDigit())
                    .foregroundStyle(
                        model.systemPrompt.count > 2000
                            ? Theme.Color.destructive
                            : Theme.Color.fg3
                    )
            }
        } footer: {
            Text("Describe your character's personality, background, and how they should respond.")
                .font(Theme.FontStyle.timestamp)
                .foregroundStyle(Theme.Color.fg3)
        }

        Section {
            TextField("Opening scene", text: $model.scenario, axis: .vertical)
                .lineLimit(3...10)
        } header: {
            Text("Scenario")
        } footer: {
            Text("Sets the opening scene of new conversations. Use *italics* for narration and \"quotes\" for dialogue.")
                .font(Theme.FontStyle.timestamp)
                .foregroundStyle(Theme.Color.fg3)
        }

        Section {
            DisclosureGroup {
                deepDiveField("Core traits", placeholder: "Key personality traits that define them", text: $model.personalityCoreTraits)
                deepDiveField("Fears & insecurities", placeholder: "What keeps them up at night", text: $model.personalityFears)
                deepDiveField("Communication style", placeholder: "How they talk and express themselves", text: $model.personalityCommunicationStyle)
                deepDiveField("Quirks & habits", placeholder: "Distinctive behaviors or mannerisms", text: $model.personalityQuirks)
            } label: {
                Label {
                    Text("Personality").foregroundStyle(Theme.Color.fg)
                } icon: {
                    Image(systemName: "hand.wave").foregroundStyle(Theme.Color.brand1)
                }
            }

            DisclosureGroup {
                deepDiveField("Primary goal", placeholder: "The one thing they're working toward", text: $model.goalsPrimary)
                deepDiveField("Secret desire", placeholder: "What they want but won't admit", text: $model.goalsSecretDesire)
                deepDiveField("Fears to overcome", placeholder: "Internal obstacles they must face", text: $model.goalsFearsToOvercome)
                deepDiveField("What they'd sacrifice", placeholder: "What they'd trade to achieve their goal", text: $model.goalsWouldSacrifice)
            } label: {
                Label {
                    Text("Goals & motivations").foregroundStyle(Theme.Color.fg)
                } icon: {
                    Image(systemName: "target").foregroundStyle(Theme.Color.brand1)
                }
            }

            DisclosureGroup {
                deepDiveField("Origin / Birthplace", placeholder: "Their homeland or place of origin", text: $model.worldOrigin)
                deepDiveField("Backstory", placeholder: "Key events that shaped them", text: $model.worldBackstory)
                deepDiveField("World / Setting", placeholder: "The setting or universe they exist in", text: $model.worldSetting)
                deepDiveField("Special abilities", placeholder: "Powers, skills, or unique capabilities", text: $model.worldSpecialAbilities)
            } label: {
                Label {
                    Text("Worldbuilding").foregroundStyle(Theme.Color.fg)
                } icon: {
                    Image(systemName: "globe").foregroundStyle(Theme.Color.brand1)
                }
            }
        } header: {
            Text("Optional deep dives")
        } footer: {
            Text("Optional structured fields. Empty groups don't ship to the prompt — fill them in for richer roleplay or leave them blank if the system prompt already covers it.")
                .font(Theme.FontStyle.timestamp)
                .foregroundStyle(Theme.Color.fg3)
        }
    }

    @ViewBuilder
    private func deepDiveField(_ label: String, placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(Theme.FontStyle.timestamp.weight(.semibold))
                .foregroundStyle(Theme.Color.fg2)
            TextField(placeholder, text: text, axis: .vertical)
                .lineLimit(2...6)
                .foregroundStyle(Theme.Color.fg)
        }
        .padding(.vertical, 4)
    }

    // MARK: - Settings tab

    @ViewBuilder
    private var settingsTab: some View {
        Section {
            HStack(spacing: Theme.Spacing.s3) {
                Image(systemName: modeIcon)
                    .foregroundStyle(Theme.Color.brand1)
                    .frame(width: 22)
                Text(modeDisplay)
                    .font(Theme.FontStyle.body)
                    .foregroundStyle(Theme.Color.fg)
                Spacer()
                Text("Read-only")
                    .font(Theme.FontStyle.timestamp)
                    .foregroundStyle(Theme.Color.fg3)
            }
            .padding(.vertical, 2)
        } header: {
            Text("Mode")
        } footer: {
            Text("Mode is set at creation and cannot be changed.")
                .font(Theme.FontStyle.timestamp)
                .foregroundStyle(Theme.Color.fg3)
        }

        Section {
            Picker(selection: $model.defaultPersonaID) {
                Text("None · Use app default").tag(String?.none)
                ForEach(model.availablePersonas) { persona in
                    Text(persona.name).tag(String?.some(persona.id))
                }
            } label: {
                Label {
                    Text("Default persona").foregroundStyle(Theme.Color.fg)
                } icon: {
                    Image(systemName: "person.crop.circle").foregroundStyle(Theme.Color.brand1)
                }
            }
        } header: {
            Text("Default persona")
        } footer: {
            Text("Persona used for new conversations with this character. Manage personas in Settings → Experience → Personas.")
                .font(Theme.FontStyle.timestamp)
                .foregroundStyle(Theme.Color.fg3)
        }

        Section {
            Toggle(isOn: $model.characterMemoryEnabled) {
                Label {
                    Text("Character memory").foregroundStyle(Theme.Color.fg)
                } icon: {
                    Image(systemName: "brain").foregroundStyle(Theme.Color.brand1)
                }
            }
        } header: {
            Text("Memory")
        } footer: {
            Text("\(model.name.isEmpty ? "This character" : model.name) remembers details across conversations — names, preferences, story events. When off, memory is limited to the current conversation.")
                .font(Theme.FontStyle.timestamp)
                .foregroundStyle(Theme.Color.fg3)
        }

        Section {
            Button(role: .destructive) {
                showDeleteConfirm = true
            } label: {
                HStack {
                    Spacer()
                    if model.saveState == .saving {
                        ProgressView()
                    } else {
                        Text("Delete character")
                            .foregroundStyle(Theme.Color.destructive)
                    }
                    Spacer()
                }
            }
        }
    }

    // MARK: - Helpers

    private var modeDisplay: String {
        switch model.modeRaw?.lowercased() {
        case "assistant": return "Assistant"
        default:          return "Roleplay"
        }
    }

    private var modeIcon: String {
        switch model.modeRaw?.lowercased() {
        case "assistant": return "sparkles"
        default:          return "theatermasks"
        }
    }

    nonisolated private static func brandLabel(_ title: String, systemImage: String) -> some View {
        Label {
            Text(title).foregroundStyle(Theme.Color.fg)
        } icon: {
            Image(systemName: systemImage).foregroundStyle(Theme.Color.brand1)
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
            // Surfaced through model.saveState when upload itself fails.
        }
        pickerItem = nil
    }
}
