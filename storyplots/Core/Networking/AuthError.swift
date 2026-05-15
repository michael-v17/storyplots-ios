import Foundation

/// Errors surfaced by `AuthStore` and the auth UI layer.
enum AuthError: Error, Equatable, Sendable {
    case missingCredentials
    case signInFailed(String)
    case notImplemented
}
