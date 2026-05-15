import Foundation

/// `public.characters` row (lightweight projection used by Home + People).
struct Character: Decodable, Identifiable, Sendable, Equatable {
    let id: String
    let name: String
    let avatar_ref: String?
    let accent_color: String?
    let updated_at: String?
}
