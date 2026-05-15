import Foundation
import Observation

/// Observable bridge between the `AuthStore` actor and SwiftUI views.
/// `@MainActor` guarantees view-side state mutations stay on the main thread.
@MainActor
@Observable
final class AuthState {
    private(set) var isSignedIn: Bool = false
    private(set) var lastError: AuthError?

    init() {}

    func setSignedIn(_ value: Bool) {
        isSignedIn = value
    }

    func setError(_ error: AuthError?) {
        lastError = error
    }
}

/// Coordinates sign-in/out and JWT lifecycle. Phase 0 keeps the surface area stable;
/// Phase 1 wires email/password + Apple Sign-In through `supabase-swift`.
actor AuthStore {
    init() {}

    func signInEmail(_ email: String, password: String) async throws {
        _ = (email, password)
        throw AuthError.notImplemented
    }

    func signInWithApple(identityToken: String, nonce: String) async throws {
        _ = (identityToken, nonce)
        throw AuthError.notImplemented
    }

    func signOut() async throws {
        throw AuthError.notImplemented
    }
}
