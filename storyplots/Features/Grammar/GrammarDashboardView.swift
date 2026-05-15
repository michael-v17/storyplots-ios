import SwiftUI
import Supabase

struct GrammarDashboardView: View {
    @State private var model: GrammarDashboardViewModel

    init(client: SupabaseClient) {
        _model = State(initialValue: GrammarDashboardViewModel(client: client))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.s5) {
                accuracySection
                categoriesSection
                correctionsSection
                runButton
            }
            .padding(.horizontal, Theme.Spacing.s4)
            .padding(.top, Theme.Spacing.s3)
            .padding(.bottom, Theme.Spacing.s12)
        }
        .background(Theme.Color.bg)
        .brandTopWash()
        .navigationTitle("Grammar")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
        .refreshable { await model.load() }
        .task { if model.loadState == .idle { await model.load() } }
    }

    private var accuracySection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("Accuracy")
                .font(.caption.weight(.semibold))
                .tracking(1.5)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Color.fg3)
            HStack(alignment: .center, spacing: Theme.Spacing.s4) {
                ZStack {
                    Circle()
                        .stroke(Theme.Color.bg3, lineWidth: 12)
                        .frame(width: 132, height: 132)
                    Circle()
                        .trim(from: 0, to: trim)
                        .stroke(Theme.Color.brandGradient, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .frame(width: 132, height: 132)
                    VStack(spacing: 2) {
                        Text(label)
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .foregroundStyle(Theme.Color.fg)
                        Text("accuracy")
                            .font(Theme.FontStyle.timestamp)
                            .foregroundStyle(Theme.Color.fg3)
                    }
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("\(model.totalCorrections) corrections")
                        .font(Theme.FontStyle.body.weight(.semibold))
                        .foregroundStyle(Theme.Color.fg)
                    if let updated = model.aggregate?.updated_at {
                        Text("Updated \(relative(updated))")
                            .font(Theme.FontStyle.meta)
                            .foregroundStyle(Theme.Color.fg3)
                    } else {
                        Text("No aggregates yet — tap Run insights")
                            .font(Theme.FontStyle.meta)
                            .foregroundStyle(Theme.Color.fg3)
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }

    @ViewBuilder
    private var categoriesSection: some View {
        let categories = model.topCategories
        if !categories.isEmpty {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Text("Top issues")
                    .font(.caption.weight(.semibold))
                    .tracking(1.5)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Color.fg3)
                FlowingChips(items: categories)
            }
        }
    }

    @ViewBuilder
    private var correctionsSection: some View {
        if model.corrections.isEmpty {
            EmptyStateView(
                systemImage: "checkmark.bubble",
                title: "Nothing flagged yet",
                message: "Send a message in a chat with grammar agent on to start collecting corrections."
            )
            .padding(.vertical, Theme.Spacing.s4)
        } else {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Text("Recent corrections")
                    .font(.caption.weight(.semibold))
                    .tracking(1.5)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Color.fg3)
                ForEach(model.corrections) { row in
                    CorrectionRow(row: row)
                }
            }
        }
    }

    private var runButton: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Button(action: { Task { await model.runInsights() } }) {
                Label {
                    Text(buttonLabel)
                        .font(Theme.FontStyle.body.weight(.semibold))
                        .foregroundStyle(Theme.Color.fgOnBrand)
                } icon: {
                    if model.runState == .running {
                        ProgressView().tint(Theme.Color.fgOnBrand)
                    } else {
                        Image(systemName: "arrow.clockwise")
                            .foregroundStyle(Theme.Color.fgOnBrand)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s3)
                .background(Theme.Color.brandGradient, in: Capsule())
            }
            .buttonStyle(.plain)
            .disabled(model.runState == .running)

            if case .failed(let m) = model.runState {
                Text(m)
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.destructive)
            }
        }
    }

    private var trim: CGFloat {
        guard let accuracy = model.accuracy else { return 0 }
        return CGFloat(min(max(accuracy / 100.0, 0), 1))
    }

    private var label: String {
        if let accuracy = model.accuracy {
            return "\(Int(accuracy))%"
        }
        return "—"
    }

    private var buttonLabel: String {
        switch model.runState {
        case .running: return "Running…"
        case .done:    return "Run insights again"
        default:       return "Run insights now"
        }
    }

    private func relative(_ raw: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        guard let date = f.date(from: raw) ?? plain.date(from: raw) else { return raw }
        let rel = RelativeDateTimeFormatter()
        rel.unitsStyle = .short
        return rel.localizedString(for: date, relativeTo: Date())
    }
}

private struct FlowingChips: View {
    let items: [(name: String, count: Int)]

    var body: some View {
        HStack(spacing: Theme.Spacing.s2) {
            ForEach(items, id: \.name) { item in
                HStack(spacing: 4) {
                    Text(item.name.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(Theme.FontStyle.timestamp.weight(.semibold))
                    Text("\(item.count)")
                        .font(Theme.FontStyle.timestamp)
                        .foregroundStyle(Theme.Color.fg3)
                }
                .foregroundStyle(Theme.Color.fg)
                .padding(.horizontal, Theme.Spacing.s3)
                .padding(.vertical, 6)
                .background(Theme.Color.bg2, in: Capsule())
                .overlay(Capsule().strokeBorder(Theme.Color.brand1.opacity(0.35), lineWidth: 1))
            }
            Spacer(minLength: 0)
        }
    }
}

private struct CorrectionRow: View {
    let row: GrammarCorrection

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let original = row.original_text, !original.isEmpty {
                Text(original)
                    .font(Theme.FontStyle.body)
                    .foregroundStyle(Theme.Color.fg2)
                    .strikethrough(true, color: Theme.Color.destructive.opacity(0.45))
            }
            if let corrected = row.corrected_text, !corrected.isEmpty {
                Text(corrected)
                    .font(Theme.FontStyle.body.weight(.semibold))
                    .foregroundStyle(Theme.Color.fg)
            }
            if let explanation = row.explanation, !explanation.isEmpty {
                Text(explanation)
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg3)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s3)
        .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
    }
}
