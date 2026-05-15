import Foundation
import Observation
import OSLog
import Supabase
import SwiftUI

private let galleryLog = Logger(subsystem: "com.storyplots.ios", category: "gallery")

@MainActor
@Observable
final class GalleryViewModel {
    enum LoadState: Sendable, Equatable {
        case idle
        case loading
        case loaded
        case error(String)
    }

    private(set) var loadState: LoadState = .idle
    private(set) var images: [GeneratedImage] = []

    let client: SupabaseClient

    init(client: SupabaseClient) {
        self.client = client
    }

    func load() async {
        loadState = .loading
        do {
            let rows: [GeneratedImage] = try await client
                .from("generated_images")
                .select("id, user_id, character_id, conversation_id, message_id, prompt, refined_prompt, resolution_preset, dimensions, storage_ref, external_url, engine, style, display_url, sfw_blocked, created_at")
                .order("created_at", ascending: false)
                .limit(200)
                .execute()
                .value
            self.images = rows
            self.loadState = .loaded
        } catch {
            galleryLog.error("load failed: \(error.localizedDescription, privacy: .public)")
            self.loadState = .error(error.localizedDescription)
        }
    }

    func delete(_ image: GeneratedImage) {
        let snapshot = images
        images.removeAll { $0.id == image.id }
        Task { [weak self] in
            guard let self else { return }
            do {
                let session = try await self.client.auth.session
                let jwt = session.accessToken
                var request = URLRequest(url: BackendConfig.url
                    .appendingPathComponent("images")
                    .appendingPathComponent(image.id))
                request.httpMethod = "DELETE"
                request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
                let (_, response) = try await URLSession.shared.data(for: request)
                if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                    galleryLog.error("delete http=\(http.statusCode, privacy: .public)")
                    self.images = snapshot
                }
            } catch {
                galleryLog.error("delete failed: \(error.localizedDescription, privacy: .public)")
                self.images = snapshot
            }
        }
    }
}
