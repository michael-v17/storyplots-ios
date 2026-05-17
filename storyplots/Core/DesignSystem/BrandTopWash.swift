import SwiftUI

/// Background gradient wash that extends through the safe-area top and fades
/// to clear over ~220pt of content. Parameterized by `color` so we can theme
/// per-character chat surfaces with that character's accent (PersonaLLM
/// pattern — Clara green, Socrates bronze, AXIOM red).
///
/// The default modifier `brandTopWash()` keeps backwards compatibility with
/// every existing callsite by binding `color` to `Theme.Color.brand1`.
struct AccentTopWash: ViewModifier {
    var color: Color
    var height: CGFloat = 220
    var intensity: Double = 0.18

    func body(content: Content) -> some View {
        content
            .background(alignment: .top) {
                LinearGradient(
                    colors: [
                        color.opacity(intensity),
                        color.opacity(intensity * 0.4),
                        Color.clear
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: height)
                .frame(maxWidth: .infinity)
                .ignoresSafeArea(edges: .top)
            }
    }
}

extension View {
    /// Tint the top of the screen with the supplied accent color. Use this
    /// inside ChatView / CharacterLandingView / CharacterChatsView so each
    /// character's accent becomes a soft top-of-screen glow that fades into
    /// the dark surface, matching PersonaLLM's per-character theming.
    func accentTopWash(color: Color, height: CGFloat = 220, intensity: Double = 0.12) -> some View {
        modifier(AccentTopWash(color: color, height: height, intensity: intensity))
    }

    /// The StoryPlots brand-amber wash. Kept as a thin wrapper over
    /// `accentTopWash` so existing root pages (Home / People / Gallery)
    /// behave identically.
    func brandTopWash(height: CGFloat = 220, intensity: Double = 0.18) -> some View {
        modifier(AccentTopWash(color: Theme.Color.brand1, height: height, intensity: intensity))
    }

    /// PersonaLLM-style halo: the character's accent appears as a soft
    /// radial glow anchored behind the header, falling off omnidirectionally
    /// instead of dropping straight down. Use on ChatView only — other root
    /// surfaces keep the linear `accentTopWash`.
    func accentHaloWash(color: Color, intensity: Double = 0.30, radius: CGFloat = 660) -> some View {
        modifier(AccentHaloWash(color: color, intensity: intensity, radius: radius))
    }
}

/// Soft radial halo + a faint linear tail so the falloff continues past the
/// halo's edge without re-introducing the banner look of the linear wash.
/// Tuned for `bg = 0x0F0F10` — intensity 0.30 + radius ~660pt reads as a
/// clear "character casts light" on the dark surface without becoming a
/// banner.
struct AccentHaloWash: ViewModifier {
    var color: Color
    var intensity: Double = 0.30
    var radius: CGFloat = 660

    func body(content: Content) -> some View {
        content
            .background(alignment: .top) {
                ZStack(alignment: .top) {
                    LinearGradient(
                        colors: [
                            color.opacity(intensity * 0.40),
                            color.opacity(intensity * 0.15),
                            Color.clear
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: radius * 1.05)

                    RadialGradient(
                        colors: [
                            color.opacity(intensity),
                            color.opacity(intensity * 0.55),
                            color.opacity(intensity * 0.18),
                            Color.clear
                        ],
                        center: .top,
                        startRadius: 0,
                        endRadius: radius
                    )
                    .frame(height: radius)
                }
                .frame(maxWidth: .infinity)
                .ignoresSafeArea(edges: .top)
                .allowsHitTesting(false)
            }
    }
}
