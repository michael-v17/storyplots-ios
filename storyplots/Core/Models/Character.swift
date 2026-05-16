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

    // Optional deep fields — populated only by `CharacterEditViewModel.loadDeep`
    // (every other read site uses the shallow select that omits them).
    let appearance_description: String?
    let append_appearance_to_image_prompts: Bool?
    let character_memory_enabled: Bool?
    let default_persona_id: String?
    let default_writing_style_id: String?

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}
