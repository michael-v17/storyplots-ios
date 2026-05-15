import SwiftUI

/// Phase 2 placeholder for the chat surface. Phase 4-5 replace with the real
/// `ChatView` + streaming composer.
struct ChatPlaceholderView: View {
    let conversationID: String
    let characterName: String
    let accent: Color

    var body: some View {
        ZStack {
            Theme.Color.bg.ignoresSafeArea()

            VStack(spacing: Theme.Spacing.s3) {
                Circle()
                    .fill(accent.opacity(0.18))
                    .frame(width: 80, height: 80)
                    .overlay(Circle().stroke(accent.opacity(0.55), lineWidth: 2))
                    .overlay(
                        Image(systemName: "bubble.left.and.bubble.right.fill")
                            .font(.title)
                            .foregroundStyle(accent)
                    )

                Text(characterName)
                    .font(Theme.FontStyle.h3)
                    .foregroundStyle(Theme.Color.fg)

                Text("Chat surface lands in Phase 4-5.")
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg3)

                Text("Conversation \(conversationID.prefix(8))…")
                    .font(Theme.FontStyle.timestamp)
                    .foregroundStyle(Theme.Color.fg4)
                    .padding(.top, Theme.Spacing.s2)
            }
            .padding(Theme.Spacing.s5)
        }
        .navigationTitle(characterName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
    }
}
