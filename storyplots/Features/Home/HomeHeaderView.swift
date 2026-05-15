import SwiftUI

/// Custom Home header — replaces the stock `.navigationTitle("Home")` with
/// an avatar + greeting + count layout overlaid on a subtle brand gradient
/// wash. Sits at the top of the scroll content so it scrolls away naturally;
/// the toolbar takes over once it's past the safe area.
struct HomeHeaderView: View {
    let personaName: String?
    let personaPhotoRef: String?
    let conversationCount: Int
    let onAvatarTap: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: Theme.Spacing.s3) {
            Button(action: {
                Haptics.impact(.light)
                onAvatarTap()
            }) {
                avatar
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 2) {
                Text(stemGreeting)
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg3)
                    .lineLimit(1)
                Text(personaFirstName)
                    .font(Theme.FontStyle.h2)
                    .foregroundStyle(Theme.Color.fg)
                    .lineLimit(1)
                Text(countLabel)
                    .font(Theme.FontStyle.timestamp)
                    .foregroundStyle(Theme.Color.fg4)
                    .padding(.top, 1)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.Spacing.s4)
        .padding(.top, Theme.Spacing.s2)
        .padding(.bottom, Theme.Spacing.s3)
    }

    private var avatar: some View {
        AvatarView(
            avatarRef: personaPhotoRef,
            name: personaName ?? "You",
            accent: Theme.Color.brand1,
            size: 56,
            ringWidth: 1.5
        )
    }

    private var stemGreeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12:  return "Good morning,"
        case 12..<17: return "Good afternoon,"
        case 17..<22: return "Good evening,"
        default:      return "Hey,"
        }
    }

    private var personaFirstName: String {
        if let name = personaName?.split(separator: " ").first, !name.isEmpty {
            return String(name)
        }
        return "Storyteller"
    }

    private var countLabel: String {
        switch conversationCount {
        case 0:  return "Ready when you are."
        case 1:  return "1 character"
        default: return "\(conversationCount) characters"
        }
    }
}
