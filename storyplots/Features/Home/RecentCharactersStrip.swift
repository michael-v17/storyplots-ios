import SwiftUI

struct RecentCharactersStrip: View {
    let characters: [Character]
    let accentResolver: (Character) -> Color
    let avatarRefResolver: (Character) -> String?
    let onTap: (Character) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("Recent")
                .font(.caption.weight(.semibold))
                .tracking(1.5)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Color.fg3)
                .padding(.horizontal, Theme.Spacing.s4)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.Spacing.s3) {
                    ForEach(characters.prefix(8)) { character in
                        Button(action: {
                            Haptics.impact(.light)
                            onTap(character)
                        }) {
                            VStack(spacing: Theme.Spacing.s2) {
                                AvatarView(
                                    avatarRef: avatarRefResolver(character),
                                    name: character.name,
                                    accent: accentResolver(character),
                                    size: 72,
                                    ringWidth: 2
                                )
                                Text(character.name)
                                    .font(Theme.FontStyle.timestamp.weight(.semibold))
                                    .foregroundStyle(Theme.Color.fg1)
                                    .lineLimit(1)
                                    .frame(maxWidth: 88)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, Theme.Spacing.s4)
            }
        }
    }
}
