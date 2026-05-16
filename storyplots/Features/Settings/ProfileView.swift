import SwiftUI
import Supabase

/// Edits the user's primary persona (the YOUR PERSONA pill on Home) —
/// `user_personas` row tied to the user's account.
struct ProfileView: View {
    let client: SupabaseClient

    @Environment(AuthStore.self) private var auth
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
                    brandLabel("Manage all personas", systemImage: "person.2.crop.square.stack")
                }
            }

            Section("Account") {
                LabeledContent {
                    Text(auth.userEmail ?? "—")
                        .foregroundStyle(Theme.Color.fg2)
                } label: {
                    Text("Email")
                        .foregroundStyle(Theme.Color.fg)
                }
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
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.automatic, for: .navigationBar)
        .fullScreenCover(isPresented: $showAvatarFullscreen) {
            AvatarFullscreenViewer(avatarRef: primaryPersona?.photoRef) {
                showAvatarFullscreen = false
            }
        }
        .task { await loadPrimaryPersona() }
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

    /// Matches `SettingsView.brandLabel` so the icon tints align with the rest
    /// of the Settings tree.
    @ViewBuilder
    private func brandLabel(_ title: String, systemImage: String) -> some View {
        Label {
            Text(title)
                .foregroundStyle(Theme.Color.fg)
        } icon: {
            Image(systemName: systemImage)
                .foregroundStyle(Theme.Color.brand1)
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
}
