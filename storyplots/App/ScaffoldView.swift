import SwiftUI

/// Phase-0 diagnostic view. Phase 1 replaces this with the auth-aware
/// composition (`AuthFlow ↔ MainTabView`) per `seed/roadmap.md` §Fase 1.
struct ScaffoldView: View {
    var body: some View {
        ZStack {
            Theme.Color.bg
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                Text("StoryPlots")
                    .font(Theme.FontStyle.h1)
                    .foregroundStyle(Theme.Color.brandGradient)

                Text("phase 0 — bootstrap").sectionLabel()

                Text("Xcode scaffolding ready. Phase 1 wires authentication next.")
                    .font(Theme.FontStyle.body)
                    .foregroundStyle(Theme.Color.fg2)
            }
            .padding(Theme.Spacing.s6)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

#Preview {
    ScaffoldView()
        .preferredColorScheme(.dark)
}
