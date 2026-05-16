import SwiftUI

/// Tappable principal-toolbar item for `ChatView`. Opens the character detail
/// sheet on tap; mirrors the iMessage-style header (avatar + name + secondary
/// line) so the chrome stays familiar.
struct ChatHeaderTitle: View {
    let avatarRef: String?
    let characterName: String
    let tagline: String?
    let isStreaming: Bool
    let accent: Color
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Theme.Spacing.s2) {
                AvatarView(
                    avatarRef: avatarRef,
                    name: characterName,
                    accent: accent,
                    size: 28,
                    ringWidth: 1.5
                )
                VStack(alignment: .leading, spacing: 0) {
                    Text(characterName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.Color.fg)
                        .lineLimit(1)
                    if isStreaming {
                        Text("typing…")
                            .font(.caption2)
                            .foregroundStyle(accent)
                            .lineLimit(1)
                    } else if let tagline, !tagline.isEmpty {
                        Text(tagline)
                            .font(.caption2)
                            .foregroundStyle(Theme.Color.fg3)
                            .lineLimit(1)
                    }
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open character details")
        .accessibilityAddTraits(.isButton)
    }
}
