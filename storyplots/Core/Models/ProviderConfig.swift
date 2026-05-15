import Foundation

/// `public.provider_configs` row — subset projection used by Settings.
struct ProviderConfig: Decodable, Identifiable, Sendable, Equatable {
    let id: String
    let kind: String
    let provider_family: String
    let base_url: String?
    let model_id: String?
    let temperature: Double?
    let max_tokens: Int?
    let context_length: Int?
    let thinking_mode: Bool?
    let last_tested_ok: Bool?
    let last_tested_at: String?
    let is_active: Bool
    let updated_at: String?
}
