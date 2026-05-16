import SwiftUI
import Supabase

/// Settings → Experience → Personas. Lists `user_personas` rows owned by the
/// signed-in user and offers a "+ New persona" entry that opens an empty
/// `PersonaEditView`. Each row pushes the editor pre-loaded with that persona.
struct PersonaListView: View {
    let client: SupabaseClient

    @State private var personas: [PersonaRow] = []
    @State private var loadState: LoadState = .idle

    enum LoadState: Sendable, Equatable {
        case idle
        case loading
        case loaded
        case error(String)
    }

    struct PersonaRow: Identifiable, Sendable, Equatable, Decodable {
        let id: String
        let name: String?
        let photo_ref: String?
    }

    var body: some View {
        Form {
            if personas.isEmpty, case .loading = loadState {
                Section {
                    HStack {
                        ProgressView().tint(Theme.Color.brand1)
                        Text("Loading personas…")
                            .font(Theme.FontStyle.meta)
                            .foregroundStyle(Theme.Color.fg2)
                    }
                }
            }
            if case .error(let m) = loadState {
                Section {
                    Text(m)
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.destructive)
                }
            }

            if !personas.isEmpty {
                Section {
                    ForEach(personas) { persona in
                        NavigationLink(value: PersonaListRoute.edit(personaID: persona.id)) {
                            personaRow(persona)
                        }
                    }
                }
            }

            Section {
                NavigationLink(value: PersonaListRoute.edit(personaID: nil)) {
                    Label("New persona", systemImage: "plus.circle.fill")
                        .foregroundStyle(Theme.Color.brand1)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.Color.bg)
        .navigationTitle("Personas")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: PersonaListRoute.self) { route in
            switch route {
            case .edit(let id):
                PersonaEditView(client: client, personaID: id, onSaved: {
                    Task { await load() }
                }, onDeleted: {
                    Task { await load() }
                })
            }
        }
        .refreshable { await load() }
        .task { await load() }
    }

    @ViewBuilder
    private func personaRow(_ persona: PersonaRow) -> some View {
        HStack(spacing: Theme.Spacing.s3) {
            AvatarView(
                avatarRef: persona.photo_ref,
                name: persona.name ?? "?",
                size: 44,
                ringWidth: 1
            )
            VStack(alignment: .leading, spacing: 2) {
                Text(persona.name?.isEmpty == false ? persona.name! : "Untitled persona")
                    .font(Theme.FontStyle.body.weight(.medium))
                    .foregroundStyle(Theme.Color.fg)
                Text("Tap to edit")
                    .font(Theme.FontStyle.timestamp)
                    .foregroundStyle(Theme.Color.fg3)
            }
        }
        .padding(.vertical, Theme.Spacing.s1)
    }

    private func load() async {
        loadState = .loading
        do {
            let rows: [PersonaRow] = try await client
                .from("user_personas")
                .select("id, name, photo_ref")
                .order("created_at", ascending: true)
                .execute()
                .value
            personas = rows
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }
}

enum PersonaListRoute: Hashable {
    case edit(personaID: String?)
}
