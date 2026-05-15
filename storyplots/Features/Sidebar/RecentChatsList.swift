import SwiftUI

struct RecentChatsList: View {
    let rows: [GroupedCharacterRow]
    let accentResolver: (Character) -> Color
    let avatarRefResolver: (Character) -> String?
    let onTap: (GroupedCharacterRow) -> Void

    var body: some View {
        if rows.isEmpty {
            HStack {
                Text("No chats yet")
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg4)
                Spacer(minLength: 0)
            }
            .padding(.vertical, Theme.Spacing.s2)
        } else {
            ForEach(rows) { row in
                Button(action: {
                    Haptics.impact(.light)
                    onTap(row)
                }) {
                    HStack(spacing: Theme.Spacing.s3) {
                        AvatarView(
                            avatarRef: avatarRefResolver(row.character),
                            name: row.character.name,
                            accent: accentResolver(row.character),
                            size: 32,
                            ringWidth: 1.5
                        )
                        VStack(alignment: .leading, spacing: 1) {
                            Text(row.character.name)
                                .font(Theme.FontStyle.body)
                                .foregroundStyle(Theme.Color.fg)
                                .lineLimit(1)
                            Text(countLabel(row.count))
                                .font(Theme.FontStyle.timestamp)
                                .foregroundStyle(Theme.Color.fg3)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, Theme.Spacing.s2)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func countLabel(_ count: Int) -> String {
        switch count {
        case 0:  return "No chats"
        case 1:  return "1 chat"
        default: return "\(count) chats"
        }
    }
}
