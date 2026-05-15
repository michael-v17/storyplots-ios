import SwiftUI

/// Compact "this is who you're playing as" affordance at the top of Home.
/// Phase 2 ships as read-only; tap is wired but the persona-edit sheet lands
/// in Phase 9 / when the persona surface gets real.
struct YourPersonaPill: View {
    let persona: UserPersona?
    let onTap: () -> Void

    var body: some View {
        Button {
            onTap()
        } label: {
            HStack(spacing: Theme.Spacing.s2) {
                AvatarView(
                    imageURL: nil,
                    name: persona?.name ?? "You",
                    accent: Theme.Color.brand1,
                    size: 40,
                    ringWidth: 1.5
                )

                VStack(alignment: .leading, spacing: 0) {
                    Text("Your persona").sectionLabel()
                    Text(persona?.name ?? "Unnamed")
                        .font(.subheadline)
                        .foregroundStyle(Theme.Color.fg1)
                }

                Spacer(minLength: Theme.Spacing.s2)

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.Color.fg3)
            }
            .padding(Theme.Spacing.s3)
            .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
        }
        .buttonStyle(.plain)
    }
}
