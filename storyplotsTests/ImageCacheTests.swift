import Testing
import Foundation
@testable import storyplots

struct ImageCacheTests {

    private func makeIsolatedCache(ttl: TimeInterval = 7 * 24 * 60 * 60) -> (ImageCache, URL) {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("ImageCacheTests-\(UUID().uuidString)", isDirectory: true)
        let cache = ImageCache(directory: dir, ttl: ttl)
        return (cache, dir)
    }

    @Test("Cache miss invokes fallback exactly once and back-fills memory")
    func cacheMissPopulatesMemory() async throws {
        let (cache, dir) = makeIsolatedCache()
        defer { try? FileManager.default.removeItem(at: dir) }

        let payload = Data("hello-cache".utf8)
        let counter = CallCounter()

        let first = try await cache.data(for: "k1") {
            await counter.increment()
            return payload
        }
        let second = try await cache.data(for: "k1") {
            await counter.increment()
            return Data("should-not-run".utf8)
        }

        #expect(first == payload)
        #expect(second == payload)
        #expect(await counter.value == 1)
    }

    @Test("Disk hit returns bytes when memory is cold")
    func diskHitReturnsBytes() async throws {
        let (cache, dir) = makeIsolatedCache()
        defer { try? FileManager.default.removeItem(at: dir) }

        let payload = Data("on-disk-bytes".utf8)
        _ = try await cache.data(for: "k-disk") { payload }
        await cache.dropMemoryForTesting()

        let counter = CallCounter()
        let read = try await cache.data(for: "k-disk") {
            await counter.increment()
            return Data()
        }

        #expect(read == payload)
        #expect(await counter.value == 0)
    }

    @Test("Expired disk entries are purged on first use")
    func expiryPurgesOldFiles() async throws {
        let (cache, dir) = makeIsolatedCache(ttl: 1)
        defer { try? FileManager.default.removeItem(at: dir) }

        let stale = Data("stale".utf8)
        _ = try await cache.data(for: "k-stale") { stale }
        await cache.dropMemoryForTesting()
        await cache.resetPurgeFlagForTesting()

        // Backdate the file mtime past TTL.
        let entries = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
        let stalePath = entries.first!
        let oldDate = Date().addingTimeInterval(-10)
        try FileManager.default.setAttributes([.modificationDate: oldDate], ofItemAtPath: stalePath.path)

        let fresh = Data("fresh".utf8)
        let result = try await cache.data(for: "k-stale") { fresh }
        #expect(result == fresh)
    }

    @Test("Clear removes both tiers")
    func clearWipesEverything() async throws {
        let (cache, dir) = makeIsolatedCache()
        defer { try? FileManager.default.removeItem(at: dir) }

        let payload = Data("x".utf8)
        _ = try await cache.data(for: "k-clear") { payload }
        await cache.clear()

        let counter = CallCounter()
        _ = try await cache.data(for: "k-clear") {
            await counter.increment()
            return Data("refetched".utf8)
        }
        #expect(await counter.value == 1)
    }
}

private actor CallCounter {
    private(set) var value: Int = 0
    func increment() { value += 1 }
}
