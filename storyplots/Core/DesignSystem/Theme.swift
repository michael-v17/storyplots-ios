import SwiftUI

/// Single design-system namespace mirroring `base/frontend/src/styles/tokens.css`
/// and `seed/design.md` §3–§8 + §6.5. No instances — all members are static.
enum Theme {

    // MARK: Color

    enum Color {

        // MARK: Surfaces (design.md §3.1)
        /// `--sp-bg` — primary app background, neutral near-black.
        static let bg = SwiftUI.Color(hex: 0x0F0F10)
        /// `--sp-bg-1` — sticky headers, subtle lift.
        static let bg1 = SwiftUI.Color(hex: 0x161617)
        /// `--sp-bg-2` — elevated cards, modal sheets, character bubble.
        static let bg2 = SwiftUI.Color(hex: 0x1C1C1E)
        /// `--sp-bg-3` — inputs, second-level cards, hover.
        static let bg3 = SwiftUI.Color(hex: 0x252527)
        /// `--sp-bg-inset` — textarea / search interior.
        static let bgInset = SwiftUI.Color(hex: 0x0A0A0B)
        /// `--sp-overlay` — scrim behind custom modals (NOT for native sheets).
        static let overlay = SwiftUI.Color(hex: 0x0F0F10, alpha: 0.72)

        // MARK: Borders (design.md §3.2)
        /// `--sp-border` — normal hairlines.
        static let border = SwiftUI.Color(hex: 0x57534E)
        /// `--sp-border-soft` — group dividers, separators.
        static let borderSoft = SwiftUI.Color(hex: 0x44403C)
        /// `--sp-border-strong` — focused, hovered.
        static let borderStrong = SwiftUI.Color(hex: 0x78716C)

        // MARK: Foreground / text (design.md §3.3)
        /// `--sp-fg` — primary, headings, dialogue.
        static let fg = SwiftUI.Color(hex: 0xF2F1ED)
        /// `--sp-fg-1` — body copy.
        static let fg1 = SwiftUI.Color(hex: 0xD8D5CC)
        /// `--sp-fg-2` — secondary, narration italic.
        static let fg2 = SwiftUI.Color(hex: 0xB0AAA0)
        /// `--sp-fg-3` — muted, section labels, hints.
        static let fg3 = SwiftUI.Color(hex: 0x928D82)
        /// `--sp-fg-4` — placeholders, disabled, timestamps.
        static let fg4 = SwiftUI.Color(hex: 0x6E695F)

        // MARK: Brand (design.md §3.4)
        /// `--sp-brand-1` — warm amber, signature top of gradient.
        static let brand1 = SwiftUI.Color(hex: 0xF5B547)
        /// `--sp-brand-2` — sunset orange, gradient end.
        static let brand2 = SwiftUI.Color(hex: 0xFF7B3D)
        /// `--sp-fg-on-brand` — text/icons over brand fills (CTAs).
        static let fgOnBrand = SwiftUI.Color(hex: 0x000000)
        /// `--sp-brand-grad` — 135° linear gradient amber → sunset orange.
        static let brandGradient = LinearGradient(
            colors: [brand1, brand2],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        // MARK: Semantic (design.md §3.5)
        /// `--sp-destructive` — delete, erase, error icons.
        static let destructive = SwiftUI.Color(hex: 0xE04747)
        /// `--sp-destructive-soft` — destructive background tint.
        static let destructiveSoft = SwiftUI.Color(hex: 0xE04747, alpha: 0.15)
        /// `--sp-success` — confirmations, success states.
        static let success = SwiftUI.Color(hex: 0x2ECC71)
        /// `--sp-success-soft` — success badge background.
        static let successSoft = SwiftUI.Color(hex: 0x2ECC71, alpha: 0.15)
        /// `--sp-warning` — warnings, rewrite-gate strikes.
        static let warning = SwiftUI.Color(hex: 0xF59E0B)
        /// `--sp-warning-soft` — warning surface background.
        static let warningSoft = SwiftUI.Color(hex: 0xF59E0B, alpha: 0.15)

        // MARK: Accent presets (design.md §3.6) — 16 char-accent palette.
        enum AccentPreset {
            static let violet  = SwiftUI.Color(hex: 0x8B5CF6)
            static let indigo  = SwiftUI.Color(hex: 0x6366F1)
            static let blue    = SwiftUI.Color(hex: 0x3B82F6)
            static let sky     = SwiftUI.Color(hex: 0x0EA5E9)
            static let teal    = SwiftUI.Color(hex: 0x14B8A6)
            static let green   = SwiftUI.Color(hex: 0x2ECC71)
            static let lime    = SwiftUI.Color(hex: 0x84CC16)
            static let amber   = SwiftUI.Color(hex: 0xF59E0B)
            static let bronze  = SwiftUI.Color(hex: 0xC9A34C)
            static let orange  = SwiftUI.Color(hex: 0xF97316)
            static let red     = SwiftUI.Color(hex: 0xE04747)
            static let pink    = SwiftUI.Color(hex: 0xEC4899)
            static let rose    = SwiftUI.Color(hex: 0xF43F5E)
            static let fuchsia = SwiftUI.Color(hex: 0xD946EF)
            static let slate   = SwiftUI.Color(hex: 0x94A3B8)
            static let stone   = SwiftUI.Color(hex: 0xA8A29E)

            /// Ordered list for grid pickers; preserves the design.md §3.6 order.
            static let all: [SwiftUI.Color] = [
                violet, indigo, blue, sky, teal, green, lime, amber,
                bronze, orange, red, pink, rose, fuchsia, slate, stone
            ]
        }
    }

    // MARK: Spacing (design.md §6)

    enum Spacing {
        static let s0: CGFloat = 0
        static let s1: CGFloat = 4
        static let s2: CGFloat = 8
        static let s3: CGFloat = 12
        /// Default screen edge padding — matches `tokens.css --sp-space-4` and HIG iPhone.
        static let s4: CGFloat = 16
        static let s5: CGFloat = 20
        /// Section spacing.
        static let s6: CGFloat = 24
        static let s8: CGFloat = 32
        static let s10: CGFloat = 40
        static let s12: CGFloat = 48
    }

    // MARK: Radius (design.md §5)

    enum Radius {
        /// THE radius — buttons, inputs, cards, bubbles.
        static let card: CGFloat = 14
        /// Custom-sheet radius only; native sheets keep their own.
        static let sheet: CGFloat = 20
        /// Use `Capsule()` directly; this is kept for clarity.
        static let pill: CGFloat = .infinity
    }

    // MARK: FontStyle (design.md §4.6)

    enum FontStyle {
        static let h1           = Font.largeTitle.weight(.bold)
        static let h2           = Font.title.weight(.bold)
        static let h3           = Font.title2.weight(.semibold)
        static let subhead      = Font.title3.weight(.semibold)
        static let body         = Font.body
        static let meta         = Font.subheadline
        static let timestamp    = Font.caption2
        static let sectionLabel = Font.caption.weight(.semibold)
        static let narration    = Font.body.italic()
        static let dialogue     = Font.body
        static let mono         = Font.body.monospaced()
    }

    // MARK: Motion (design.md §8)

    enum Motion {
        /// Duration tokens (seconds), parity with `tokens.css --sp-duration-*`.
        static let fast: TimeInterval = 0.12
        static let base: TimeInterval = 0.20
        static let slow: TimeInterval = 0.32

        /// Default UI motion for state transitions.
        static let snappy   = Animation.snappy(duration: 0.4)
        /// Slightly bouncy entrances.
        static let bouncy   = Animation.bouncy(duration: 0.5, extraBounce: 0.15)
        /// Long, calm transitions (matched geometry between surfaces).
        static let smooth   = Animation.smooth(duration: 0.45)
        /// Send-button pop, micro-feedback.
        static let pop      = Animation.spring(response: 0.35, dampingFraction: 0.7)
        /// Gentle close — streaming bubble exit, etc.
        static let gentle   = Animation.spring(response: 0.5, dampingFraction: 0.9)
        /// Fast linear-ish ease — token-arrival height ticks.
        static let fastEase = Animation.easeOut(duration: fast)
        /// Base ease for inline state changes.
        static let baseEase = Animation.easeOut(duration: base)
    }

    // MARK: Shadow (design.md §7)

    enum Shadow {
        /// Elevation level — small / medium / large.
        enum Level: Sendable { case sm, md, lg }

        /// Resolved shadow tuple — `color`, `radius`, `y` offset.
        struct Preset: Sendable {
            let color: SwiftUI.Color
            let radius: CGFloat
            let y: CGFloat
        }

        static let sm = Preset(color: .black.opacity(0.40), radius: 1,  y: 1)
        static let md = Preset(color: .black.opacity(0.40), radius: 12, y: 4)
        static let lg = Preset(color: .black.opacity(0.55), radius: 40, y: 16)

        static func preset(_ level: Level) -> Preset {
            switch level {
            case .sm: return sm
            case .md: return md
            case .lg: return lg
            }
        }
    }

    // MARK: Material — iOS 26 Liquid Glass presets (design.md §6.5)

    /// Named material presets. Avoid name collision with `SwiftUI.Material` by
    /// always referring to the system type with its full module path.
    enum Material {
        /// Navigation bars — `.toolbarBackground(Theme.Material.navBar, for: .navigationBar)`.
        static let navBar: SwiftUI.Material = .regularMaterial
        /// Floating action chips on chat content (regenerate, fork).
        static let chip: SwiftUI.Material = .thinMaterial
        /// Image viewer fullscreen scrim during pinch zoom.
        static let viewerOverlay: SwiftUI.Material = .ultraThickMaterial
        /// Sign-in card or any card-over-gradient.
        static let sheetCard: SwiftUI.Material = .thinMaterial
    }
}
