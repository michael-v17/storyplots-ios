import Foundation

/// FastAPI backend base URL. Mirrors the web client's `VITE_BACKEND_URL` default.
/// Migrate to a build-config-injected value once we deploy production backend.
enum BackendConfig {
    static let url = URL(string: "http://127.0.0.1:8000")!
}
