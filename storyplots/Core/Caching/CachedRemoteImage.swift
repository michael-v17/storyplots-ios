import SwiftUI
import UIKit

/// Three-state phase mirroring `AsyncImagePhase` for drop-in shape parity.
enum CachedImagePhase {
    case empty
    case success(Image)
    case failure
}

/// SwiftUI loader that goes through `ImageCache` whenever the caller has a
/// stable identifier for the asset (a Supabase `storage_ref`, an asset id, etc.).
///
/// Pattern of use:
/// ```
/// CachedRemoteImage(
///     cacheKey: "avatar:\(ref)",
///     resolver: { await SupabaseStorageHelper.shared.avatarURL(path: ref) }
/// ) { phase in
///     switch phase {
///     case .success(let img): img.resizable().scaledToFill()
///     case .failure, .empty:  placeholder
///     }
/// }
/// ```
///
/// - When `cacheKey` is nil the view degrades to a plain network fetch (no
///   persistence, no in-flight dedupe). The `resolver` is still invoked.
/// - The task is keyed by `cacheKey`, so navigating between two cached refs
///   cancels the prior load deterministically.
struct CachedRemoteImage<Content: View>: View {
    let cacheKey: String?
    let resolver: @Sendable () async -> URL?
    @ViewBuilder let content: (CachedImagePhase) -> Content

    @State private var phase: CachedImagePhase = .empty

    var body: some View {
        content(phase)
            .task(id: cacheKey ?? "") { await load() }
    }

    private func load() async {
        if let key = cacheKey, !key.isEmpty {
            await loadCached(key: key)
        } else {
            await loadDirect()
        }
    }

    private func loadCached(key: String) async {
        let resolver = self.resolver
        do {
            let bytes = try await ImageCache.shared.data(for: key) {
                guard let url = await resolver() else {
                    throw URLError(.badURL)
                }
                return try await CachedImageLoader.download(url: url)
            }
            if let image = await CachedImageLoader.decode(bytes: bytes) {
                phase = .success(Image(uiImage: image))
            } else {
                phase = .failure
            }
        } catch {
            phase = .failure
        }
    }

    private func loadDirect() async {
        guard let url = await resolver() else {
            phase = .failure
            return
        }
        do {
            let bytes = try await CachedImageLoader.download(url: url)
            if let image = await CachedImageLoader.decode(bytes: bytes) {
                phase = .success(Image(uiImage: image))
            } else {
                phase = .failure
            }
        } catch {
            phase = .failure
        }
    }
}

private enum CachedImageLoader {
    static func download(url: URL) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(from: url)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw URLError(.badServerResponse)
        }
        return data
    }

    static func decode(bytes: Data) async -> UIImage? {
        await Task.detached(priority: .userInitiated) {
            UIImage(data: bytes)
        }.value
    }
}
