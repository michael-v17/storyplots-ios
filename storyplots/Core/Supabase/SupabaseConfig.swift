import Foundation

/// Supabase project URL + anon key for the staging environment.
///
/// **The Supabase anon key is public by design** — it lives in every web client's
/// JS bundle and is protected by Row-Level Security policies on the database side.
/// Hardcoding here is acceptable for MVP. Migrate to a build-config-injected
/// approach (xcconfig or `.entitlements`-style plist) when multi-environment
/// builds (dev/staging/prod) become real.
enum SupabaseConfig {
    /// Staging Supabase project URL — also used by `base/frontend` and `base/backend`.
    static let url = URL(string: "https://mhdekknjaigoeuzrriey.supabase.co")!

    /// Staging anon key. Public; matches what the web client uses.
    static let anonKey = "sb_publishable_PfR-7qHZ568ySKYdOujSsQ_Z1YOFLWC"
}
