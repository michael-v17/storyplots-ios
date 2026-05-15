import Foundation

/// `public.generated_images` row + the response shape returned by
/// `POST /messages/{message_id}/images`.
///
/// `display_url` is the field the frontend uses to actually render the image:
/// for `engine=fal`, the backend returns the fal CDN URL fresh; for already
/// persisted rows we fall back to the Supabase Storage signed URL of
/// `generated-media/{user_id}/{id}.webp`.
struct GeneratedImage: Decodable, Identifiable, Sendable, Equatable {
    let id: String
    let user_id: String?
    let character_id: String?
    let conversation_id: String?
    let message_id: String?
    let prompt: String?
    let refined_prompt: String?
    let resolution_preset: String?
    let dimensions: Dimensions?
    let storage_ref: String?
    let external_url: String?
    let engine: Engine?
    let style: String?
    let display_url: String?
    let sfw_blocked: Bool?
    let created_at: String?

    struct Dimensions: Decodable, Sendable, Equatable {
        let w: Int
        let h: Int
    }

    enum Engine: String, Decodable, Sendable, Equatable {
        case comfyui
        case fal
    }

    /// Aspect ratio (width / height) — falls back to 1.0 when dimensions missing.
    var aspect: CGFloat {
        guard let d = dimensions, d.h > 0 else { return 1.0 }
        return CGFloat(d.w) / CGFloat(d.h)
    }
}
