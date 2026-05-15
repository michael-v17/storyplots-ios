import SwiftUI

/// Reusable circle avatar that either renders an `AsyncImage` (when a URL is
/// available) or falls back to an initials disc tinted with the character's
/// accent. Used by ConversationCard, YourPersonaPill, and Phase 3+ character grid.
struct AvatarView: View {
    let imageURL: URL?
    let initials: String
    let accent: Color
    let size: CGFloat
    let ringWidth: CGFloat

    init(imageURL: URL? = nil,
         name: String,
         accent: Color = Theme.Color.brand1,
         size: CGFloat = 56,
         ringWidth: CGFloat = 2) {
        self.imageURL = imageURL
        self.initials = Self.makeInitials(from: name)
        self.accent = accent
        self.size = size
        self.ringWidth = ringWidth
    }

    var body: some View {
        ZStack {
            if let url = imageURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure, .empty:
                        fallback
                    @unknown default:
                        fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().stroke(accent.opacity(0.55), lineWidth: ringWidth))
    }

    private var fallback: some View {
        ZStack {
            accent.opacity(0.18)
            Text(initials)
                .font(.system(size: size * 0.38, weight: .semibold, design: .rounded))
                .foregroundStyle(Theme.Color.fg)
        }
    }

    private static func makeInitials(from name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return "·" }
        let parts = trimmed.split(separator: " ", omittingEmptySubsequences: true).prefix(2)
        let chars = parts.compactMap { $0.first }
        return String(chars).uppercased()
    }
}
