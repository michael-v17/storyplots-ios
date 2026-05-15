import SwiftUI

struct SignUpView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var email: String = ""
    @State private var password: String = ""
    @State private var confirmation: String = ""

    private var passwordsMatch: Bool { !password.isEmpty && password == confirmation }
    private var canSubmit: Bool { !email.isEmpty && passwordsMatch && !auth.isLoading }

    var body: some View {
        NavigationStack {
            Form {
                if let error = auth.lastError {
                    Section {
                        Text(error.userFacingMessage)
                            .font(Theme.FontStyle.meta)
                            .foregroundStyle(Theme.Color.destructive)
                    }
                }

                Section("Account") {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Password", text: $password)
                        .textContentType(.newPassword)
                    SecureField("Confirm password", text: $confirmation)
                        .textContentType(.newPassword)
                }

                if !password.isEmpty && !passwordsMatch {
                    Text("Passwords do not match")
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.warning)
                }
            }
            .navigationTitle("Create account")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sign up") {
                        Task {
                            await auth.signUp(email: email, password: password)
                            if auth.isSignedIn { dismiss() }
                        }
                    }
                    .disabled(!canSubmit)
                }
            }
        }
    }
}

#Preview {
    SignUpView()
        .environment(AuthStore(client: SupabaseManager.shared.client))
        .preferredColorScheme(.dark)
}
