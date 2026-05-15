import SwiftUI

/// Grid card for the People tab. Aspect ratio ~1:1.2 — avatar fullbleed at
/// the top, name + tagline at the bottom. Per-character accent shows up as
/// a 2pt border.
struct CharacterCardView: View {
    let character: Character
    let accent: Color
    let avatarURL: URL?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            avatar
            metadata
        }
        .background(Theme.Color.bg2)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .stroke(accent.opacity(0.55), lineWidth: 2)
        )
    }

    private var avatar: some View {
        ZStack {
            accent.opacity(0.18)
            if let url = avatarURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .empty, .failure:
                        initialsFallback
                    @unknown default:
                        initialsFallback
                    }
                }
            } else {
                initialsFallback
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .clipped()
    }

    private var initialsFallback: some View {
        Text(initialsString)
            .font(.system(size: 44, weight: .bold, design: .rounded))
            .foregroundStyle(Theme.Color.fg)
    }

    private var metadata: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text(character.name)
                .font(.headline)
                .foregroundStyle(Theme.Color.fg)
                .lineLimit(1)

            if let tagline = character.tagline, !tagline.isEmpty {
                Text(tagline)
                    .font(.caption)
                    .foregroundStyle(Theme.Color.fg3)
                    .lineLimit(2)
            } else if let scenario = character.scenario, !scenario.isEmpty {
                Text(scenario)
                    .font(.caption)
                    .foregroundStyle(Theme.Color.fg3)
                    .lineLimit(2)
            }
        }
        .padding(Theme.Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var initialsString: String {
        let trimmed = character.name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return "·" }
        let parts = trimmed.split(separator: " ", omittingEmptySubsequences: true).prefix(2)
        return String(parts.compactMap { $0.first }).uppercased()
    }
}
