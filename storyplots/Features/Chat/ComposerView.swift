import SwiftUI

/// Phase 4 composer skeleton — TextField + send button. The button is
/// disabled until Phase 5 wires `/chat` streaming.
struct ComposerView: View {
    @Binding var draft: String
    let accent: Color
    let isStreaming: Bool
    let onSend: () -> Void
    let onCancel: () -> Void

    @FocusState private var isFocused: Bool
    @State private var sendPulse: Bool = false

    var body: some View {
        HStack(alignment: .center, spacing: Theme.Spacing.s2) {
            TextField("Message", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .focused($isFocused)
                .padding(.horizontal, Theme.Spacing.s3)
                .padding(.vertical, Theme.Spacing.s2 + 2)
                .background(Theme.Color.bg3, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.card)
                        .strokeBorder(
                            isFocused ? accent.opacity(0.55) : accent.opacity(0.22),
                            lineWidth: isFocused ? 1.5 : 1
                        )
                )
                .foregroundStyle(Theme.Color.fg)
                .animation(Theme.Motion.snappy, value: isFocused)

            sendButton
        }
        .padding(.horizontal, Theme.Spacing.s3)
        .padding(.vertical, Theme.Spacing.s2)
        .background(.thinMaterial)
        // Thin hairline above the composer lifts it off the messages.
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.Color.borderSoft.opacity(0.45))
                .frame(height: 0.5)
        }
    }

    @ViewBuilder
    private var sendButton: some View {
        if isStreaming {
            Button {
                Haptics.impact(.heavy)
                onCancel()
            } label: {
                Image(systemName: "stop.fill")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.fgOnBrand)
                    .frame(width: 36, height: 36)
                    .background(Theme.Color.destructive, in: Circle())
            }
        } else {
            Button {
                Haptics.impact(.medium)
                withAnimation(Theme.Motion.pop) { sendPulse.toggle() }
                onSend()
            } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(canSend ? Theme.Color.fgOnBrand : accent.opacity(0.55))
                    .frame(width: 36, height: 36)
                    .background(
                        canSend
                            ? AnyShapeStyle(
                                LinearGradient(
                                    colors: [accent, accent.opacity(0.7)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            : AnyShapeStyle(Theme.Color.bg3),
                        in: Circle()
                    )
                    .overlay(
                        Circle().stroke(accent.opacity(canSend ? 0 : 0.4), lineWidth: 1)
                    )
                    .shadow(color: canSend ? accent.opacity(0.45) : .clear, radius: 6, y: 2)
                    .scaleEffect(sendPulse ? 0.85 : 1.0)
                    .animation(Theme.Motion.pop, value: sendPulse)
            }
            .disabled(!canSend)
        }
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespaces).isEmpty
    }
}
