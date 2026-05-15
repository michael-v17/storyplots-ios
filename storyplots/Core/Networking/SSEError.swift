import Foundation

/// Errors surfaced by the SSE pipeline that consumes `/chat` and any future streams.
enum SSEError: Error, Equatable, Sendable {
    case badStatus(Int)
    case decodingFailed
    case streamClosed
    case notImplemented
}
