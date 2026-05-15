import Foundation

/// Protocol that hides whether the underlying provider is the real `supabase-swift`
/// SDK or a Phase-0 stub. Phase 1 introduces the live SDK-backed implementation
/// gated behind `import Supabase`.
protocol SupabaseProviding: Sendable {
    /// `true` when the manager is wired to a live Supabase project (URL + anon key resolved).
    /// Phase 0 stub returns `false`.
    var isConfigured: Bool { get }
}

/// Compile-time stub used by Phase 0 until `supabase-swift` is added as an SPM dependency
/// in Phase 1. See `.claude/PRPs/plans/0001-phase-0-bootstrap-xcode.plan.md` Task 5.
struct StubSupabaseManager: SupabaseProviding {
    let isConfigured: Bool = false
    init() {}
}
