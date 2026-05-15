import SwiftUI
import Supabase

/// Edits the user's primary persona (the YOUR PERSONA pill on Home) —
/// `user_personas` row tied to the user's account.
struct ProfileView: View {
    let client: SupabaseClient

    @State private var personaID: String?
    @State private var name: String = ""
    @State private var appearance: String = ""
    @State private var background: String = ""
    @State private var loadState: LoadState = .idle
    @State private var saving: Bool = false
    @State private var error: String?

    enum LoadState: Sendable, Equatable { case idle, loading, loaded, error(String) }

    var body: some View {
        Form {
            Section("Identity") {
                TextField("Display name", text: $name)
            }
            Section("Appearance") {
                TextEditor(text: $appearance)
                    .frame(minHeight: 80)
            }
            Section("Background") {
                TextEditor(text: $background)
                    .frame(minHeight: 120)
            }
            if let error {
                Section { Text(error).foregroundStyle(Theme.Color.destructive) }
            }
            Section {
                Button {
                    Task { await save() }
                } label: {
                    HStack {
                        Spacer()
                        if saving { ProgressView() } else { Text("Save changes") }
                        Spacer()
                    }
                }
                .disabled(saving || name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        loadState = .loading
        do {
            struct Row: Decodable {
                let id: String
                let name: String?
                let appearance: String?
                let background: String?
            }
            let rows: [Row] = try await client
                .from("user_personas")
                .select("id, name, appearance, background")
                .order("created_at", ascending: true)
                .limit(1)
                .execute()
                .value
            if let row = rows.first {
                personaID = row.id
                name = row.name ?? ""
                appearance = row.appearance ?? ""
                background = row.background ?? ""
            }
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        do {
            if let id = personaID {
                struct Update: Encodable {
                    let name: String
                    let appearance: String?
                    let background: String?
                }
                try await client
                    .from("user_personas")
                    .update(Update(name: name, appearance: appearance.isEmpty ? nil : appearance, background: background.isEmpty ? nil : background))
                    .eq("id", value: id)
                    .execute()
            } else {
                struct Insert: Encodable {
                    let name: String
                    let appearance: String?
                    let background: String?
                }
                try await client
                    .from("user_personas")
                    .insert(Insert(name: name, appearance: appearance.isEmpty ? nil : appearance, background: background.isEmpty ? nil : background))
                    .execute()
            }
            Haptics.notify(.success)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
