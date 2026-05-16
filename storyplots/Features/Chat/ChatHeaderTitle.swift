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
                    size: 36,
                    ringWidth: 1.75
                )
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 4) {
                        Text(characterName)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Theme.Color.fg)
                            .lineLimit(1)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Theme.Color.fg3)
                    }
                    if isStreaming {
                        Text("typing…")
                            .font(Theme.FontStyle.timestamp)
                            .foregroundStyle(accent)
                            .lineLimit(1)
                    } else if let tagline, !tagline.isEmpty {
                        Text(tagline)
                            .font(Theme.FontStyle.timestamp)
                            .foregroundStyle(Theme.Color.fg2)
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
