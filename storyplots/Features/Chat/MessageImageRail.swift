import SwiftUI

/// Horizontal rail of inline images attached to an assistant message.
///
/// The rail is rendered below the bubble body when `images` is non-empty.
/// Tapping a thumbnail invokes `onSelect`, which the parent uses to surface
/// the fullscreen `ImageViewer` with matched geometry from `img-\(id)`.
///
/// If a row has `sfw_blocked == true`, we render a placeholder card instead
/// of attempting to load the (non-existent) image asset.
struct MessageImageRail: View {
    let images: [GeneratedImage]
    let isLoading: Bool
    let accent: Color
    let namespace: Namespace.ID
    let onSelect: (GeneratedImage) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s2) {
                ForEach(images) { img in
                    if img.sfw_blocked == true {
                        sfwBlockedCard
                    } else {
                        thumbnail(for: img)
                    }
                }
                if isLoading {
                    loadingCard
                }
            }
            .padding(.horizontal, Theme.Spacing.s1)
        }
        .padding(.top, Theme.Spacing.s2)
    }

    /// Shimmering placeholder rendered while `/messages/{id}/images` is in
    /// flight. Matches the thumbnail dimensions so the rail doesn't reflow
    /// when the real image arrives.
    private var loadingCard: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .fill(Theme.Color.bg3)
            VStack(spacing: Theme.Spacing.s2) {
                Image(systemName: "sparkles")
                    .font(.system(size: 24, weight: .medium))
                    .foregroundStyle(accent)
                Text("Generating…")
                    .font(Theme.FontStyle.timestamp.weight(.semibold))
                    .foregroundStyle(Theme.Color.fg)
                Text("Feel free to keep chatting")
                    .font(Theme.FontStyle.timestamp)
                    .foregroundStyle(Theme.Color.fg2)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Theme.Spacing.s2)
            }
        }
        .frame(width: 160, height: 160)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .stroke(accent.opacity(0.5), lineWidth: 1)
        )
        .shimmer()
    }

    private func thumbnail(for img: GeneratedImage) -> some View {
        MessageImageThumbnail(image: img, accent: accent, namespace: namespace)
            .onTapGesture { onSelect(img) }
    }

    private var sfwBlockedCard: some View {
        VStack(spacing: Theme.Spacing.s1) {
            Image(systemName: "eye.slash.fill")
                .font(.system(size: 18))
                .foregroundStyle(Theme.Color.fg3)
            Text("Blocked")
                .font(Theme.FontStyle.timestamp)
                .foregroundStyle(Theme.Color.fg3)
        }
        .frame(width: 120, height: 120)
        .background(Theme.Color.bg3)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .stroke(Theme.Color.borderSoft, lineWidth: 1)
        )
    }
}

/// Single thumbnail — resolves its own display URL and renders an AsyncImage.
struct MessageImageThumbnail: View {
    let image: GeneratedImage
    let accent: Color
    let namespace: Namespace.ID

    @State private var url: URL?

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFill()
                    case .failure:
                        placeholder
                    case .empty:
                        ProgressView().tint(accent)
                    @unknown default:
                        placeholder
                    }
                }
            } else {
                ProgressView().tint(accent)
            }
        }
        .frame(width: 160, height: 160)
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .stroke(accent.opacity(0.35), lineWidth: 1)
        )
        .matchedGeometryEffect(id: "img-\(image.id)", in: namespace)
        .task { await loadURL() }
    }

    private var placeholder: some View {
        Image(systemName: "photo")
            .font(.system(size: 24))
            .foregroundStyle(Theme.Color.fg3)
            .frame(width: 160, height: 160)
            .background(Theme.Color.bg3)
    }

    private func loadURL() async {
        self.url = await SupabaseStorageHelper.shared.displayURL(
            engine: image.engine,
            externalURL: image.external_url,
            storageRef: image.storage_ref
        )
    }
}
