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

    var body: some View {
        Form {
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
        .task { await load() }
    }

    private func load() async {
        let store = PreferenceFamilyStore(client: client, family: "profile")
        let prefs = (try? await store.load()) ?? [:]
        if let v = prefs["display_name"] as? String {
            displayName = v
        }
        didLoad = true
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
