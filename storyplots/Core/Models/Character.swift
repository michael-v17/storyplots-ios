import Foundation

/// `public.characters` row projection used by Home / People / Chat surfaces.
/// Mirrors a subset of the live schema (see `base/frontend/src/lib/characters.ts`).
struct Character: Decodable, Identifiable, Sendable, Equatable, Hashable {
    let id: String
    let name: String
    let tagline: String?
    let avatar_ref: String?
    let accent_color: String?
    let scenario: String?
    let age: String?
    let gender: String?
    let system_prompt: String?
    let mode: String?
    let updated_at: String?

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}
