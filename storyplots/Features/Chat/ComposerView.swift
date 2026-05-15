import SwiftUI

/// Phase 4 composer skeleton — TextField + send button. The button is
/// disabled until Phase 5 wires `/chat` streaming.
struct ComposerView: View {
    @Binding var draft: String
    let accent: Color
    let isStreaming: Bool
    let onSend: () -> Void
    let onCancel: () -> Void

    var body: some View {
        HStack(alignment: .bottom, spacing: Theme.Spacing.s2) {
            TextField("Message", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .padding(.horizontal, Theme.Spacing.s3)
                .padding(.vertical, Theme.Spacing.s2)
                .background(Theme.Color.bg3, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
                .foregroundStyle(Theme.Color.fg)

            sendButton
        }
        .padding(.horizontal, Theme.Spacing.s3)
        .padding(.vertical, Theme.Spacing.s2)
        .background(.thinMaterial)
    }

    @ViewBuilder
    private var sendButton: some View {
        if isStreaming {
            Button(action: onCancel) {
                Image(systemName: "stop.fill")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.fgOnBrand)
                    .frame(width: 36, height: 36)
                    .background(Theme.Color.destructive, in: Circle())
            }
        } else {
            Button(action: onSend) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.fgOnBrand)
                    .frame(width: 36, height: 36)
                    .background(
                        draft.trimmingCharacters(in: .whitespaces).isEmpty
                            ? AnyShapeStyle(Theme.Color.bg3)
                            : AnyShapeStyle(Theme.Color.brandGradient),
                        in: Circle()
                    )
            }
            .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
        }
    }
}
