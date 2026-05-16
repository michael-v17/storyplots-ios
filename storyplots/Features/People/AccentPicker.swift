import SwiftUI

/// Grid of the 16 accent presets from `seed/design.md` §3.6.
/// Tap a swatch to set the bound hex string.
struct AccentPicker: View {
    @Binding var hex: String

    private let presets: [(hex: String, name: String, color: Color)] = [
        ("#8B5CF6", "Violet",  Theme.Color.AccentPreset.violet),
        ("#6366F1", "Indigo",  Theme.Color.AccentPreset.indigo),
        ("#3B82F6", "Blue",    Theme.Color.AccentPreset.blue),
        ("#0EA5E9", "Sky",     Theme.Color.AccentPreset.sky),
        ("#14B8A6", "Teal",    Theme.Color.AccentPreset.teal),
        ("#2ECC71", "Green",   Theme.Color.AccentPreset.green),
        ("#84CC16", "Lime",    Theme.Color.AccentPreset.lime),
        ("#F59E0B", "Amber",   Theme.Color.AccentPreset.amber),
        ("#C9A34C", "Bronze",  Theme.Color.AccentPreset.bronze),
        ("#F97316", "Orange",  Theme.Color.AccentPreset.orange),
        ("#E04747", "Red",     Theme.Color.AccentPreset.red),
        ("#EC4899", "Pink",    Theme.Color.AccentPreset.pink),
        ("#F43F5E", "Rose",    Theme.Color.AccentPreset.rose),
        ("#D946EF", "Fuchsia", Theme.Color.AccentPreset.fuchsia),
        ("#94A3B8", "Slate",   Theme.Color.AccentPreset.slate),
        ("#A8A29E", "Stone",   Theme.Color.AccentPreset.stone)
    ]

    private var selectedIndex: Int? {
        let normalized = hex.uppercased()
        return presets.firstIndex { $0.hex.uppercased() == normalized }
    }

    var body: some View {
        VStack(spacing: Theme.Spacing.s3) {
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: Theme.Spacing.s2), count: 4),
                spacing: Theme.Spacing.s3
            ) {
                ForEach(Array(presets.enumerated()), id: \.element.hex) { _, entry in
                    Button {
                        Haptics.selection()
                        hex = entry.hex
                    } label: {
                        ZStack {
                            Circle()
                                .fill(entry.color)
                                .frame(height: 44)
                                .overlay(
                                    Circle()
                                        .strokeBorder(Theme.Color.fg.opacity(0.08), lineWidth: 0.5)
                                )
                            if hex.uppercased() == entry.hex.uppercased() {
                                Circle()
                                    .strokeBorder(Theme.Color.fg, lineWidth: 2)
                                    .frame(height: 44)
                                Image(systemName: "checkmark")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(Theme.Color.fg)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(entry.name)
                }
            }

            if let idx = selectedIndex {
                Text(presets[idx].name)
                    .font(Theme.FontStyle.timestamp.weight(.semibold))
                    .foregroundStyle(Theme.Color.fg2)
                    .transition(.opacity)
            } else {
                Text("Custom")
                    .font(Theme.FontStyle.timestamp.weight(.semibold))
                    .foregroundStyle(Theme.Color.fg3)
            }
        }
        .animation(Theme.Motion.snappy, value: hex)
    }
}
