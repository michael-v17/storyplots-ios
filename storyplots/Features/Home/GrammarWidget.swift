import SwiftUI

struct GrammarWidget: View {
    let accuracy: Double?
    let masterEnabled: Bool
    let onToggle: () -> Void
    let onOpen: () -> Void

    var body: some View {
        Button(action: {
            Haptics.impact(.light)
            onOpen()
        }) {
            VStack(spacing: Theme.Spacing.s3) {
                HStack(alignment: .center, spacing: Theme.Spacing.s4) {
                    gauge
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Grammar accuracy")
                            .font(Theme.FontStyle.body.weight(.semibold))
                            .foregroundStyle(Theme.Color.fg)
                        Text(subtitle)
                            .font(Theme.FontStyle.meta)
                            .foregroundStyle(Theme.Color.fg3)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.fg4)
                }

                HStack {
                    Text("Grammar agent")
                        .font(Theme.FontStyle.timestamp)
                        .foregroundStyle(Theme.Color.fg3)
                    Spacer(minLength: 0)
                    Toggle("", isOn: Binding(
                        get: { masterEnabled },
                        set: { _ in
                            Haptics.selection()
                            onToggle()
                        }
                    ))
                    .labelsHidden()
                    .tint(Theme.Color.brand1)
                }
            }
            .padding(Theme.Spacing.s4)
            .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.card)
                    .strokeBorder(Theme.Color.borderSoft, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var subtitle: String {
        if let accuracy {
            return "Tap to open the dashboard · \(Int(accuracy))%"
        }
        return "No data yet · tap to set up"
    }

    private var gauge: some View {
        ZStack {
            Circle()
                .stroke(Theme.Color.bg3, lineWidth: 6)
                .frame(width: 56, height: 56)
            Circle()
                .trim(from: 0, to: trim)
                .stroke(Theme.Color.brandGradient, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .frame(width: 56, height: 56)
            Text(label)
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(Theme.Color.fg)
        }
    }

    private var trim: CGFloat {
        guard let accuracy else { return 0 }
        return CGFloat(min(max(accuracy / 100.0, 0), 1))
    }

    private var label: String {
        guard let accuracy else { return "—" }
        return "\(Int(accuracy))%"
    }
}
