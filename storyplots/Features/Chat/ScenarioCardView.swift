import SwiftUI

/// Distinct top-of-thread card that renders the scenario message — accented
/// border, corner pills, no rail, no timestamp. Drawn in place of the regular
/// `MessageBubbleView` when `MessageItem.isScenario == true`. Per
/// `base/Seed/PersonaLLM-Reference/04-screens/chat.md` §C.
struct ScenarioCardView: View {
    let text: String
    let accent: Color
    let scenarioTitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            HStack {
                pill(text: "Scenario", filled: false)
                Spacer(minLength: Theme.Spacing.s2)
                if let scenarioTitle, !scenarioTitle.isEmpty {
                    pill(text: scenarioTitle, filled: true)
                }
            }
            renderedBody
                .font(.body)
                .foregroundStyle(Theme.Color.fg)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Theme.Spacing.s4)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .fill(Theme.Color.bg1)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .stroke(accent.opacity(0.55), lineWidth: 1.5)
        )
        .padding(.horizontal, Theme.Spacing.s3)
    }

    @ViewBuilder
    private func pill(text: String, filled: Bool) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(filled ? Theme.Color.fgOnBrand : accent)
            .padding(.horizontal, Theme.Spacing.s2)
            .padding(.vertical, 4)
            .background(
                Capsule().fill(filled ? AnyShapeStyle(accent) : AnyShapeStyle(accent.opacity(0.15)))
            )
            .overlay(
                Capsule().stroke(accent.opacity(filled ? 0 : 0.55), lineWidth: 1)
            )
    }

    @ViewBuilder
    private var renderedBody: some View {
        if let attributed = try? AttributedString(
            markdown: text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        ) {
            Text(attributed)
        } else {
            Text(text)
        }
    }
}

#Preview {
    ScenarioCardView(
        text: "The user has just connected a power source to the dormant robot found half-buried in junkyard scrap. After a tense moment of silence, the machine's eyes flicker to life with a deep crimson glow.",
        accent: .orange,
        scenarioTitle: "First Activation"
    )
    .padding()
    .background(Color.black)
}
