import SwiftUI

/// Phase 1 placeholder. Carries the Sign-out affordance so the auth flow has
/// an end-to-end exit even before Phase 9 ships the real Settings surface.
struct SettingsPlaceholder: View {
    @Environment(AuthStore.self) private var auth

    var body: some View {
        Form {
            Section("Account") {
                if let email = auth.userEmail {
                    HStack {
                        Text("Email").foregroundStyle(Theme.Color.fg1)
                        Spacer()
                        Text(email).foregroundStyle(Theme.Color.fg3)
                    }
                } else {
                    Text("Not signed in").foregroundStyle(Theme.Color.fg3)
                }

                Button(role: .destructive) {
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

            Section {
                Text("Phase 9 fills this with Engines, Profile, Privacy, and Writing.")
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg3)
            }
        }
    }
}
