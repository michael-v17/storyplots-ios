import SwiftUI

/// Grid of the 16 accent presets from `seed/design.md` §3.6.
/// Tap a swatch to set the bound hex string.
struct AccentPicker: View {
    @Binding var hex: String

    private let presets: [(String, Color)] = [
        ("#8B5CF6", Theme.Color.AccentPreset.violet),
        ("#6366F1", Theme.Color.AccentPreset.indigo),
        ("#3B82F6", Theme.Color.AccentPreset.blue),
        ("#0EA5E9", Theme.Color.AccentPreset.sky),
        ("#14B8A6", Theme.Color.AccentPreset.teal),
        ("#2ECC71", Theme.Color.AccentPreset.green),
        ("#84CC16", Theme.Color.AccentPreset.lime),
        ("#F59E0B", Theme.Color.AccentPreset.amber),
        ("#C9A34C", Theme.Color.AccentPreset.bronze),
        ("#F97316", Theme.Color.AccentPreset.orange),
        ("#E04747", Theme.Color.AccentPreset.red),
        ("#EC4899", Theme.Color.AccentPreset.pink),
        ("#F43F5E", Theme.Color.AccentPreset.rose),
        ("#D946EF", Theme.Color.AccentPreset.fuchsia),
        ("#94A3B8", Theme.Color.AccentPreset.slate),
        ("#A8A29E", Theme.Color.AccentPreset.stone)
    ]

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Theme.Spacing.s2), count: 4),
                  spacing: Theme.Spacing.s2) {
            ForEach(presets, id: \.0) { entry in
                Button {
                    hex = entry.0
                } label: {
                    Circle()
                        .fill(entry.1)
                        .frame(height: 40)
                        .overlay(
                            Circle()
                                .stroke(hex.uppercased() == entry.0.uppercased() ? Theme.Color.fg : .clear, lineWidth: 2)
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }
}
