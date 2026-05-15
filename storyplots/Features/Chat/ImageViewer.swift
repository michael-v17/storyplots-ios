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

    @State private var displayURL: URL?
    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero
    @State private var dragOffset: CGSize = .zero

    var body: some View {
        ZStack {
            // ultraThickMaterial scrim per design.md §6.5
            Rectangle()
                .fill(Theme.Material.viewerOverlay)
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
                HStack {
                    Spacer()
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 28))
                            .foregroundStyle(.thinMaterial)
                            .background(Circle().fill(.black.opacity(0.5)))
                    }
                    .padding(Theme.Spacing.s4)
                }
                Spacer()
                if let prompt = image.refined_prompt ?? image.prompt, !prompt.isEmpty {
                    Text(prompt)
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.fg1)
                        .multilineTextAlignment(.leading)
                        .padding(Theme.Spacing.s3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
                        .padding(Theme.Spacing.s4)
                }
            }
        }
        .task { await loadURL() }
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
