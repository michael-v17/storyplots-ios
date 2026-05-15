import Foundation

/// One decoded Server-Sent Event frame (`event:` + `data:`).
struct SSEEvent: Sendable, Equatable {
    let event: String?
    let data: String
}

extension URLSession {
    /// Stream-decode an SSE response from a configured `URLRequest`.
    /// Yields each `\n\n`-framed event as it arrives. Throws `SSEError.badStatus`
    /// when the HTTP status is non-2xx, or propagates any transport error.
    func eventStream(for request: URLRequest) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let (bytes, response) = try await self.bytes(for: request)
                    guard let http = response as? HTTPURLResponse else {
                        continuation.finish(throwing: SSEError.badStatus(0))
                        return
                    }
                    guard (200..<300).contains(http.statusCode) else {
                        continuation.finish(throwing: SSEError.badStatus(http.statusCode))
                        return
                    }

                    var buffer = ""
                    for try await line in bytes.lines {
                        try Task.checkCancellation()
                        buffer.append(line)
                        buffer.append("\n")
                        // SSE frames are delimited by a blank line ("\n\n").
                        while let range = buffer.range(of: "\n\n") {
                            let frame = String(buffer[..<range.lowerBound])
                            buffer.removeSubrange(..<range.upperBound)
                            if let event = SSEFrameParser.parse(frame) {
                                continuation.yield(event)
                            }
                        }
                    }
                    // Drain any trailing partial frame.
                    if !buffer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                       let event = SSEFrameParser.parse(buffer) {
                        continuation.yield(event)
                    }
                    continuation.finish()
                } catch is CancellationError {
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}
