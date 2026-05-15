import SwiftUI

/// Phase 1 placeholder. Phase 3 replaces with the real `PeopleView`.
struct PeoplePlaceholder: View {
    var body: some View {
        ZStack {
            Theme.Color.bg.ignoresSafeArea()
            VStack(spacing: Theme.Spacing.s2) {
                Image(systemName: "person.2.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(Theme.Color.brand1)
                Text("People").font(Theme.FontStyle.h3).foregroundStyle(Theme.Color.fg)
                Text("Phase 3 populates this with characters.")
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg3)
                    .multilineTextAlignment(.center)
            }
            .padding()
        }
    }
}
