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
    let onEdit: () -> Void

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
                    VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                        bubble
                        if !images.isEmpty || imageRequestLoading {
                            MessageImageRail(
                                images: images,
                                isLoading: imageRequestLoading,
                                accent: accent,
                                namespace: imageNamespace,
                                onSelect: onSelectImage
                            )
                        }
                        timestampLabel
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    assistantActionRail
                        .padding(.top, 2)
                } else {
                    Spacer(minLength: Theme.Spacing.s6)
                    VStack(alignment: .trailing, spacing: Theme.Spacing.s1) {
                        bubble
                        timestampLabel
                    }
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
                Haptics.notify(.success)
                onCopy()
            } label: {
                Label("Copy", systemImage: "doc.on.doc")
            }
            if item.role == .assistant {
                Button {
                    Haptics.impact(.medium)
                    onRegenerate()
                } label: {
                    Label("Regenerate", systemImage: "arrow.clockwise")
                }
                Button {
                    Haptics.impact(.medium)
                    onRequestImage()
                } label: {
                    Label("Generate image", systemImage: "photo.badge.plus")
                }
                Button {
                    Haptics.impact(.light)
                    onToggleAudio()
                } label: {
                    Label("Read aloud", systemImage: "speaker.wave.2.fill")
                }
            }
            Button {
                Haptics.impact(.light)
                onEdit()
            } label: {
                Label("Edit & trim", systemImage: "pencil.and.scribble")
            }
            Button {
                Haptics.impact(.light)
                onFork()
            } label: {
                Label("Fork from here", systemImage: "arrow.triangle.branch")
            }
            Button(role: .destructive) {
                Haptics.notify(.warning)
                onDelete()
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    /// Vertical icon-only rail attached to the right edge of an assistant
    /// message — matches PersonaLLM's per-message floating chips (see
    /// base/Seed/PersonaLLM-Reference/04-screens/chat.md §C):
    /// ↻ Regenerate, ⑂ Branch (fork), 🖼 Generate image. Audio playback
    /// moved to the long-press context menu to keep the rail to three.
    @ViewBuilder
    private var assistantActionRail: some View {
        VStack(spacing: Theme.Spacing.s2) {
            railChip(
                systemImage: "arrow.clockwise",
                isActive: false,
                action: onRegenerate,
                accessibilityLabel: "Regenerate"
            )
            railChip(
                systemImage: "arrow.triangle.branch",
                isActive: false,
                action: onFork,
                accessibilityLabel: "Fork from here"
            )
            railChip(
                systemImage: imageRequestLoading ? "hourglass" : "photo.badge.plus",
                isActive: imageRequestLoading,
                action: onRequestImage,
                accessibilityLabel: images.isEmpty ? "Generate image" : "Add image"
            )
        }
    }

    private var audioChipSymbol: String {
        switch audioState {
        case .idle, .error:    return "speaker.wave.2"
        case .loading:         return "hourglass"
        case .playing:         return "pause.fill"
        case .paused:          return "play.fill"
        }
    }

    private var audioAccessibilityLabel: String {
        switch audioState {
        case .idle, .error:    return "Read aloud"
        case .loading:         return "Loading audio"
        case .playing:         return "Pause"
        case .paused:          return "Play"
        }
    }

    private func railChip(
        systemImage: String,
        isActive: Bool,
        action: @escaping () -> Void,
        accessibilityLabel: String
    ) -> some View {
        Button {
            Haptics.impact(.light)
            action()
        } label: {
            Image(systemName: systemImage)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(isActive ? Theme.Color.fgOnBrand : accent)
                .frame(width: 40, height: 40)
                .background(
                    Circle().fill(accent.opacity(isActive ? 0.85 : 0.14))
                )
                .overlay(
                    Circle().stroke(accent.opacity(isActive ? 0 : 0.45), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }

    private var bubble: some View {
        let isAssistant = item.role == .assistant
        return VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            renderedBody
                .font(.body)
                .foregroundStyle(isAssistant ? Theme.Color.fg : Theme.Color.fgOnBrand)
                .frame(maxWidth: bubbleMaxWidth, alignment: .leading)
        }
        .padding(Theme.Spacing.s3)
        .background(
            // PersonaLLM: assistant bubble has a subtly darker fill than the
            // surrounding wash so text reads as a delineated panel (not
            // floating). bg1 is one step darker than the host bg; the accent
            // stroke still carries identity. User pill stays accent-filled.
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .fill(isAssistant ? AnyShapeStyle(Theme.Color.bg1) : AnyShapeStyle(accent))
        )
        .overlay(alignment: .topLeading) {
            if isAssistant, let (current, total) = variantPagination, total > 1 {
                variantPill(current: current, total: total)
                    .padding(.leading, Theme.Spacing.s2)
                    .offset(y: -10)
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .stroke(isAssistant ? accent.opacity(0.35) : Color.clear, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func variantPill(current: Int, total: Int) -> some View {
        HStack(spacing: 6) {
            Button {
                Haptics.selection()
                let target = (current - 1 + total) % total
                onSelectVariant(target)
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 10, weight: .semibold))
            }
            .buttonStyle(.plain)
            .foregroundStyle(accent)
            Text("\(current + 1)/\(total)")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Theme.Color.fg)
            Button {
                Haptics.selection()
                let target = (current + 1) % total
                onSelectVariant(target)
            } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
            }
            .buttonStyle(.plain)
            .foregroundStyle(accent)
        }
        .padding(.horizontal, Theme.Spacing.s2)
        .padding(.vertical, 3)
        .background(Capsule().fill(Theme.Color.bg3))
        .overlay(Capsule().strokeBorder(accent.opacity(0.45), lineWidth: 1))
    }

    private var bubbleMaxWidth: CGFloat? {
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

    /// `HH:mm` clock label beneath every bubble, matching PersonaLLM's per-
    /// message anatomy. Aligned via the surrounding VStack (leading for
    /// assistant, trailing for user).
    @ViewBuilder
    private var timestampLabel: some View {
        if let formatted = Self.formattedClock(from: item.createdAt) {
            Text(formatted)
                .font(Theme.FontStyle.timestamp)
                .foregroundStyle(Theme.Color.fg4)
                .padding(.horizontal, Theme.Spacing.s1)
        }
    }

    private static let iso8601Parser: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let iso8601ParserNoFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let clockFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        f.locale = Locale.current
        f.timeZone = TimeZone.current
        return f
    }()

    private static func formattedClock(from iso: String) -> String? {
        guard !iso.isEmpty else { return nil }
        let date = iso8601Parser.date(from: iso) ?? iso8601ParserNoFraction.date(from: iso)
        return date.map(clockFormatter.string(from:))
    }
}
