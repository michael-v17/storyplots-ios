import SwiftUI
import Supabase

struct GalleryView: View {
    @State private var model: GalleryViewModel
    @State private var presentedImage: GeneratedImage?
    @State private var pendingDelete: GeneratedImage?
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
        .toolbarBackground(.hidden, for: .navigationBar)
        .refreshable { await model.load() }
        .task { if model.loadState == .idle { await model.load() } }
        .fullScreenCover(item: $presentedImage) { image in
            ImageViewer(image: image, namespace: galleryNamespace) {
                presentedImage = nil
            }
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

    @State private var url: URL?

    var body: some View {
        Button(action: onTap) {
            Group {
                if let url {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable().scaledToFill()
                        case .failure:
                            placeholder
                        case .empty:
                            ProgressView().tint(Theme.Color.brand1)
                        @unknown default:
                            placeholder
                        }
                    }
                } else if image.sfw_blocked == true {
                    placeholder
                } else {
                    ProgressView().tint(Theme.Color.brand1)
                }
            }
            .frame(maxWidth: .infinity)
            .aspectRatio(1, contentMode: .fit)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.card)
                    .stroke(Theme.Color.borderSoft, lineWidth: 1)
            )
            .matchedGeometryEffect(id: "img-\(image.id)", in: namespace)
            .task(id: image.id) { await loadURL() }
        }
        .buttonStyle(.plain)
    }

    private var placeholder: some View {
        Image(systemName: image.sfw_blocked == true ? "eye.slash.fill" : "photo")
            .font(.system(size: 22))
            .foregroundStyle(Theme.Color.fg3)
            .frame(maxWidth: .infinity)
            .aspectRatio(1, contentMode: .fit)
            .background(Theme.Color.bg2)
    }

    private func loadURL() async {
        url = await SupabaseStorageHelper.shared.displayURL(
            engine: image.engine,
            externalURL: image.external_url,
            storageRef: image.storage_ref
        )
    }
}
