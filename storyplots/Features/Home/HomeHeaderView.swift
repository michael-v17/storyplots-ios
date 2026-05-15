import SwiftUI

/// Custom Home header — replaces the stock `.navigationTitle("Home")` with
/// an avatar + greeting + count layout overlaid on a subtle brand gradient
/// wash. Sits at the top of the scroll content so it scrolls away naturally;
/// the toolbar takes over once it's past the safe area.
struct HomeHeaderView: View {
    let personaName: String?
    let conversationCount: Int
    let onAvatarTap: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: Theme.Spacing.s3) {
            Button(action: {
                Haptics.impact(.light)
                onAvatarTap()
            }) {
                avatar
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 2) {
                Text(greeting)
                    .font(Theme.FontStyle.h2)
                    .foregroundStyle(Theme.Color.fg)
                    .lineLimit(1)
                Text(countLabel)
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg3)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.Spacing.s4)
        .padding(.top, Theme.Spacing.s5)
        .padding(.bottom, Theme.Spacing.s3)
    }

    private var avatar: some View {
        ZStack {
            Circle()
                .fill(Theme.Color.brand1.opacity(0.22))
                .frame(width: 48, height: 48)
            Circle()
                .strokeBorder(Theme.Color.brand1.opacity(0.55), lineWidth: 1.5)
                .frame(width: 48, height: 48)
            Text(initialsString)
                .font(.system(size: 18, weight: .semibold, design: .rounded))
                .foregroundStyle(Theme.Color.fg)
        }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        let stem: String
        switch hour {
        case 5..<12:  stem = "Good morning"
        case 12..<17: stem = "Good afternoon"
        case 17..<22: stem = "Good evening"
        default:      stem = "Hey"
        }
        if let name = personaName?.split(separator: " ").first, !name.isEmpty {
            return "\(stem), \(name)"
        }
        return stem
    }

    private var countLabel: String {
        switch conversationCount {
        case 0:  return "Ready when you are."
        case 1:  return "1 conversation"
        default: return "\(conversationCount) conversations"
        }
    }

    private var initialsString: String {
        guard let name = personaName, !name.isEmpty else { return "·" }
        let parts = name.split(separator: " ", omittingEmptySubsequences: true).prefix(2)
        return String(parts.compactMap { $0.first }).uppercased()
    }
}
