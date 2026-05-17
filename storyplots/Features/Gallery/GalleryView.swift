import SwiftUI
import Supabase

struct GalleryView: View {
    @State private var model: GalleryViewModel
    @State private var presentedImage: GeneratedImage?
    @State private var pendingDelete: GeneratedImage?
    @State private var navTitleVisible: Bool = false
    @Namespace private var galleryNamespace

    init(client: SupabaseClient) {
        _model = State(initialValue: GalleryViewModel(client: client))
    }

    private let columns = [
        GridItem(.flexible(), spacing: Theme.Spacing.s2),
        GridItem(.flexible(), spacing: Theme.Spacing.s2)
    ]

    var body: some View {
        Group {
            switch model.loadState {
            case .idle:
                loadingState
            case .loading where model.images.isEmpty:
                loadingState
            case .error(let m) where model.images.isEmpty:
                errorState(m)
            default:
                content
            }
        }
        .background(Theme.Color.bg)
        .brandTopWash()
        .navigationBarTitleDisplayMode(.inline)
        // Toolbar transparent at scroll-zero; system glass fades in once
        // tiles scroll behind. "Gallery" title hands off from the inline
        // hero header to the toolbar principal — same pattern as Home.
        .toolbarBackground(.automatic, for: .navigationBar)
        .toolbarBackgroundVisibility(.automatic, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                SidebarToggleButton()
            }
            ToolbarItem(placement: .principal) {
                // See HomeView for why we offset rather than counterweight.
                Text("Gallery")
                    .font(.headline)
                    .foregroundStyle(Theme.Color.fg)
                    .offset(x: -28)
                    .opacity(navTitleVisible ? 1.0 : 0.0)
                    .animation(.easeInOut(duration: 0.2), value: navTitleVisible)
            }
        }
        .refreshable { await model.load() }
        .task { if model.loadState == .idle { await model.load() } }
        .fullScreenCover(item: $presentedImage) { image in
            ImageViewer(
                image: image,
                namespace: galleryNamespace,
                onDismiss: { presentedImage = nil },
                onDelete: { model.delete(image) }
            )
        }
        .confirmationDialog(
            "Delete this image?",
            isPresented: Binding(
                get: { pendingDelete != nil },
                set: { if !$0 { pendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                if let img = pendingDelete {
                    Haptics.notify(.warning)
                    model.delete(img)
                }
                pendingDelete = nil
            }
            Button("Cancel", role: .cancel) { pendingDelete = nil }
        } message: {
            Text("This permanently removes the generated image from your gallery.")
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                header
                    .id("gallery-hero")
                if model.images.isEmpty {
                    EmptyStateView(
                        systemImage: "photo.stack.fill",
                        title: "No images yet",
                        message: "Generate one inside a chat — they all gather here."
                    )
                    .padding(.top, Theme.Spacing.s10)
                } else {
                    LazyVGrid(columns: columns, spacing: Theme.Spacing.s2) {
                        ForEach(model.images) { image in
                            GalleryTile(
                                image: image,
                                namespace: galleryNamespace,
                                onTap: {
                                    Haptics.impact(.light)
                                    presentedImage = image
                                }
                            )
                            .contextMenu {
                                Button(role: .destructive) {
                                    pendingDelete = image
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.s4)
                    .padding(.bottom, Theme.Spacing.s10)
                }
            }
        }
        .onScrollGeometryChange(for: Double.self) { geometry in
            geometry.contentOffset.y
        } action: { _, newValue in
            navTitleVisible = newValue > 40
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Gallery")
                .font(Theme.FontStyle.h2)
                .foregroundStyle(Theme.Color.fg)
            Text(countLabel)
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.fg3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Theme.Spacing.s4)
        .padding(.top, Theme.Spacing.s5)
    }

    private var countLabel: String {
        switch model.images.count {
        case 0:  return "Nothing rendered yet."
        case 1:  return "1 image"
        default: return "\(model.images.count) images"
        }
    }

    private var loadingState: some View {
        ScrollView {
            VStack(alignment: .leading) {
                header
                LazyVGrid(columns: columns, spacing: Theme.Spacing.s2) {
                    ForEach(0..<6, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: Theme.Radius.card)
                            .fill(Theme.Color.bg2)
                            .aspectRatio(1, contentMode: .fit)
                            .shimmer()
                    }
                }
                .padding(.horizontal, Theme.Spacing.s4)
            }
        }
        .disabled(true)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: Theme.Spacing.s3) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 36))
                .foregroundStyle(Theme.Color.destructive)
            Text("Couldn't load images")
                .font(Theme.FontStyle.h3)
                .foregroundStyle(Theme.Color.fg)
            Text(message)
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.fg2)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Theme.Spacing.s4)
            Button("Retry") { Task { await model.load() } }
                .buttonStyle(.borderedProminent)
                .tint(Theme.Color.brand1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct GalleryTile: View {
    let image: GeneratedImage
    let namespace: Namespace.ID
    let onTap: () -> Void

    var body: some View {
        let image = self.image
        Button(action: onTap) {
            ZStack {
                // Always reserve a square slot — content paints on top.
                RoundedRectangle(cornerRadius: Theme.Radius.card)
                    .fill(Theme.Color.bg2)
                    .aspectRatio(1, contentMode: .fit)
                    .shimmer()

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
                            .aspectRatio(1, contentMode: .fit)
                            .clipped()
                    case .failure:
                        placeholder
                    case .empty:
                        Color.clear
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.card)
                    .stroke(Theme.Color.borderSoft, lineWidth: 1)
            )
            .matchedGeometryEffect(id: "img-\(image.id)", in: namespace)
        }
        .buttonStyle(.plain)
    }

    private static func cacheKey(for image: GeneratedImage) -> String? {
        if let ref = image.storage_ref, !ref.isEmpty {
            return "media:\(ref)"
        }
        if let ext = image.external_url, !ext.isEmpty {
            return "media-ext:\(ext)"
        }
        return nil
    }

    private var placeholder: some View {
        ZStack {
            Theme.Color.bg2
            Image(systemName: image.sfw_blocked == true ? "eye.slash.fill" : "photo")
                .font(.system(size: 26))
                .foregroundStyle(Theme.Color.fg4)
        }
    }
}
