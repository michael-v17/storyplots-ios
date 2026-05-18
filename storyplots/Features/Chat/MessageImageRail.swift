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
        // No images yet, just loading → take the full bubble width and
        // a generous height. Reads as a clear "here's where your image
        // will land" placeholder rather than a tiny thumbnail off to
        // the side.
        if images.isEmpty && isLoading {
            fullWidthLoadingCard
                .padding(.top, Theme.Spacing.s2)
        } else if images.count == 1, let only = images.first, !isLoading {
            // Single image, no pending generation → render at full
            // bubble width so the image actually reads instead of
            // sitting as a thumbnail off to the side. Tap still opens
            // the fullscreen viewer.
            singleFullWidthImage(for: only)
                .padding(.top, Theme.Spacing.s2)
        } else {
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
                        compactLoadingCard
                    }
                }
                .padding(.horizontal, Theme.Spacing.s1)
            }
            .padding(.top, Theme.Spacing.s2)
        }
    }

    /// Single-image render: full bubble width, taller aspect so the
    /// image is legible inline instead of needing a tap into the
    /// fullscreen viewer to see it.
    @ViewBuilder
    private func singleFullWidthImage(for image: GeneratedImage) -> some View {
        if image.sfw_blocked == true {
            sfwBlockedCard
                .frame(maxWidth: .infinity)
                .frame(height: 200)
        } else {
            CachedRemoteImage(
                cacheKey: MessageImageThumbnail.cacheKey(for: image),
                resolver: { @Sendable in
                    await SupabaseStorageHelper.shared.displayURL(
                        engine: image.engine,
                        externalURL: image.external_url,
                        storageRef: image.storage_ref
                    )
                }
            ) { phase in
                switch phase {
                case .success(let img):
                    img.resizable().scaledToFill()
                case .failure:
                    Image(systemName: "photo")
                        .font(.system(size: 32))
                        .foregroundStyle(Theme.Color.fg3)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Theme.Color.bg3)
                case .empty:
                    ProgressView().tint(accent)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Theme.Color.bg3)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 260)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.card)
                    .stroke(accent.opacity(0.35), lineWidth: 1)
            )
            .matchedGeometryEffect(id: "img-\(image.id)", in: namespace)
            .onTapGesture { onSelect(image) }
        }
    }

    /// Full-width image-loading placeholder — only used when no images
    /// have arrived yet. Matches the bubble's horizontal extent so the
    /// loading state feels intentional, not a tiny chip on the side.
    private var fullWidthLoadingCard: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .fill(Theme.Color.bg3)
            VStack(spacing: Theme.Spacing.s2) {
                Image(systemName: "sparkles")
                    .font(.system(size: 28, weight: .medium))
                    .foregroundStyle(accent)
                Text("Generating image…")
                    .font(Theme.FontStyle.body.weight(.semibold))
                    .foregroundStyle(Theme.Color.fg)
                Text("Feel free to keep chatting")
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg2)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 200)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .stroke(accent.opacity(0.5), lineWidth: 1)
        )
        .shimmer()
    }

    /// Smaller loading chip used when at least one image has already
    /// arrived — keeps the existing horizontal rail rhythm so the user
    /// can see a second image is in flight without the layout reflowing.
    private var compactLoadingCard: some View {
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

    var body: some View {
        let image = self.image
        CachedRemoteImage(
            cacheKey: Self.cacheKey(for: image),
            resolver: { @Sendable in
                await SupabaseStorageHelper.shared.displayURL(
                    engine: image.engine,
                    externalURL: image.external_url,
                    storageRef: image.storage_ref
                )
            }
        ) { phase in
            switch phase {
            case .success(let img):
                img.resizable().scaledToFill()
            case .failure:
                placeholder
            case .empty:
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
    }

    static func cacheKey(for image: GeneratedImage) -> String? {
        if let ref = image.storage_ref, !ref.isEmpty {
            return "media:\(ref)"
        }
        if let ext = image.external_url, !ext.isEmpty {
            return "media-ext:\(ext)"
        }
        return nil
    }

    private var placeholder: some View {
        Image(systemName: "photo")
            .font(.system(size: 24))
            .foregroundStyle(Theme.Color.fg3)
            .frame(width: 160, height: 160)
            .background(Theme.Color.bg3)
    }
}
