import Foundation
import OSLog
import Supabase

private let storageLog = Logger(subsystem: "com.storyplots.ios", category: "storage")

/// Thin wrapper over `supabase-swift` storage that resolves a display URL
/// for assets in the `avatars` and `generated-media` buckets.
///
/// Cache strategy: we keep an in-memory actor-isolated cache of signed URLs
/// keyed by `bucket/path` with a 50-minute TTL (Supabase defaults to 1h
/// TTL, we expire one minute early to avoid race conditions on the boundary).
actor SupabaseStorageHelper {
    static let shared = SupabaseStorageHelper()

    private struct CachedURL {
        let url: URL
        let expiresAt: Date
    }

    private let ttlSeconds: Int = 3600
    private let cacheLifetime: TimeInterval = 50 * 60
    private var cache: [String: CachedURL] = [:]

    /// Returns a usable display URL for an image whose row has the given
    /// `external_url`, `storage_ref`, and `engine`. Mirrors the displayUrl
    /// helper in `base/frontend/src/lib/images.ts`.
    ///
    /// - Note: `engine=fal` images have a CDN external_url that's valid for
    ///   ~24h; we use it directly. After the sweeper persists the asset, the
    ///   row also has a storage_ref we can sign.
    func displayURL(engine: GeneratedImage.Engine?,
                    externalURL: String?,
                    storageRef: String?) async -> URL? {
        if engine == .fal, let raw = externalURL, !raw.isEmpty, let url = URL(string: raw) {
            return url
        }
        guard let ref = storageRef, !ref.isEmpty else {
            return externalURL.flatMap(URL.init(string:))
        }
        return await signedURL(bucket: "generated-media", path: ref)
    }

    /// Returns a signed URL for an avatar `path` (e.g. `user_id/character-abc.webp`).
    /// Used for character + persona avatars stored in the `avatars` bucket.
    func avatarURL(path: String?) async -> URL? {
        guard let path, !path.isEmpty else { return nil }
        // Some avatar refs come as full URLs already (from older rows).
        if path.hasPrefix("http"), let url = URL(string: path) {
            return url
        }
        return await signedURL(bucket: "avatars", path: path)
    }

    private func signedURL(bucket: String, path: String) async -> URL? {
        let key = "\(bucket)/\(path)"
        if let hit = cache[key], hit.expiresAt > Date() {
            return hit.url
        }

        let client = await MainActor.run { SupabaseManager.shared.client }
        do {
            let signed = try await client.storage
                .from(bucket)
                .createSignedURL(path: path, expiresIn: ttlSeconds)
            cache[key] = CachedURL(url: signed, expiresAt: Date().addingTimeInterval(cacheLifetime))
            return signed
        } catch {
            storageLog.error("signed URL failed bucket=\(bucket, privacy: .public) path=\(path, privacy: .public): \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }
}
