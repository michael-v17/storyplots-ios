import SwiftUI

/// Disabled placeholder while Apple Sign-In is gated on a paid Apple Developer
/// account entitlement. The live `SignInWithAppleButton` lives in git history
/// — restore it once the entitlement ships.
struct AppleSignInButton: View {
    @Environment(AuthStore.self) private var auth
    @State private var nonce: String?

    var body: some View {
        // Apple Sign-In requires a paid Apple Developer account entitlement.
        // While Personal Team development is in use, render a disabled placeholder.
        HStack(spacing: Theme.Spacing.s2) {
            Image(systemName: "applelogo")
                .font(.system(size: 18, weight: .medium))
            Text("Sign in with Apple")
                .font(Theme.FontStyle.body.weight(.semibold))
            Spacer(minLength: 0)
            Text("soon")
                .font(Theme.FontStyle.timestamp.weight(.semibold))
                .foregroundStyle(Theme.Color.fg3)
                .padding(.horizontal, Theme.Spacing.s2)
                .padding(.vertical, 2)
                .background(Theme.Color.bg3, in: Capsule())
        }
        .foregroundStyle(Theme.Color.fg2)
        .padding(.horizontal, Theme.Spacing.s4)
        .frame(maxWidth: .infinity, minHeight: 48)
        .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .strokeBorder(Theme.Color.borderSoft, lineWidth: 1)
        )
        .opacity(0.65)
        .accessibilityLabel("Sign in with Apple — coming soon")
    }
}
