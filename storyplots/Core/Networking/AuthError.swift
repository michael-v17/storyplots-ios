import Foundation

/// Errors surfaced by `AuthStore` and the auth UI layer.
enum AuthError: Error, Equatable, Sendable {
    case missingCredentials
    case signInFailed(String)
    case signUpFailed(String)
    case resetFailed(String)
    case signOutFailed(String)
    case appleAuthFailed(String)
    case notImplemented

    /// User-facing copy. Keep short — UI banners don't grow.
    var userFacingMessage: String {
        switch self {
        case .missingCredentials: return "Enter your email and password."
        case .signInFailed(let m): return m
        case .signUpFailed(let m): return m
        case .resetFailed(let m): return m
        case .signOutFailed(let m): return m
        case .appleAuthFailed(let m): return m
        case .notImplemented: return "Not implemented yet."
        }
    }
}
