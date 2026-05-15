import SwiftUI

/// Single chat bubble. Side / background / border vary by role per
/// `seed/ux.md` §5.2 (user right-aligned with brand2 tint, character
/// left-aligned with bg2 + accent border).
struct MessageBubbleView: View {
    let item: MessageItem
    let accent: Color
    let characterName: String
    let avatarURL: URL?

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s2) {
            if item.role == .assistant {
                AvatarView(
                    imageURL: avatarURL,
                    name: characterName,
                    accent: accent,
                    size: 28,
                    ringWidth: 1
                )
                bubble
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                Spacer(minLength: Theme.Spacing.s6)
                bubble
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .padding(.horizontal, Theme.Spacing.s3)
    }

    private var bubble: some View {
        let isAssistant = item.role == .assistant
        return VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            renderedBody
                .font(.body)
                .foregroundStyle(Theme.Color.fg)
                .frame(maxWidth: bubbleMaxWidth, alignment: .leading)
        }
        .padding(Theme.Spacing.s3)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .fill(isAssistant ? Theme.Color.bg2 : Theme.Color.bg3)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .stroke(isAssistant ? accent.opacity(0.45) : Color.clear, lineWidth: 1)
        )
    }

    private var bubbleMaxWidth: CGFloat? {
        // ~80% width — actual constraint comes from the parent HStack + Spacer.
        nil
    }

    /// Try Markdown first; fall back to plain Text per `seed/tech-stack.md` §3 Q3.3.
    @ViewBuilder
    private var renderedBody: some View {
        if let attributed = try? AttributedString(markdown: item.body, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)) {
            Text(attributed)
        } else {
            Text(item.body)
        }
    }
}
