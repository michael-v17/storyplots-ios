import SwiftUI

struct HomeNudge: View {
    let onCreateCharacter: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            HStack(spacing: Theme.Spacing.s2) {
                Image(systemName: "sparkles")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.brand1)
                Text("First steps")
                    .font(Theme.FontStyle.timestamp.weight(.semibold))
                    .tracking(1.2)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Color.brand1)
            }

            Text("Start with a character")
                .font(Theme.FontStyle.h3)
                .foregroundStyle(Theme.Color.fg)

            Text("Craft a persona — name, scenario, tone — and the rest of the app comes alive. You can also generate one with AI or import a PNG card.")
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.fg2)

            Button(action: {
                Haptics.impact(.medium)
                onCreateCharacter()
            }) {
                Label {
                    Text("Create character")
                        .font(Theme.FontStyle.body.weight(.semibold))
                        .foregroundStyle(Theme.Color.fgOnBrand)
                } icon: {
                    Image(systemName: "plus")
                        .foregroundStyle(Theme.Color.fgOnBrand)
                }
                .padding(.horizontal, Theme.Spacing.s4)
                .padding(.vertical, Theme.Spacing.s3)
                .background(Theme.Color.brandGradient, in: Capsule())
            }
            .buttonStyle(.plain)
            .padding(.top, Theme.Spacing.s2)
        }
        .padding(Theme.Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .strokeBorder(Theme.Color.brand1.opacity(0.35), lineWidth: 1)
        )
    }
}
