import SwiftUI
import Supabase

/// Edits the user's primary persona (the YOUR PERSONA pill on Home) —
/// `user_personas` row tied to the user's account.
struct ProfileView: View {
    let client: SupabaseClient

    @Environment(AuthStore.self) private var auth
    @State private var displayName: String = ""
    @State private var didLoad: Bool = false
    @State private var saving: Bool = false
    @State private var error: String?
    @State private var primaryPersona: PrimaryPersona?
    @State private var primaryPersonaLoading: Bool = true
    @State private var showAvatarFullscreen: Bool = false

    /// Minimal projection of the user's primary persona — enough to render the
    /// hero card and link into the editor. Avoids depending on the heavier
    /// `UserPersona` model so we can include `background_story` for the snippet.
    struct PrimaryPersona: Equatable {
        let id: String
        let name: String
        let photoRef: String?
        let snippet: String?
    }

    var body: some View {
        Form {
            Section {
                personaHero
                    .listRowBackground(
                        LinearGradient(
                            colors: [Theme.Color.brand1.opacity(0.18), Theme.Color.brand2.opacity(0.08)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            } header: {
                Text("Your persona")
            } footer: {
                Text("This is who you are inside conversations — characters address you by this persona.")
                    .font(Theme.FontStyle.timestamp)
                    .foregroundStyle(Theme.Color.fg3)
            }

            Section {
                NavigationLink(value: SettingsDestination.personas) {
                    Label("Manage all personas", systemImage: "person.2.crop.square.stack")
                        .foregroundStyle(Theme.Color.fg)
                }
            }

            Section("Account") {
                LabeledContent("Email") {
                    Text(auth.userEmail ?? "—")
                        .foregroundStyle(Theme.Color.fg2)
                }
                TextField("Display name", text: $displayName)
                    .textInputAutocapitalization(.words)
                    .submitLabel(.done)
                    .onSubmit { Task { await saveDisplayName() } }
            }

            if let error {
                Section {
                    Text(error)
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.destructive)
                }
            }

            Section {
                Button {
                    Task { await saveDisplayName() }
                } label: {
                    HStack {
                        Spacer()
                        if saving { ProgressView() } else { Text("Save changes") }
                        Spacer()
                    }
                }
                .disabled(saving || !didLoad)
            }

            Section {
                Button(role: .destructive) {
                    Haptics.notify(.warning)
                    Task { await auth.signOut() }
                } label: {
                    if auth.isLoading {
                        ProgressView()
                    } else {
                        Text("Sign out")
                    }
                }
                .disabled(auth.isLoading)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.Color.bg)
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(isPresented: $showAvatarFullscreen) {
            AvatarFullscreenViewer(avatarRef: primaryPersona?.photoRef) {
                showAvatarFullscreen = false
            }
        }
        .task { await load() }
    }

    @ViewBuilder
    private var personaHero: some View {
        if let persona = primaryPersona {
            NavigationLink {
                PersonaEditView(
                    client: client,
                    personaID: persona.id,
                    onSaved: { Task { await loadPrimaryPersona() } },
                    onDeleted: { Task { await loadPrimaryPersona() } }
                )
            } label: {
                HStack(spacing: Theme.Spacing.s4) {
                    Button {
                        guard persona.photoRef != nil else { return }
                        Haptics.impact(.light)
                        showAvatarFullscreen = true
                    } label: {
                        AvatarView(
                            avatarRef: persona.photoRef,
                            name: persona.name,
                            size: 64,
                            ringWidth: 2
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(persona.photoRef == nil)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(persona.name.isEmpty ? "Untitled persona" : persona.name)
                            .font(Theme.FontStyle.h3)
                            .foregroundStyle(Theme.Color.fg)
                            .lineLimit(1)
                        if let snippet = persona.snippet, !snippet.isEmpty {
                            Text(snippet)
                                .font(Theme.FontStyle.meta)
                                .foregroundStyle(Theme.Color.fg2)
                                .lineLimit(2)
                        } else {
                            Text("Tap to edit appearance, background, and photo")
                                .font(Theme.FontStyle.meta)
                                .foregroundStyle(Theme.Color.brand1)
                                .lineLimit(2)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .padding(.vertical, Theme.Spacing.s2)
            }
        } else if primaryPersonaLoading {
            HStack {
                ProgressView().tint(Theme.Color.brand1)
                Text("Loading persona…")
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg2)
            }
            .padding(.vertical, Theme.Spacing.s2)
        } else {
            NavigationLink(value: SettingsDestination.personas) {
                HStack(spacing: Theme.Spacing.s3) {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 28))
                        .foregroundStyle(Theme.Color.brand1)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Create your persona")
                            .font(Theme.FontStyle.h3)
                            .foregroundStyle(Theme.Color.fg)
                        Text("Give characters someone to talk to.")
                            .font(Theme.FontStyle.meta)
                            .foregroundStyle(Theme.Color.fg2)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.vertical, Theme.Spacing.s2)
            }
        }
    }

    private func load() async {
        async let displayNameLoad: Void = loadDisplayName()
        async let personaLoad: Void = loadPrimaryPersona()
        _ = await (displayNameLoad, personaLoad)
        didLoad = true
    }

    private func loadDisplayName() async {
        let store = PreferenceFamilyStore(client: client, family: "profile")
        let prefs = (try? await store.load()) ?? [:]
        if let v = prefs["display_name"] as? String {
            displayName = v
        }
    }

    private func loadPrimaryPersona() async {
        primaryPersonaLoading = true
        defer { primaryPersonaLoading = false }
        struct Row: Decodable {
            let id: String
            let name: String?
            let photo_ref: String?
            let appearance: AnyCodable?
            let background_story: String?
        }
        do {
            let rows: [Row] = try await client
                .from("user_personas")
                .select("id, name, photo_ref, appearance, background_story")
                .order("created_at", ascending: true)
                .limit(1)
                .execute()
                .value
            if let row = rows.first {
                let appearanceSnippet = Self.summarize(appearance: row.appearance)
                let backgroundSnippet = row.background_story?.trimmingCharacters(in: .whitespacesAndNewlines)
                let snippet = [appearanceSnippet, backgroundSnippet]
                    .compactMap { $0?.isEmpty == false ? $0 : nil }
                    .first
                primaryPersona = PrimaryPersona(
                    id: row.id,
                    name: (row.name ?? "").trimmingCharacters(in: .whitespaces),
                    photoRef: row.photo_ref,
                    snippet: snippet
                )
            } else {
                primaryPersona = nil
            }
        } catch {
            // Soft fail — keep the empty/create-persona state on error.
            primaryPersona = nil
        }
    }

    private static func summarize(appearance: AnyCodable?) -> String? {
        guard let value = appearance?.value else { return nil }
        if let dict = value as? [String: Any] {
            if let extras = dict["extras"] as? String, !extras.isEmpty {
                return extras
            }
            return ["skin", "eyes", "hair"]
                .compactMap { (dict[$0] as? String)?.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
                .joined(separator: ", ")
        }
        if let str = value as? String { return str }
        return nil
    }

    private func saveDisplayName() async {
        guard didLoad else { return }
        saving = true
        defer { saving = false }
        do {
            let store = PreferenceFamilyStore(client: client, family: "profile")
            try await store.save(["display_name": displayName])
            Haptics.notify(.success)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
