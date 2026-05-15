import SwiftUI

/// Continuous shimmer overlay — drives a subtle gradient sweep across a
/// skeleton placeholder. Use on solid-colored rectangles, circles, or
/// capsules to indicate loading without spinning a `ProgressView`.
///
/// Usage:
/// ```
/// RoundedRectangle(cornerRadius: 12)
///     .fill(Theme.Color.bg3)
///     .frame(height: 56)
///     .shimmer()
/// ```
struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -1.0

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { proxy in
                    LinearGradient(
                        gradient: Gradient(stops: [
                            .init(color: .white.opacity(0.0), location: 0.0),
                            .init(color: .white.opacity(0.18), location: 0.5),
                            .init(color: .white.opacity(0.0), location: 1.0)
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .frame(width: proxy.size.width * 1.5)
                    .offset(x: proxy.size.width * phase)
                    .blendMode(.plusLighter)
                }
                .allowsHitTesting(false)
            )
            .mask(content)
            .onAppear {
                withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                    phase = 1.5
                }
            }
    }
}

extension View {
    /// Apply a continuous shimmer overlay. Honors `Reduce Motion` by
    /// substituting a static dim.
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}

/// Reusable skeleton row — circle avatar + two stacked rectangles. Used in
/// HomeView while conversations load.
struct ConversationSkeletonRow: View {
    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            Circle()
                .fill(Theme.Color.bg3)
                .frame(width: 56, height: 56)

            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                RoundedRectangle(cornerRadius: 6).fill(Theme.Color.bg3).frame(height: 14)
                RoundedRectangle(cornerRadius: 6).fill(Theme.Color.bg3).frame(width: 180, height: 10)
            }

            Spacer(minLength: 0)
        }
        .padding(Theme.Spacing.s3)
        .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
        .shimmer()
    }
}

/// Reusable skeleton card — full-bleed avatar block + 2 metadata rows.
/// Used in PeopleView grid while characters load.
struct CharacterSkeletonCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Rectangle()
                .fill(Theme.Color.bg3)
                .aspectRatio(1, contentMode: .fit)

            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                RoundedRectangle(cornerRadius: 6).fill(Theme.Color.bg3).frame(height: 14)
                RoundedRectangle(cornerRadius: 6).fill(Theme.Color.bg3).frame(width: 100, height: 10)
            }
            .padding(Theme.Spacing.s3)
        }
        .background(Theme.Color.bg2)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card))
        .shimmer()
    }
}

/// Reusable skeleton bubble — assistant avatar + 3-line text block.
/// Used in ChatView while messages load.
struct ChatBubbleSkeleton: View {
    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s2) {
            Circle()
                .fill(Theme.Color.bg3)
                .frame(width: 28, height: 28)

            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                RoundedRectangle(cornerRadius: 6).fill(Theme.Color.bg3).frame(height: 12)
                RoundedRectangle(cornerRadius: 6).fill(Theme.Color.bg3).frame(width: 280, height: 12)
                RoundedRectangle(cornerRadius: 6).fill(Theme.Color.bg3).frame(width: 200, height: 12)
            }
            .padding(Theme.Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
        }
        .padding(.horizontal, Theme.Spacing.s3)
        .shimmer()
    }
}
