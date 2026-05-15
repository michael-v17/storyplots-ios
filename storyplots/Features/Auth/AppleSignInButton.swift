import SwiftUI
import AuthenticationServices
import CryptoKit
import Security

/// Wraps `SignInWithAppleButton` and feeds the resulting identity token
/// (plus the originating nonce) into `AuthStore.signInWithApple`. The
/// SHA-256 of `nonce` is sent to Apple per its security requirement.
struct AppleSignInButton: View {
    @Environment(AuthStore.self) private var auth
    @State private var nonce: String?

    var body: some View {
        SignInWithAppleButton(.signIn) { request in
            let fresh = Self.randomNonce()
            nonce = fresh
            request.requestedScopes = [.fullName, .email]
            request.nonce = Self.sha256(fresh)
        } onCompletion: { result in
            handle(result)
        }
        .signInWithAppleButtonStyle(.black)
    }

    private func handle(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8),
                  let storedNonce = nonce else {
                return
            }
            Task { await auth.signInWithApple(idToken: idToken, nonce: storedNonce) }
        case .failure:
            // User canceled or a system-level failure occurred — `AuthStore` keeps its state untouched.
            break
        }
    }

    private static func randomNonce(length: Int = 32) -> String {
        var bytes = [UInt8](repeating: 0, count: length)
        let status = SecRandomCopyBytes(kSecRandomDefault, length, &bytes)
        precondition(status == errSecSuccess, "SecRandomCopyBytes failed: \(status)")
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    private static func sha256(_ string: String) -> String {
        SHA256.hash(data: Data(string.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }
}
