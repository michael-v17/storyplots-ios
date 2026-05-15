import Foundation
import Supabase

/// Lives-once wrapper around `SupabaseClient`. Single source of truth for
/// the authenticated client used by `AuthStore` and any Phase 2+ feature that
/// hits Supabase directly (Home cache, People list, Settings rows).
@MainActor
final class SupabaseManager {
    static let shared = SupabaseManager()

    let client: SupabaseClient
    let isConfigured: Bool

    private init() {
        self.client = SupabaseClient(
            supabaseURL: SupabaseConfig.url,
            supabaseKey: SupabaseConfig.anonKey
        )
        self.isConfigured = true
    }
}
