import SwiftUI

struct SignInView: View {
    @Environment(AuthStore.self) private var auth

    @State private var email: String = ""
    @State private var password: String = ""
    @State private var showSignUp: Bool = false
    @State private var showReset: Bool = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Theme.Color.brand1.opacity(0.30), Theme.Color.bg],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: Theme.Spacing.s5) {
                    Spacer(minLength: Theme.Spacing.s10)

                    VStack(spacing: Theme.Spacing.s2) {
                        Text("StoryPlots")
                            .font(Theme.FontStyle.h1)
                            .foregroundStyle(Theme.Color.brandGradient)
                        Text("Sign in to continue")
                            .font(Theme.FontStyle.subhead)
                            .foregroundStyle(Theme.Color.fg2)
                    }

                    card

                    Spacer(minLength: Theme.Spacing.s6)
                }
                .padding(.horizontal, Theme.Spacing.s4)
            }
        }
        .sheet(isPresented: $showSignUp) {
            SignUpView()
                .environment(auth)
        }
        .sheet(isPresented: $showReset) {
            ResetPasswordView()
                .environment(auth)
        }
    }

    private var card: some View {
        VStack(spacing: Theme.Spacing.s3) {
            if let error = auth.lastError {
                Text(error.userFacingMessage)
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.destructive)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Theme.Spacing.s3)
                    .background(Theme.Color.destructiveSoft, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
            }

            TextField("Email", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(Theme.Spacing.s3)
                .background(Theme.Color.bg3, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
                .foregroundStyle(Theme.Color.fg)

            SecureField("Password", text: $password)
                .textContentType(.password)
                .padding(Theme.Spacing.s3)
                .background(Theme.Color.bg3, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
                .foregroundStyle(Theme.Color.fg)

            Button {
                Task { await auth.signInEmail(email, password: password) }
            } label: {
                Group {
                    if auth.isLoading {
                        ProgressView().tint(Theme.Color.fgOnBrand)
                    } else {
                        Text("Sign in").font(Theme.FontStyle.body.weight(.semibold))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s3)
                .foregroundStyle(Theme.Color.fgOnBrand)
                .background(Theme.Color.brandGradient, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
            }
            .disabled(auth.isLoading || email.isEmpty || password.isEmpty)

            HStack(spacing: Theme.Spacing.s2) {
                Rectangle().fill(Theme.Color.borderSoft).frame(height: 1)
                Text("or").font(Theme.FontStyle.meta).foregroundStyle(Theme.Color.fg3)
                Rectangle().fill(Theme.Color.borderSoft).frame(height: 1)
            }
            .padding(.vertical, Theme.Spacing.s1)

            AppleSignInButton()
                .frame(height: 48)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card))

            HStack {
                Button("Create account") { showSignUp = true }
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg1)
                Spacer()
                Button("Forgot password?") { showReset = true }
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg2)
            }
            .padding(.top, Theme.Spacing.s2)
        }
        .padding(Theme.Spacing.s5)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
    }
}

#Preview {
    SignInView()
        .environment(AuthStore(client: SupabaseManager.shared.client))
        .preferredColorScheme(.dark)
}
