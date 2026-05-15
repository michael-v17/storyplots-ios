import SwiftUI

/// Single chat bubble. Side / background / border vary by role per
/// `seed/ux.md` §5.2 (user right-aligned with brand2 tint, character
/// left-aligned with bg2 + accent border).
struct MessageBubbleView: View {
    let item: MessageItem
    let accent: Color
    let characterName: String
    let avatarRef: String?
    /// `(currentIndex, total)` when the assistant message has >1 variant.
    let variantPagination: (Int, Int)?
    /// Images attached to this message (assistant-only). Empty when none.
    let images: [GeneratedImage]
    /// Loading state of the image-generation request for this message.
    let imageRequestLoading: Bool
    /// TTS audio state for this message (idle/loading/playing/paused/error).
    let audioState: MessageAudioState
    /// Namespace for `matchedGeometryEffect("img-<id>")` shared with `ImageViewer`.
    let imageNamespace: Namespace.ID
    let onCopy: () -> Void
    let onRegenerate: () -> Void
    let onDelete: () -> Void
    let onFork: () -> Void
    let onSelectVariant: (Int) -> Void
    let onRequestImage: () -> Void
    let onSelectImage: (GeneratedImage) -> Void
    let onToggleAudio: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: Theme.Spacing.s2) {
                if item.role == .assistant {
                    AvatarView(
                        avatarRef: avatarRef,
                        name: characterName,
                        accent: accent,
                        size: 28,
                        ringWidth: 1
                    )
                    VStack(alignment: .leading, spacing: 0) {
                        bubble
                        if !images.isEmpty {
                            MessageImageRail(
                                images: images,
                                accent: accent,
                                namespace: imageNamespace,
                                onSelect: onSelectImage
                            )
                        }
                        assistantActionRow
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    Spacer(minLength: Theme.Spacing.s6)
                    bubble
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
            }
            if let (current, total) = variantPagination, item.role == .assistant {
                VariantDotsIndicator(
                    current: current,
                    total: total,
                    accent: accent,
                    onSelect: onSelectVariant
                )
            }
        }
        .padding(.horizontal, Theme.Spacing.s3)
        .contextMenu {
            Button {
                onCopy()
            } label: {
                Label("Copy", systemImage: "doc.on.doc")
            }
            if item.role == .assistant {
                Button {
                    onRegenerate()
                } label: {
                    Label("Regenerate", systemImage: "arrow.clockwise")
                }
                Button {
                    onRequestImage()
                } label: {
                    Label("Generate image", systemImage: "photo.badge.plus")
                }
                Button {
                    onToggleAudio()
                } label: {
                    Label("Read aloud", systemImage: "speaker.wave.2.fill")
                }
            }
            Button {
                onFork()
            } label: {
                Label("Fork from here", systemImage: "arrow.triangle.branch")
            }
            Button(role: .destructive) {
                onDelete()
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    /// Floating action chips below an assistant bubble — image + audio.
    @ViewBuilder
    private var assistantActionRow: some View {
        HStack(spacing: Theme.Spacing.s2) {
            actionChip(
                systemImage: imageRequestLoading ? "hourglass" : "photo.badge.plus",
                label: images.isEmpty ? "Image" : "Add image",
                isActive: imageRequestLoading,
                action: onRequestImage
            )
            actionChip(
                systemImage: audioChipSymbol,
                label: audioChipLabel,
                isActive: audioState == .playing,
                action: onToggleAudio
            )
            Spacer(minLength: 0)
        }
        .padding(.top, Theme.Spacing.s2)
    }

    private var audioChipSymbol: String {
        switch audioState {
        case .idle, .error:    return "speaker.wave.2"
        case .loading:         return "hourglass"
        case .playing:         return "pause.fill"
        case .paused:          return "play.fill"
        }
    }

    private var audioChipLabel: String {
        switch audioState {
        case .idle, .error:    return "Read aloud"
        case .loading:         return "Loading"
        case .playing:         return "Pause"
        case .paused:          return "Play"
        }
    }

    private func actionChip(systemImage: String, label: String, isActive: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s1) {
                Image(systemName: systemImage)
                    .imageScale(.small)
                Text(label)
                    .font(Theme.FontStyle.timestamp)
            }
            .padding(.horizontal, Theme.Spacing.s3)
            .padding(.vertical, Theme.Spacing.s2)
            .foregroundStyle(isActive ? accent : Theme.Color.fg1)
            .background(Theme.Material.chip, in: Capsule())
            .overlay(
                Capsule().stroke(isActive ? accent.opacity(0.6) : Theme.Color.borderSoft, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var bubble: some View {
        let isAssistant = item.role == .assistant
        return VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            renderedBody
                .font(.body)
                .foregroundStyle(Theme.Color.fg)
                .frame(maxWidth: bubbleMaxWidth, alignment: .leading)
        }
        .padding(Theme.Spacing.s3)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .fill(isAssistant ? Theme.Color.bg2 : Theme.Color.bg3)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .stroke(isAssistant ? accent.opacity(0.45) : Color.clear, lineWidth: 1)
        )
    }

    private var bubbleMaxWidth: CGFloat? {
        // ~80% width — actual constraint comes from the parent HStack + Spacer.
        nil
    }

    /// Try Markdown first; fall back to plain Text per `seed/tech-stack.md` §3 Q3.3.
    @ViewBuilder
    private var renderedBody: some View {
        if let attributed = try? AttributedString(markdown: item.body, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)) {
            Text(attributed)
        } else {
            Text(item.body)
        }
    }
}
