import Foundation

/// Errors surfaced by Zone-A backend calls (FastAPI / `/api/...`).
/// See `seed/api-contract.md` for endpoint shapes.
enum APIError: Error, Equatable, Sendable {
    /// HTTP status outside 2xx.
    case badStatus(Int)
    /// Response body decoded into the expected `Response` type.
    case decodingFailed
    /// Transport-level failure (DNS, connection refused, timeout, ...).
    case transport(String)
    /// Backend returned 401 — JWT missing or expired; caller should trigger refresh.
    case unauthorized
    /// Phase 0 / Phase 1 wiring stub.
    case notImplemented
}
