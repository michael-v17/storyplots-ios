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
}
