import SwiftUI

/// Phase 4 composer skeleton — TextField + send button. The button is
/// disabled until Phase 5 wires `/chat` streaming.
struct ComposerView: View {
    @Binding var draft: String
    let accent: Color
    let isStreaming: Bool
    let placeholderName: String?
    /// Optional binding into the chat-panels enum. When non-nil the composer
    /// renders the `⋯` PersonaLLM-style chat-controls launcher on the left
    /// (panels = grammar, memory, lorebook, author's note, controls, gen
    /// overrides). When nil the left chip is omitted.
    let chatPanel: Binding<ChatPanel?>?
    let onSend: () -> Void
    let onCancel: () -> Void

    @FocusState private var isFocused: Bool
    @State private var sendPulse: Bool = false

    init(draft: Binding<String>,
         accent: Color,
         isStreaming: Bool,
         placeholderName: String? = nil,
         chatPanel: Binding<ChatPanel?>? = nil,
         onSend: @escaping () -> Void,
         onCancel: @escaping () -> Void) {
        self._draft = draft
        self.accent = accent
        self.isStreaming = isStreaming
        self.placeholderName = placeholderName
        self.chatPanel = chatPanel
        self.onSend = onSend
        self.onCancel = onCancel
    }

    private var placeholder: String {
        guard let name = placeholderName?.trimmingCharacters(in: .whitespaces),
              !name.isEmpty else {
            return "Message"
        }
        return "Message \(name)…"
    }

    var body: some View {
        HStack(alignment: .center, spacing: Theme.Spacing.s2) {
            if let chatPanel {
                ChatPanelsMenu(presented: chatPanel, accent: accent)
                    .frame(width: 40, height: 40)
            }

            TextField(placeholder, text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .focused($isFocused)
                .padding(.horizontal, Theme.Spacing.s4)
                .padding(.vertical, Theme.Spacing.s3)
                .background(Theme.Color.bg3, in: Capsule())
                .overlay(
                    Capsule()
                        .strokeBorder(
                            isFocused ? accent.opacity(0.55) : accent.opacity(0.22),
                            lineWidth: isFocused ? 1.5 : 1
                        )
                )
                .foregroundStyle(Theme.Color.fg)
                .animation(Theme.Motion.snappy, value: isFocused)

            rightActionButton
        }
        .padding(.horizontal, Theme.Spacing.s3)
        .padding(.vertical, Theme.Spacing.s2)
        .background(.thinMaterial)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.Color.borderSoft.opacity(0.45))
                .frame(height: 0.5)
        }
    }

    @ViewBuilder
    private var rightActionButton: some View {
        if isStreaming {
            Button {
                Haptics.impact(.heavy)
                onCancel()
            } label: {
                Image(systemName: "stop.fill")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.fgOnBrand)
                    .frame(width: 40, height: 40)
                    .background(Theme.Color.destructive, in: Circle())
            }
        } else if canSend {
            Button {
                Haptics.impact(.medium)
                withAnimation(Theme.Motion.pop) { sendPulse.toggle() }
                onSend()
            } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.Color.fgOnBrand)
                    .frame(width: 40, height: 40)
                    .background(
                        LinearGradient(
                            colors: [accent, accent.opacity(0.7)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        in: Circle()
                    )
                    .shadow(color: accent.opacity(0.45), radius: 6, y: 2)
                    .scaleEffect(sendPulse ? 0.85 : 1.0)
                    .animation(Theme.Motion.pop, value: sendPulse)
            }
        } else {
            // PersonaLLM shows a mic chip in this slot — voice dictation isn't
            // wired in iOS yet, so the icon is visually present (matches the
            // composer rhythm) but only logs a haptic for now.
            Button {
                Haptics.impact(.light)
            } label: {
                Image(systemName: "mic.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(accent)
                    .frame(width: 40, height: 40)
                    .background(accent.opacity(0.14), in: Circle())
                    .overlay(Circle().stroke(accent.opacity(0.4), lineWidth: 1))
            }
            .accessibilityLabel("Voice input")
        }
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespaces).isEmpty
    }
}

/// PersonaLLM-style `⋯` chat-controls launcher for the composer left chip.
/// Renders as a Menu so iOS draws its native popover, themed in accent.
struct ChatPanelsMenu: View {
    @Binding var presented: ChatPanel?
    let accent: Color

    var body: some View {
        Menu {
            ForEach(ChatPanel.allCases) { panel in
                Button {
                    presented = panel
                } label: {
                    Label(panel.title, systemImage: panel.systemImage)
                }
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(accent)
                .frame(width: 40, height: 40)
                .background(accent.opacity(0.14), in: Circle())
                .overlay(Circle().stroke(accent.opacity(0.4), lineWidth: 1))
        }
        .accessibilityLabel("Chat controls")
    }
}
