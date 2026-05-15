import SwiftUI

/// One row in the Home list. Tappable — pushes a `ChatPlaceholderView` in Phase 2
/// (Phase 4-5 replace with real `ChatView`).
struct ConversationCardView: View {
    let conversation: Conversation
    let accent: Color
    let avatarURL: URL?

    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            AvatarView(
                imageURL: avatarURL,
                name: conversation.characterName,
                accent: accent,
                size: 56
            )

            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text(conversation.characterName)
                    .font(.headline)
                    .foregroundStyle(Theme.Color.fg)
                    .lineLimit(1)

                Text(conversation.title.isEmpty ? "Untitled chat" : conversation.title)
                    .font(.callout)
                    .foregroundStyle(Theme.Color.fg2)
                    .lineLimit(2)
            }

            Spacer(minLength: Theme.Spacing.s2)

            Text(relativeTimestamp)
                .font(Theme.FontStyle.timestamp)
                .foregroundStyle(Theme.Color.fg4)
                .alignmentGuide(.firstTextBaseline) { d in d[.top] }
        }
        .padding(Theme.Spacing.s3)
        .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
    }

    private var relativeTimestamp: String {
        let raw = conversation.last_message_at ?? conversation.updated_at
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let basic = ISO8601DateFormatter()
        basic.formatOptions = [.withInternetDateTime]
        guard let date = fractional.date(from: raw) ?? basic.date(from: raw) else {
            return ""
        }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
