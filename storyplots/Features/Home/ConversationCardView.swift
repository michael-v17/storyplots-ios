import SwiftUI

/// One row in the Home list. Tappable — pushes a `ChatPlaceholderView` in Phase 2
/// (Phase 4-5 replace with real `ChatView`).
struct ConversationCardView: View {
    let conversation: Conversation
    let accent: Color
    let avatarRef: String?
    let previewText: String?
    /// When false, omits the character name from the row — used by
    /// `CharacterChatsView` which already shows the character as the screen
    /// header, so the per-row name is redundant noise.
    let showCharacterName: Bool

    init(conversation: Conversation,
         accent: Color,
         avatarRef: String?,
         previewText: String? = nil,
         showCharacterName: Bool = true) {
        self.conversation = conversation
        self.accent = accent
        self.avatarRef = avatarRef
        self.previewText = previewText
        self.showCharacterName = showCharacterName
    }

    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            AvatarView(
                avatarRef: avatarRef,
                name: conversation.characterName,
                accent: accent,
                size: 56
            )

            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                if showCharacterName {
                    Text(conversation.characterName)
                        .font(.headline)
                        .foregroundStyle(Theme.Color.fg)
                        .lineLimit(1)
                }

                Text(titleDisplay)
                    .font(showCharacterName ? .callout : Theme.FontStyle.body.weight(.medium))
                    .foregroundStyle(showCharacterName ? Theme.Color.fg2 : Theme.Color.fg)
                    .lineLimit(2)

                if let previewText, !previewText.isEmpty {
                    Text(previewText)
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.fg3)
                        .lineLimit(showCharacterName ? 1 : 2)
                }
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

    /// When the screen already shows the character header (CharacterChatsView),
    /// strip any redundant "Character · " prefix from the conversation title.
    /// "Gianni · Scenario" → "Scenario", "Gianni" → "New conversation",
    /// untouched titles stay as-is.
    private var titleDisplay: String {
        let raw = conversation.title.trimmingCharacters(in: .whitespaces)
        guard !showCharacterName else {
            return raw.isEmpty ? "Untitled chat" : raw
        }
        let prefix = conversation.characterName + " · "
        if raw.hasPrefix(prefix) {
            let stripped = String(raw.dropFirst(prefix.count)).trimmingCharacters(in: .whitespaces)
            return stripped.isEmpty ? "Conversation" : stripped
        }
        if raw == conversation.characterName || raw.isEmpty {
            return "New conversation"
        }
        return raw
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
