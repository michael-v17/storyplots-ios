import SwiftUI
import Supabase

/// Privacy & Data — SFW toggle, push permission, and account actions.
struct PrivacyAndDataView: View {
    let client: SupabaseClient
    @Environment(AuthStore.self) private var auth

    @State private var sfwDisabled: Bool = false
    @State private var loadState: LoadState = .idle
    @State private var error: String?
    @State private var showDeleteConfirm: Bool = false

    enum LoadState: Sendable, Equatable { case idle, loading, loaded, error(String) }

    var body: some View {
        Form {
            Section("Content") {
                Toggle("Allow mature content", isOn: $sfwDisabled)
                    .onChange(of: sfwDisabled) { _, _ in
                        Haptics.selection()
                        Task { await saveSFW() }
                    }
                Text("When on, the assistant may write explicit material. Disabled by default — the SFW filter will still block over-the-line content.")
                    .font(Theme.FontStyle.timestamp)
                    .foregroundStyle(Theme.Color.fg3)
            }

            Section("Notifications") {
                Button {
                    Task {
                        Haptics.impact(.light)
                        await PushService.shared.requestAuthorizationAndRegister()
                    }
                } label: {
                    Label("Enable push notifications", systemImage: "bell.badge")
                }
            }

            Section("Data") {
                Button {
                    Haptics.impact(.light)
                    Task { await exportData() }
                } label: {
                    Label("Export my data", systemImage: "square.and.arrow.up")
                }
            }

            Section {
                Button(role: .destructive) {
                    Haptics.notify(.warning)
                    showDeleteConfirm = true
                } label: {
                    Text("Delete account")
                }
            }
            if let error {
                Section { Text(error).foregroundStyle(Theme.Color.destructive) }
            }
        }
        .navigationTitle("Privacy & Data")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .alert("Delete account?", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task {
                    Haptics.notify(.error)
                    await auth.signOut()
                }
            }
        } message: {
            Text("Account deletion is permanent and removes all your conversations, characters, and persona data. To complete the delete, sign out — then contact support to finalize the removal.")
        }
    }

    private func load() async {
        loadState = .loading
        do {
            struct Row: Decodable { let sfw_disabled: Bool? }
            let rows: [Row] = try await client
                .from("users")
                .select("sfw_disabled")
                .limit(1)
                .execute()
                .value
            sfwDisabled = rows.first?.sfw_disabled ?? false
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }

    private func saveSFW() async {
        do {
            struct Update: Encodable { let sfw_disabled: Bool }
            // Update the user row — RLS keyed by auth.uid() = id.
            if let uid = try? await client.auth.session.user.id.uuidString {
                try await client
                    .from("users")
                    .update(Update(sfw_disabled: sfwDisabled))
                    .eq("id", value: uid)
                    .execute()
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func exportData() async {
        error = "Export starts in TestFlight — placeholder for the email-receipt flow."
    }
}
