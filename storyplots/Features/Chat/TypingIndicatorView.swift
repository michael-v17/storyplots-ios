import SwiftUI

/// Bare 3-dot bounce animation in the supplied accent color. Used inline
/// inside an empty assistant bubble (the placeholder created by the SSE
/// `start` event before tokens stream in) and inside `TypingIndicatorView`
/// for the pre-`start` cold-start window where no placeholder bubble exists
/// yet.
struct TypingDotsView: View {
    let accent: Color

    @State private var pulse: Bool = false

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<3, id: \.self) { idx in
                Circle()
                    .fill(accent)
                    .frame(width: 7, height: 7)
                    .opacity(pulse ? 1.0 : 0.35)
                    .animation(
                        .easeInOut(duration: 0.55)
                            .repeatForever(autoreverses: true)
                            .delay(Double(idx) * 0.15),
                        value: pulse
                    )
            }
        }
        .padding(.vertical, 2)
        .onAppear { pulse = true }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Typing")
    }
}

/// PersonaLLM-style "the character is typing" pill — character avatar on the
/// left, an accent-tinted bubble containing `TypingDotsView`. Rendered by
/// `ChatView.resolvedScroll` only while we're waiting for the backend's
/// `start` event (i.e. before any assistant placeholder has been appended),
/// so the user sees motion instead of a blank scroll during cold start.
/// Once the placeholder lands, the empty bubble itself shows the dots via
/// `MessageBubbleView` and this standalone indicator hides.
struct TypingIndicatorView: View {
    let accent: Color
    let characterName: String
    let avatarRef: String?

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s2) {
            AvatarView(
                avatarRef: avatarRef,
                name: characterName,
                accent: accent,
                size: 28,
                ringWidth: 1
            )
            TypingDotsView(accent: accent)
                .padding(.horizontal, Theme.Spacing.s3)
                .padding(.vertical, Theme.Spacing.s3 - 2)
                .background(
                    RoundedRectangle(cornerRadius: Theme.Radius.card)
                        .fill(Theme.Color.bg1)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.card)
                        .stroke(accent.opacity(0.35), lineWidth: 1)
                )
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.Spacing.s3)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(characterName) is typing")
    }
}

#Preview {
    VStack(spacing: 20) {
        TypingIndicatorView(accent: .orange, characterName: "Tomás", avatarRef: nil)
        TypingDotsView(accent: .orange)
    }
    .padding()
    .background(Color.black)
}
