import Foundation

/// HTTP method whitelist — matches what `seed/api-contract.md` documents.
enum HTTPMethod: String, Sendable {
    case GET
    case POST
    case PATCH
    case DELETE
}

/// Describes a single backend endpoint with its expected response shape.
/// Phase 0 freezes the shape; Phase 1+ fill in the body encoding and path builders.
struct Endpoint<Response: Decodable & Sendable>: Sendable {
    let path: String
    let method: HTTPMethod
    let body: Data?
    let responseType: Response.Type

    init(path: String, method: HTTPMethod, body: Data? = nil, responseType: Response.Type) {
        self.path = path
        self.method = method
        self.body = body
        self.responseType = responseType
    }
}

/// Zone-A backend client protocol — concrete impl lives in `URLSessionAPIClient`.
protocol APIClient: Sendable {
    func send<R>(_ endpoint: Endpoint<R>) async throws -> R
}

/// Default actor-based client that wraps `URLSession`.
/// Phase 0 returns `APIError.notImplemented`; Phase 1+ encodes the request and decodes the response.
actor URLSessionAPIClient: APIClient {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func send<R>(_ endpoint: Endpoint<R>) async throws -> R {
        // Phase 0 stub. NetworkingTests exercises this path explicitly.
        _ = endpoint
        _ = session
        throw APIError.notImplemented
    }
}
