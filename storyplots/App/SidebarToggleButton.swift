import SwiftUI

/// Reusable hamburger-style toolbar button that opens the app-level sidebar
/// sheet via the `AppShellEnvironment` injected by `AppShellView`.
struct SidebarToggleButton: View {
    @Environment(AppShellEnvironment.self) private var shell

    var body: some View {
        Button {
            Haptics.impact(.light)
            shell.openSidebar()
        } label: {
            Image(systemName: "line.3.horizontal")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.Color.fg)
                .frame(width: 36, height: 36)
                .background(Theme.Color.bg2.opacity(0.85), in: Circle())
                .overlay(Circle().strokeBorder(Theme.Color.borderSoft, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open sidebar")
    }
}
