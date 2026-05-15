import Foundation
import Observation
import Supabase

/// Single-source-of-truth for auth state and the operations that mutate it.
/// Lives on `@MainActor` so SwiftUI views can bind to it without isolation hops;
/// `SupabaseClient` calls inside the async methods cross to its own executor
/// internally.
@MainActor
@Observable
final class AuthStore {
    private(set) var isSignedIn: Bool = false
    private(set) var userEmail: String?
    private(set) var lastError: AuthError?
    private(set) var isLoading: Bool = false

    let client: SupabaseClient

    init(client: SupabaseClient) {
        self.client = client
    }

    /// Best-effort session restore on cold launch. Silent — failure means
    /// "no session", not "error to surface".
    func restoreSession() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let session = try await client.auth.session
            isSignedIn = true
            userEmail = session.user.email
        } catch {
            isSignedIn = false
            userEmail = nil
        }
    }

    func signInEmail(_ email: String, password: String) async {
        guard !email.isEmpty, !password.isEmpty else {
            lastError = .missingCredentials
            return
        }
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        do {
            let session = try await client.auth.signIn(email: email, password: password)
            isSignedIn = true
            userEmail = session.user.email
        } catch {
            lastError = .signInFailed(error.localizedDescription)
        }
    }

    func signUp(email: String, password: String) async {
        guard !email.isEmpty, !password.isEmpty else {
            lastError = .missingCredentials
            return
        }
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        do {
            _ = try await client.auth.signUp(email: email, password: password)
            // If email confirmation is disabled at the project level, a session is created immediately.
            if let session = try? await client.auth.session {
                isSignedIn = true
                userEmail = session.user.email
            }
        } catch {
            lastError = .signUpFailed(error.localizedDescription)
        }
    }

    func resetPassword(email: String) async {
        guard !email.isEmpty else {
            lastError = .missingCredentials
            return
        }
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        do {
            try await client.auth.resetPasswordForEmail(email)
        } catch {
            lastError = .resetFailed(error.localizedDescription)
        }
    }

    func signInWithApple(idToken: String, nonce: String) async {
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        do {
            let credentials = OpenIDConnectCredentials(provider: .apple, idToken: idToken, nonce: nonce)
            let session = try await client.auth.signInWithIdToken(credentials: credentials)
            isSignedIn = true
            userEmail = session.user.email
        } catch {
            lastError = .appleAuthFailed(error.localizedDescription)
        }
    }

    func signOut() async {
        isLoading = true
        defer { isLoading = false }
        do {
            try await client.auth.signOut()
            isSignedIn = false
            userEmail = nil
            lastError = nil
        } catch {
            lastError = .signOutFailed(error.localizedDescription)
        }
    }
}
