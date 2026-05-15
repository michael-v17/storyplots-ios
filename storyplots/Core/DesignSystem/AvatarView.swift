import SwiftUI

/// Reusable circle avatar that renders the character's photo when available
/// and falls back to an initials disc tinted with the accent.
///
/// Two initializers:
/// - `imageURL:` — for callers that already hold a resolved URL (legacy path).
/// - `avatarRef:` — for callers that only have the storage ref (e.g.
///   `{user_id}/character-{id}.webp`). The view itself resolves a signed URL
///   from the `avatars` bucket using `SupabaseStorageHelper`, caches it, and
///   re-resolves only when the cached entry expires.
struct AvatarView: View {
    private enum Source {
        case url(URL?)
        case ref(String?)
    }

    private let source: Source
    private let initials: String
    private let accent: Color
    private let size: CGFloat
    private let ringWidth: CGFloat

    @State private var resolvedURL: URL?
    @State private var didResolve: Bool = false

    init(imageURL: URL? = nil,
         name: String,
         accent: Color = Theme.Color.brand1,
         size: CGFloat = 56,
         ringWidth: CGFloat = 2) {
        self.source = .url(imageURL)
        self.initials = Self.makeInitials(from: name)
        self.accent = accent
        self.size = size
        self.ringWidth = ringWidth
    }

    init(avatarRef: String?,
         name: String,
         accent: Color = Theme.Color.brand1,
         size: CGFloat = 56,
         ringWidth: CGFloat = 2) {
        self.source = .ref(avatarRef)
        self.initials = Self.makeInitials(from: name)
        self.accent = accent
        self.size = size
        self.ringWidth = ringWidth
    }

    var body: some View {
        ZStack {
            if let url = currentURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure, .empty:
                        fallback
                    @unknown default:
                        fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().stroke(accent.opacity(0.55), lineWidth: ringWidth))
        .task(id: refKey) { await resolveIfNeeded() }
    }

    private var currentURL: URL? {
        switch source {
        case .url(let u): return u
        case .ref:        return resolvedURL
        }
    }

    private var refKey: String {
        switch source {
        case .url(let u): return u?.absoluteString ?? ""
        case .ref(let r): return r ?? ""
        }
    }

    private func resolveIfNeeded() async {
        guard case .ref(let ref) = source else { return }
        guard let ref, !ref.isEmpty else {
            resolvedURL = nil
            didResolve = true
            return
        }
        let url = await SupabaseStorageHelper.shared.avatarURL(path: ref)
        resolvedURL = url
        didResolve = true
    }

    private var fallback: some View {
        ZStack {
            accent.opacity(0.18)
            Text(initials)
                .font(.system(size: size * 0.38, weight: .semibold, design: .rounded))
                .foregroundStyle(Theme.Color.fg)
        }
    }

    private static func makeInitials(from name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return "·" }
        let parts = trimmed.split(separator: " ", omittingEmptySubsequences: true).prefix(2)
        let chars = parts.compactMap { $0.first }
        return String(chars).uppercased()
    }
}
