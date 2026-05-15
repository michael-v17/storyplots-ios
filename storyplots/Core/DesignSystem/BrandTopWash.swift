import SwiftUI

/// Background brand-gradient wash that extends through the safe-area top
/// down to ~220pt into the content. Applied at the outer container level
/// (ScrollView / VStack) so the same color appears in the status-bar zone
/// and the header — no recortado / no negro raro.
struct BrandTopWash: ViewModifier {
    var height: CGFloat = 220
    var intensity: Double = 0.18

    func body(content: Content) -> some View {
        content
            .background(alignment: .top) {
                LinearGradient(
                    colors: [
                        Theme.Color.brand1.opacity(intensity),
                        Theme.Color.brand2.opacity(intensity * 0.4),
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
    /// Apply the StoryPlots brand-gradient wash at the top of the screen.
    /// Extends through the safe-area so the status bar zone takes the brand
    /// color smoothly instead of cutting to black.
    func brandTopWash(height: CGFloat = 220, intensity: Double = 0.18) -> some View {
        modifier(BrandTopWash(height: height, intensity: intensity))
    }
}
