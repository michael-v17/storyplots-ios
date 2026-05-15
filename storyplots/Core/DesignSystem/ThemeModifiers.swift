import SwiftUI

extension Text {
    /// Uppercase section label per `seed/design.md` §4.6 (`sectionLabel`).
    func sectionLabel() -> some View {
        self
            .font(Theme.FontStyle.sectionLabel)
            .tracking(1)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Color.fg3)
    }
}

extension View {
    /// Apply a named elevation preset from `Theme.Shadow.Level`.
    func elevation(_ level: Theme.Shadow.Level) -> some View {
        let preset = Theme.Shadow.preset(level)
        return self.shadow(color: preset.color, radius: preset.radius, x: 0, y: preset.y)
    }
}
