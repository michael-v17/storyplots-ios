import Foundation

/// A single decoded Server-Sent Event frame (`event:` + `data:`).
struct SSEEvent: Sendable, Equatable {
    let event: String?
    let data: String
}

extension URLSession {
    /// Phase 0 skeleton — returns an immediately-finishing stream so the type, cancellation
    /// path, and back-pressure shape are stable for Phase 5 to fill in (`URLSession.bytes(for:)`
    /// + `\n\n` framing per `seed/tech-stack.md` §6).
    func eventStream(for request: URLRequest) -> AsyncThrowingStream<SSEEvent, Error> {
        AsyncThrowingStream { continuation in
            _ = request
            continuation.finish()
        }
    }
}
