import Foundation

/// `public.user_personas` row — one per user (RLS-scoped).
/// Photo column is `photo_ref` (not `avatar_ref`) per the live schema.
struct UserPersona: Decodable, Sendable, Equatable {
    let id: String
    let name: String?
    let photo_ref: String?
}
