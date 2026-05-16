import SwiftUI

/// Fullscreen image viewer with pinch zoom + drag-to-dismiss.
///
/// Triggered from a thumbnail in the chat — the calling view should wrap the
/// `ImageViewer` invocation with `matchedGeometryEffect(id: "img-\(image.id)")`
/// on the thumbnail side so the fly-in is shared geometry.
struct ImageViewer: View {
    let image: GeneratedImage
    let namespace: Namespace.ID
    let onDismiss: () -> Void
    /// Optional regenerate hook — only chat surfaces (where we have a
    /// `message_id`) pass a non-nil callback. Gallery leaves it nil.
    var onRegenerate: (() -> Void)? = nil
    /// Optional delete hook — both Gallery and Chat pass one.
    var onDelete: (() -> Void)? = nil

    @State private var displayURL: URL?
    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero
    @State private var dragOffset: CGSize = .zero
    @State private var promptExpanded: Bool = false
    @State private var showDeleteConfirm: Bool = false

    var body: some View {
        ZStack {
            // Bottom-ascending scrim: clear at the very top (so the host
            // chat's nav glass keeps reading through) and progressively
            // darker toward the bottom where the prompt + action bar live.
            LinearGradient(
                stops: [
                    .init(color: Color.clear,                        location: 0.0),
                    .init(color: Theme.Color.bg.opacity(0.55),       location: 0.32),
                    .init(color: Theme.Color.bg.opacity(0.92),       location: 0.72),
                    .init(color: Theme.Color.bg.opacity(0.96),       location: 1.0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            .onTapGesture { dismiss() }

            content
                .matchedGeometryEffect(id: "img-\(image.id)", in: namespace)
                .scaleEffect(scale)
                .offset(x: offset.width + dragOffset.width,
                        y: offset.height + dragOffset.height)
                .gesture(
                    SimultaneousGesture(
                        MagnifyGesture()
                            .onChanged { value in
                                scale = max(1.0, min(lastScale * value.magnification, 5.0))
                            }
                            .onEnded { _ in
                                lastScale = scale
                                if scale < 1.05 { resetZoom() }
                            },
                        DragGesture()
                            .onChanged { value in
                                if scale > 1.01 {
                                    offset = CGSize(
                                        width: lastOffset.width + value.translation.width,
                                        height: lastOffset.height + value.translation.height
                                    )
                                } else {
                                    dragOffset = value.translation
                                }
                            }
                            .onEnded { value in
                                if scale > 1.01 {
                                    lastOffset = offset
                                } else if abs(value.translation.height) > 120 {
                                    dismiss()
                                } else {
                                    withAnimation(Theme.Motion.snappy) { dragOffset = .zero }
                                }
                            }
                    )
                )
                .onTapGesture(count: 2) {
                    withAnimation(Theme.Motion.snappy) {
                        if scale > 1.05 { resetZoom() } else { scale = 2.5; lastScale = 2.5 }
                    }
                }

            VStack {
                topBar
                Spacer()
                promptCard
                actionBar
            }
        }
        .task { await loadURL() }
        .confirmationDialog("Delete this image?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Haptics.notify(.warning)
                onDelete?()
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently removes the generated image.")
        }
    }

    // MARK: - Chrome

    private var topBar: some View {
        HStack(alignment: .center) {
            chipButton(systemImage: "xmark", action: dismiss)
                .accessibilityLabel("Close")
            Spacer()
            if let dateLabel {
                Text(dateLabel)
                    .font(Theme.FontStyle.timestamp.weight(.semibold))
                    .foregroundStyle(Theme.Color.fg1)
                    .padding(.horizontal, Theme.Spacing.s3)
                    .padding(.vertical, Theme.Spacing.s2)
                    .background(.thinMaterial, in: Capsule())
            }
            Spacer()
            // Reserved chip slot keeps the title pill centered (favorite goes here later).
            Color.clear.frame(width: 36, height: 36)
        }
        .padding(.horizontal, Theme.Spacing.s4)
        .padding(.top, Theme.Spacing.s5)
    }

    @ViewBuilder
    private var promptCard: some View {
        if let prompt = image.refined_prompt ?? image.prompt, !prompt.isEmpty {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                HStack {
                    Text("PROMPT")
                        .font(Theme.FontStyle.sectionLabel)
                        .foregroundStyle(Theme.Color.fg3)
                    if let dim = image.dimensions {
                        Text("· \(dim.w, format: .number.grouping(.never))×\(dim.h, format: .number.grouping(.never))")
                            .font(Theme.FontStyle.timestamp.monospacedDigit())
                            .foregroundStyle(Theme.Color.fg3)
                    }
                    Spacer(minLength: 0)
                    Button {
                        withAnimation(Theme.Motion.snappy) { promptExpanded.toggle() }
                    } label: {
                        Image(systemName: promptExpanded ? "chevron.down" : "chevron.up")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.Color.fg2)
                            .frame(width: 24, height: 24)
                    }
                    .buttonStyle(.plain)
                }
                Text(prompt)
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg1)
                    .lineLimit(promptExpanded ? nil : 1)
                    .multilineTextAlignment(.leading)
            }
            .padding(Theme.Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
            .padding(.horizontal, Theme.Spacing.s4)
        }
    }

    private var actionBar: some View {
        HStack(spacing: Theme.Spacing.s2) {
            if let displayURL {
                ShareLink(item: displayURL) {
                    actionLabel("Share", systemImage: "square.and.arrow.up", role: .primary)
                }
                .buttonStyle(.plain)
            }
            if let onRegenerate {
                Button {
                    Haptics.impact(.medium)
                    onRegenerate()
                    dismiss()
                } label: {
                    actionLabel("Regenerate", systemImage: "arrow.clockwise", role: .primary)
                }
                .buttonStyle(.plain)
            }
            if onDelete != nil {
                Button(role: .destructive) {
                    showDeleteConfirm = true
                } label: {
                    actionLabel("Delete", systemImage: "trash", role: .destructive)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(Theme.Spacing.s2)
        .background(.thinMaterial, in: Capsule())
        .overlay(Capsule().stroke(Theme.Color.borderSoft, lineWidth: 0.5))
        .padding(.bottom, Theme.Spacing.s5)
    }

    private enum ActionRole { case primary, destructive }

    @ViewBuilder
    private func actionLabel(_ title: String, systemImage: String, role: ActionRole) -> some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 14, weight: .semibold))
            Text(title)
                .font(Theme.FontStyle.timestamp.weight(.semibold))
        }
        .foregroundStyle(role == .destructive ? Theme.Color.destructive : Theme.Color.brand1)
        .padding(.horizontal, Theme.Spacing.s3)
        .padding(.vertical, Theme.Spacing.s2)
        .frame(maxWidth: .infinity)
        .background(
            (role == .destructive ? Theme.Color.destructive : Theme.Color.brand1).opacity(0.12),
            in: Capsule()
        )
    }

    private func chipButton(systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.fg)
                .frame(width: 36, height: 36)
                .background(.thinMaterial, in: Circle())
        }
        .buttonStyle(.plain)
    }

    private var dateLabel: String? {
        guard let raw = image.created_at else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let basic = ISO8601DateFormatter()
        basic.formatOptions = [.withInternetDateTime]
        guard let date = fractional.date(from: raw) ?? basic.date(from: raw) else { return nil }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    @ViewBuilder
    private var content: some View {
        if let displayURL {
            AsyncImage(url: displayURL) { phase in
                switch phase {
                case .success(let img):
                    img.resizable().scaledToFit()
                case .failure:
                    failureView
                case .empty:
                    ProgressView().tint(.white)
                @unknown default:
                    failureView
                }
            }
        } else {
            ProgressView().tint(.white)
        }
    }

    private var failureView: some View {
        VStack(spacing: Theme.Spacing.s2) {
            Image(systemName: "photo.badge.exclamationmark")
                .font(.system(size: 32))
                .foregroundStyle(Theme.Color.fg3)
            Text("Couldn't load image")
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.fg2)
        }
    }

    private func loadURL() async {
        displayURL = await SupabaseStorageHelper.shared.displayURL(
            engine: image.engine,
            externalURL: image.external_url,
            storageRef: image.storage_ref
        )
    }

    private func resetZoom() {
        scale = 1.0
        lastScale = 1.0
        offset = .zero
        lastOffset = .zero
        dragOffset = .zero
    }

    private func dismiss() {
        withAnimation(Theme.Motion.smooth) { onDismiss() }
    }
}
