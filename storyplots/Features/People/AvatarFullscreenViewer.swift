import SwiftUI

/// Fullscreen avatar viewer presented from `CharacterEditView`. Loads the
/// signed URL via `SupabaseStorageHelper`, supports pinch zoom + drag-to-dismiss.
struct AvatarFullscreenViewer: View {
    let avatarRef: String?
    let onDismiss: () -> Void

    @State private var url: URL?
    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var dragOffset: CGSize = .zero

    var body: some View {
        ZStack {
            Rectangle()
                .fill(Theme.Color.bg)
                .ignoresSafeArea()
                .onTapGesture { dismiss() }

            content
                .scaleEffect(scale)
                .offset(x: offset.width + dragOffset.width,
                        y: offset.height + dragOffset.height)
                .gesture(
                    SimultaneousGesture(
                        MagnifyGesture()
                            .onChanged { value in
                                scale = max(1.0, min(lastScale * value.magnification, 5.0))
                            }
                            .onEnded { _ in lastScale = scale },
                        DragGesture()
                            .onChanged { value in dragOffset = value.translation }
                            .onEnded { value in
                                if scale <= 1.0 && abs(value.translation.height) > 120 {
                                    dismiss()
                                } else if scale > 1.0 {
                                    offset.width += dragOffset.width
                                    offset.height += dragOffset.height
                                }
                                dragOffset = .zero
                            }
                    )
                )

            VStack {
                HStack {
                    Spacer(minLength: 0)
                    Button(action: dismiss) {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Theme.Color.fg)
                            .frame(width: 36, height: 36)
                            .background(.thinMaterial, in: Circle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, Theme.Spacing.s4)
                .padding(.top, Theme.Spacing.s5)
                Spacer(minLength: 0)
            }
        }
        .task(id: avatarRef ?? "") { await loadURL() }
    }

    @ViewBuilder
    private var content: some View {
        if let url {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let img):
                    img.resizable()
                        .scaledToFit()
                        .padding(.horizontal, Theme.Spacing.s4)
                case .failure:
                    failureView
                case .empty:
                    ProgressView().tint(Theme.Color.brand1)
                @unknown default:
                    failureView
                }
            }
        } else {
            ProgressView().tint(Theme.Color.brand1)
        }
    }

    private var failureView: some View {
        VStack(spacing: Theme.Spacing.s2) {
            Image(systemName: "photo")
                .font(.system(size: 48))
                .foregroundStyle(Theme.Color.fg3)
            Text("Couldn't load avatar")
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.fg2)
        }
    }

    private func loadURL() async {
        guard let avatarRef else {
            url = nil
            return
        }
        url = await SupabaseStorageHelper.shared.avatarURL(path: avatarRef)
    }

    private func dismiss() {
        Haptics.impact(.light)
        onDismiss()
    }
}
