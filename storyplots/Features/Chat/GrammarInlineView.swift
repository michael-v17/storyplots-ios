import SwiftUI

/// Inline grammar correction strip rendered below a user message bubble.
/// Shows the corrected text (`✎ corrected`) right-aligned to match the
/// trailing user pill, plus a "View" affordance that opens a detail sheet
/// with the full diff (original vs corrected) and the model's explanation.
struct GrammarInlineView: View {
    let correction: GrammarCorrection
    let accent: Color

    @State private var showDetail: Bool = false

    var body: some View {
        Button {
            Haptics.impact(.light)
            showDetail = true
        } label: {
            HStack(alignment: .top, spacing: Theme.Spacing.s2) {
                Image(systemName: "checkmark.bubble.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(accent.opacity(0.85))
                Text(correction.corrected_text ?? "")
                    .font(Theme.FontStyle.meta.italic())
                    .foregroundStyle(Theme.Color.fg2)
                    .multilineTextAlignment(.trailing)
                    .lineLimit(2)
            }
            .padding(.horizontal, Theme.Spacing.s2)
            .padding(.vertical, 4)
            .background(
                Capsule().fill(accent.opacity(0.10))
            )
            .overlay(
                Capsule().stroke(accent.opacity(0.35), lineWidth: 0.75)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Grammar correction: \(correction.corrected_text ?? "")")
        .sheet(isPresented: $showDetail) {
            GrammarCorrectionDetailView(correction: correction, accent: accent) {
                showDetail = false
            }
            .presentationDetents([.medium])
        }
    }
}

/// Detail sheet that opens when the inline strip is tapped — shows
/// original vs corrected with the model's explanation and category tags.
struct GrammarCorrectionDetailView: View {
    let correction: GrammarCorrection
    let accent: Color
    let onDismiss: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                    if let original = correction.original_text {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                            Text("Original")
                                .font(Theme.FontStyle.timestamp.weight(.semibold))
                                .foregroundStyle(Theme.Color.fg3)
                            Text(original)
                                .font(.body)
                                .foregroundStyle(Theme.Color.fg)
                                .padding(Theme.Spacing.s3)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(
                                    RoundedRectangle(cornerRadius: Theme.Radius.card)
                                        .fill(Theme.Color.bg2)
                                )
                        }
                    }
                    if let corrected = correction.corrected_text {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                            Text("Corrected")
                                .font(Theme.FontStyle.timestamp.weight(.semibold))
                                .foregroundStyle(accent)
                            Text(corrected)
                                .font(.body)
                                .foregroundStyle(Theme.Color.fg)
                                .padding(Theme.Spacing.s3)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(
                                    RoundedRectangle(cornerRadius: Theme.Radius.card)
                                        .fill(accent.opacity(0.12))
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: Theme.Radius.card)
                                        .stroke(accent.opacity(0.45), lineWidth: 1)
                                )
                        }
                    }
                    if let explanation = correction.explanation, !explanation.isEmpty {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                            Text("Why")
                                .font(Theme.FontStyle.timestamp.weight(.semibold))
                                .foregroundStyle(Theme.Color.fg3)
                            Text(explanation)
                                .font(Theme.FontStyle.meta)
                                .foregroundStyle(Theme.Color.fg)
                        }
                    }
                    if let categories = correction.error_categories, !categories.isEmpty {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                            Text("Categories")
                                .font(Theme.FontStyle.timestamp.weight(.semibold))
                                .foregroundStyle(Theme.Color.fg3)
                            HStack(spacing: Theme.Spacing.s1) {
                                ForEach(categories, id: \.self) { cat in
                                    Text(cat)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(accent)
                                        .padding(.horizontal, Theme.Spacing.s2)
                                        .padding(.vertical, 4)
                                        .background(Capsule().fill(accent.opacity(0.15)))
                                        .overlay(Capsule().stroke(accent.opacity(0.45), lineWidth: 0.75))
                                }
                            }
                        }
                    }
                    Spacer(minLength: Theme.Spacing.s2)
                }
                .padding(Theme.Spacing.s4)
            }
            .background(Theme.Color.bg)
            .navigationTitle("Grammar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: onDismiss)
                        .foregroundStyle(accent)
                }
            }
        }
    }
}
