import SwiftUI

struct SidebarPersonaCard: View {
    let persona: UserPersona?
    let userEmail: String?
    let onTap: () -> Void

    var body: some View {
        Button(action: {
            Haptics.impact(.light)
            onTap()
        }) {
            HStack(spacing: Theme.Spacing.s3) {
                AvatarView(
                    avatarRef: persona?.photo_ref,
                    name: persona?.name ?? displayName,
                    accent: Theme.Color.brand1,
                    size: 36,
                    ringWidth: 1.5
                )
                VStack(alignment: .leading, spacing: 2) {
                    Text(persona?.name ?? displayName)
                        .font(Theme.FontStyle.body.weight(.semibold))
                        .foregroundStyle(Theme.Color.fg)
                        .lineLimit(1)
                    Text(persona == nil ? "Set up persona" : "Your persona")
                        .font(Theme.FontStyle.timestamp)
                        .foregroundStyle(persona == nil ? Theme.Color.brand1 : Theme.Color.fg3)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.fg4)
            }
            .padding(.vertical, Theme.Spacing.s2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var displayName: String {
        if let email = userEmail, let stem = email.split(separator: "@").first {
            return String(stem).capitalized
        }
        return "You"
    }
}
