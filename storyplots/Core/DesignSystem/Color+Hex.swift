import SwiftUI

extension SwiftUI.Color {
    /// Convenience initializer that builds an sRGB `Color` from a 24-bit RGB hex.
    /// Always route call sites through `Theme.Color` — never embed hex literals in views.
    init(hex: UInt32, alpha: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >> 8) & 0xFF) / 255.0
        let b = Double(hex & 0xFF) / 255.0
        self.init(red: r, green: g, blue: b, opacity: alpha)
    }
}
