import SwiftUI

/// Editorial empty state — brand-gradient SF Symbol on a soft brand-tinted
/// disc, headline, caption, and an optional primary action.
///
/// Used by Home (no conversations), People (no characters), Chat (no
/// messages), and Search (no results).
struct EmptyStateView: View {
    let systemImage: String
    let title: String
    let message: String
    let actionTitle: String?
    let onAction: (() -> Void)?

    init(systemImage: String,
         title: String,
         message: String,
         actionTitle: String? = nil,
         onAction: (() -> Void)? = nil) {
        self.systemImage = systemImage
        self.title = title
        self.message = message
        self.actionTitle = actionTitle
        self.onAction = onAction
    }

    var body: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ZStack {
                Circle()
                    .fill(Theme.Color.brand1.opacity(0.12))
                    .frame(width: 96, height: 96)
                Circle()
                    .strokeBorder(Theme.Color.brand1.opacity(0.20), lineWidth: 1)
                    .frame(width: 96, height: 96)
                Image(systemName: systemImage)
                    .font(.system(size: 36, weight: .medium))
                    .foregroundStyle(Theme.Color.brandGradient)
                    .shadow(color: Theme.Color.brand2.opacity(0.35), radius: 12, y: 4)
            }

            VStack(spacing: Theme.Spacing.s2) {
                Text(title)
                    .font(Theme.FontStyle.h3)
                    .foregroundStyle(Theme.Color.fg)
                    .multilineTextAlignment(.center)

                Text(message)
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg3)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Theme.Spacing.s4)
            }

            if let actionTitle, let onAction {
                Button {
                    Haptics.impact(.medium)
                    onAction()
                } label: {
                    Text(actionTitle)
                        .font(Theme.FontStyle.body.weight(.semibold))
                        .foregroundStyle(Theme.Color.fgOnBrand)
                        .padding(.horizontal, Theme.Spacing.s5)
                        .padding(.vertical, Theme.Spacing.s3)
                        .background(Theme.Color.brandGradient, in: Capsule())
                }
                .padding(.top, Theme.Spacing.s1)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.Spacing.s10)
    }
}
