import SwiftUI

/// Claude-style glass composer: text field stacked above a button row,
/// the whole thing wrapped in a `.regularMaterial` card with a soft
/// accent-lit border. Floats above the bottom safe area instead of
/// docking edge-to-edge. Per creator feedback to match the modern
/// Claude iOS chat input.
struct ComposerView: View {
    @Binding var draft: String
    let accent: Color
    let isStreaming: Bool
    let placeholderName: String?
    /// Optional binding into the chat-panels enum. When non-nil the composer
    /// renders the `⋯` PersonaLLM-style chat-controls launcher in the bottom
    /// row (panels = grammar, memory, lorebook, author's note, controls, gen
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
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            TextField(placeholder, text: $draft, axis: .vertical)
                .lineLimit(1...6)
                .focused($isFocused)
                .font(.body)
                .foregroundStyle(Theme.Color.fg)
                .tint(accent)
                .padding(.horizontal, Theme.Spacing.s3 + 2)
                .padding(.top, Theme.Spacing.s3 + 2)

            HStack(spacing: Theme.Spacing.s2) {
                if let chatPanel {
                    ChatPanelsMenu(presented: chatPanel, accent: accent)
                }
                Spacer(minLength: 0)
                rightActionButton
            }
            .padding(.horizontal, Theme.Spacing.s2)
            .padding(.bottom, Theme.Spacing.s2)
        }
        .background {
            // Real glass: ultraThinMaterial sees through to the scroll
            // content behind (the mainStack ZStack overlays the composer
            // on top of the scroll). A soft top-edge highlight gradient
            // adds the glossy specular feel that distinguishes
            // liquid-glass from a plain blur.
            ZStack {
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .fill(.ultraThinMaterial)
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.08),
                                Color.white.opacity(0.0)
                            ],
                            startPoint: .top,
                            endPoint: .center
                        )
                    )
            }
        }
        .overlay {
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .strokeBorder(
                    isFocused ? accent.opacity(0.55) : Color.white.opacity(0.18),
                    lineWidth: isFocused ? 1.25 : 0.75
                )
        }
        .shadow(color: Color.black.opacity(0.45), radius: 22, y: 8)
        .animation(Theme.Motion.snappy, value: isFocused)
        // Claude-style: composer hugs the screen edges with only a thin
        // gutter, sitting just above the safe-area inset so it feels
        // anchored to the bottom rather than floating in space.
        .padding(.horizontal, Theme.Spacing.s2)
        .padding(.bottom, 4)
    }

    @ViewBuilder
    private var rightActionButton: some View {
        if isStreaming {
            Button {
                Haptics.impact(.heavy)
                onCancel()
            } label: {
                Image(systemName: "stop.fill")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.fgOnBrand)
                    .frame(width: 36, height: 36)
                    .background(Theme.Color.destructive, in: Circle())
            }
            .accessibilityLabel("Stop")
        } else if canSend {
            Button {
                Haptics.impact(.medium)
                withAnimation(Theme.Motion.pop) { sendPulse.toggle() }
                onSend()
            } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.fgOnBrand)
                    .frame(width: 36, height: 36)
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
            .accessibilityLabel("Send")
        } else {
            // PersonaLLM shows a mic chip in this slot — voice dictation isn't
            // wired in iOS yet, so the icon is visually present (matches the
            // composer rhythm) but only logs a haptic for now.
            Button {
                Haptics.impact(.light)
            } label: {
                Image(systemName: "mic.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(accent)
                    .frame(width: 36, height: 36)
                    .background(accent.opacity(0.18), in: Circle())
                    .overlay(Circle().stroke(accent.opacity(0.45), lineWidth: 0.75))
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
                .frame(width: 36, height: 36)
                .background(accent.opacity(0.18), in: Circle())
                .overlay(Circle().stroke(accent.opacity(0.45), lineWidth: 0.75))
        }
        .accessibilityLabel("Chat controls")
    }
}
