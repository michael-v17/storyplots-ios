import SwiftUI

/// Compact dots indicator under an assistant bubble when the message has
/// more than one variant. Tapping a dot jumps to that variant.
struct VariantDotsIndicator: View {
    let current: Int
    let total: Int
    let accent: Color
    let onSelect: (Int) -> Void

    var body: some View {
        HStack(spacing: Theme.Spacing.s1) {
            ForEach(0..<total, id: \.self) { idx in
                Button {
                    Haptics.selection()
                    onSelect(idx)
                } label: {
                    Circle()
                        .fill(idx == current ? accent : Theme.Color.fg4.opacity(0.5))
                        .frame(width: 6, height: 6)
                }
                .buttonStyle(.plain)
            }
            Text("\(current + 1) of \(total)")
                .font(Theme.FontStyle.timestamp)
                .foregroundStyle(Theme.Color.fg4)
                .padding(.leading, Theme.Spacing.s1)
        }
        .padding(.leading, 36) // align with bubble after the avatar
        .padding(.top, 2)
    }
}
