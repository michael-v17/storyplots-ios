import Foundation
import CryptoKit
import OSLog

private let cacheLog = Logger(subsystem: "com.storyplots.ios", category: "image-cache")

/// Persistent, two-tier image cache keyed by a caller-supplied stable identifier
/// (e.g. `"avatar:<storage_ref>"` or `"media:<storage_ref>"`).
///
/// - Memory tier: `NSCache<NSString, NSData>` with a 100 MB cost ceiling. Cost
///   is the encoded byte count, so the system evicts large entries first.
/// - Disk tier: files written under `Caches/StoryPlotsImages/<sha256(key)>`.
///   Entries older than 7 days are purged on first use. iOS may evict the whole
///   `Caches/` directory under storage pressure — by design we fall through to
///   the network on miss.
///
/// In-flight downloads are deduplicated per key so two concurrent renders of
/// the same avatar share a single network request.
actor ImageCache {
    static let shared = ImageCache()

    private let memory: NSCache<NSString, NSData>
    private let directory: URL
    private let ttl: TimeInterval
    private let fileManager: FileManager
    private var didPurge: Bool = false
    private var inFlight: [String: Task<Data, Error>] = [:]

    init(directory: URL? = nil,
         ttl: TimeInterval = 7 * 24 * 60 * 60,
         memoryLimitBytes: Int = 100 * 1024 * 1024,
         fileManager: FileManager = .default) {
        let base = directory ?? Self.defaultDirectory(fileManager: fileManager)
        self.directory = base
        self.ttl = ttl
        self.fileManager = fileManager

        let cache = NSCache<NSString, NSData>()
        cache.totalCostLimit = memoryLimitBytes
        cache.name = "com.storyplots.image-cache"
        self.memory = cache

        try? fileManager.createDirectory(at: base, withIntermediateDirectories: true)
    }

    private static func defaultDirectory(fileManager: FileManager) -> URL {
        let base = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        return base.appendingPathComponent("StoryPlotsImages", isDirectory: true)
    }

    /// Returns the decoded bytes for `key`, downloading via `fallback` on miss.
    /// Memory tier is checked first, then disk (with TTL enforcement), and only
    /// then `fallback` is invoked. Successful downloads back-fill both tiers.
    func data(for key: String, fallback: @escaping @Sendable () async throws -> Data) async throws -> Data {
        if !didPurge {
            didPurge = true
            purgeStaleEntries()
        }

        let nsKey = key as NSString

        if let cached = memory.object(forKey: nsKey) {
            return cached as Data
        }

        if let disk = readFreshFromDisk(key: key) {
            memory.setObject(disk as NSData, forKey: nsKey, cost: disk.count)
            return disk
        }

        if let existing = inFlight[key] {
            return try await existing.value
        }

        let task = Task<Data, Error> {
            try await fallback()
        }
        inFlight[key] = task

        do {
            let bytes = try await task.value
            inFlight[key] = nil
            memory.setObject(bytes as NSData, forKey: nsKey, cost: bytes.count)
            writeToDisk(bytes: bytes, key: key)
            return bytes
        } catch {
            inFlight[key] = nil
            throw error
        }
    }

    #if DEBUG
    /// Test hook: drop only the memory tier so we can verify the disk path.
    func dropMemoryForTesting() {
        memory.removeAllObjects()
    }

    /// Test hook: re-arm the lazy purge so a follow-up call exercises it again.
    func resetPurgeFlagForTesting() {
        didPurge = false
    }
    #endif

    /// Drops every cached entry from both tiers. Intended for sign-out and tests.
    func clear() {
        memory.removeAllObjects()
        if let entries = try? fileManager.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) {
            for url in entries {
                try? fileManager.removeItem(at: url)
            }
        }
    }

    private func readFreshFromDisk(key: String) -> Data? {
        let url = diskURL(for: key)
        guard fileManager.fileExists(atPath: url.path) else { return nil }
        do {
            let attrs = try fileManager.attributesOfItem(atPath: url.path)
            if let mtime = attrs[.modificationDate] as? Date,
               Date().timeIntervalSince(mtime) > ttl {
                try? fileManager.removeItem(at: url)
                return nil
            }
            return try Data(contentsOf: url)
        } catch {
            cacheLog.error("disk read failed: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    private func writeToDisk(bytes: Data, key: String) {
        let url = diskURL(for: key)
        do {
            try bytes.write(to: url, options: .atomic)
        } catch {
            cacheLog.error("disk write failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func purgeStaleEntries() {
        guard let entries = try? fileManager.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.contentModificationDateKey]
        ) else { return }

        let now = Date()
        var purged = 0
        for url in entries {
            let mtime = (try? url.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
            if let mtime, now.timeIntervalSince(mtime) > ttl {
                try? fileManager.removeItem(at: url)
                purged += 1
            }
        }
        if purged > 0 {
            cacheLog.info("purged \(purged, privacy: .public) stale entries from disk cache")
        }
    }

    private func diskURL(for key: String) -> URL {
        directory.appendingPathComponent(Self.sha256Hex(of: key))
    }

    private static func sha256Hex(of key: String) -> String {
        let digest = SHA256.hash(data: Data(key.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
