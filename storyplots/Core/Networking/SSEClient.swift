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
    ///
    /// NOTE: parses the raw byte stream rather than `bytes.lines`. Apple's
    /// `URLSession.AsyncBytes.lines` silently swallows empty lines, which
    /// breaks SSE parsing because the blank line between frames is exactly
    /// what marks the frame boundary. Reading bytes directly and looking
    /// for `\n\n` in the rolling buffer keeps us spec-compliant.
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

                    var buffer: [UInt8] = []
                    for try await byte in bytes {
                        try Task.checkCancellation()
                        buffer.append(byte)
                        // Cheap fast path: only inspect on the newline byte.
                        if byte != 0x0A { continue }
                        // SSE frames are delimited by a blank line ("\n\n").
                        // Check whether the previous byte was also a newline.
                        if buffer.count >= 2 && buffer[buffer.count - 2] == 0x0A {
                            // Frame body excludes the trailing "\n\n".
                            let frameBytes = buffer.dropLast(2)
                            buffer.removeAll(keepingCapacity: true)
                            if let frame = String(bytes: frameBytes, encoding: .utf8),
                               !frame.isEmpty,
                               let event = SSEFrameParser.parse(frame) {
                                continuation.yield(event)
                            }
                        }
                    }
                    // Drain any trailing partial frame (no terminating blank line).
                    if !buffer.isEmpty,
                       let frame = String(bytes: buffer, encoding: .utf8),
                       !frame.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                       let event = SSEFrameParser.parse(frame) {
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
