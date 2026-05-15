import SwiftUI

/// Custom Settings header — title + mini wordmark, with the same brand-gradient
/// wash that Home/People use so the three tabs feel like one app.
struct SettingsHeaderView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Settings")
                .font(Theme.FontStyle.h2)
                .foregroundStyle(Theme.Color.fg)
            Text("Engines, writing, and your account")
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.fg3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Theme.Spacing.s4)
        .padding(.top, Theme.Spacing.s3)
        .padding(.bottom, Theme.Spacing.s3)
    }
}
