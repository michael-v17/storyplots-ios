import SwiftUI

/// Phase 1 placeholder. Phase 2 replaces with the real `HomeView`.
struct HomePlaceholder: View {
    var body: some View {
        ZStack {
            Theme.Color.bg.ignoresSafeArea()
            VStack(spacing: Theme.Spacing.s2) {
                Image(systemName: "bubble.left.and.bubble.right.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(Theme.Color.brand1)
                Text("Recent chats").font(Theme.FontStyle.h3).foregroundStyle(Theme.Color.fg)
                Text("Phase 2 populates this with conversations.")
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg3)
                    .multilineTextAlignment(.center)
            }
            .padding()
        }
    }
}
