import Testing
import Foundation
@testable import storyplots

struct Health: Decodable, Equatable, Sendable {
    let ok: Bool
}

struct NetworkingTests {

    @Test("Endpoint records its path, method, and response type")
    func endpointShape() {
        let ep = Endpoint(path: "/health", method: .GET, responseType: Health.self)
        #expect(ep.path == "/health")
        #expect(ep.method == .GET)
        #expect(ep.body == nil)
        #expect(ep.responseType == Health.self)
    }

    @Test("HTTPMethod cases serialize to their wire form")
    func httpMethodRawValues() {
        #expect(HTTPMethod.GET.rawValue == "GET")
        #expect(HTTPMethod.POST.rawValue == "POST")
        #expect(HTTPMethod.PATCH.rawValue == "PATCH")
        #expect(HTTPMethod.DELETE.rawValue == "DELETE")
    }

    @Test("URLSessionAPIClient stub throws .notImplemented in Phase 0")
    func stubThrowsNotImplemented() async {
        let client = URLSessionAPIClient(session: .shared)
        let ep = Endpoint(path: "/health", method: .GET, responseType: Health.self)
        do {
            _ = try await client.send(ep)
            Issue.record("Expected APIError.notImplemented to be thrown")
        } catch let error as APIError {
            #expect(error == .notImplemented)
        } catch {
            Issue.record("Unexpected error type: \(error)")
        }
    }

    @Test("SSE stream stub yields zero events then finishes")
    func sseStubFinishes() async throws {
        let req = URLRequest(url: URL(string: "https://example.invalid/")!)
        let stream = URLSession.shared.eventStream(for: req)
        var count = 0
        for try await _ in stream {
            count += 1
        }
        #expect(count == 0)
    }

    @Test("SSEEvent equality respects event + data")
    func sseEventEquatable() {
        let a = SSEEvent(event: "token", data: "{\"text\":\"hi\"}")
        let b = SSEEvent(event: "token", data: "{\"text\":\"hi\"}")
        let c = SSEEvent(event: "done", data: "{}")
        #expect(a == b)
        #expect(a != c)
    }
}
