import SwiftUI

struct ResetPasswordView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var email: String = ""
    @State private var didSubmit: Bool = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("We'll send a password reset link to your email.")
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.fg2)
                }

                Section("Email") {
                    TextField("you@example.com", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                if let error = auth.lastError {
                    Section {
                        Text(error.userFacingMessage)
                            .font(Theme.FontStyle.meta)
                            .foregroundStyle(Theme.Color.destructive)
                    }
                }

                if didSubmit {
                    Section {
                        Text("Check your inbox for the reset link.")
                            .font(Theme.FontStyle.meta)
                            .foregroundStyle(Theme.Color.success)
                    }
                }
            }
            .navigationTitle("Reset password")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send link") {
                        Task {
                            await auth.resetPassword(email: email)
                            if auth.lastError == nil { didSubmit = true }
                        }
                    }
                    .disabled(email.isEmpty || auth.isLoading)
                }
            }
        }
    }
}

#Preview {
    ResetPasswordView()
        .environment(AuthStore(client: SupabaseManager.shared.client))
        .preferredColorScheme(.dark)
}
