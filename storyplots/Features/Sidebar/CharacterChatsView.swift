import SwiftUI
import Supabase

struct CharacterChatsView: View {
    let character: Character
    let conversations: [Conversation]
    let accent: Color
    let avatarRef: String?
    let client: SupabaseClient

    @Namespace private var transitionNamespace
    @State private var previews: [String: String] = [:]
    @State private var showAvatarFullscreen: Bool = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                header
                LazyVStack(spacing: Theme.Spacing.s3) {
                    if conversations.isEmpty {
                        EmptyStateView(
                            systemImage: "bubble.left.and.bubble.right",
                            title: "No chats with \(character.name)",
                            message: "Open the character to start a fresh conversation."
                        )
                    } else {
                        ForEach(conversations) { conv in
                            NavigationLink {
                                ChatView(
                                    conversationID: conv.id,
                                    character: character,
                                    accent: accent,
                                    avatarRef: avatarRef,
                                    client: client
                                )
                                .navigationTransition(
                                    .zoom(sourceID: "card-\(conv.id)", in: transitionNamespace)
                                )
                            } label: {
                                ConversationCardView(
                                    conversation: conv,
                                    accent: accent,
                                    avatarRef: avatarRef,
                                    previewText: previews[conv.id]
                                )
                                .matchedTransitionSource(id: "card-\(conv.id)", in: transitionNamespace)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, Theme.Spacing.s4)
                .padding(.top, Theme.Spacing.s2)
                .padding(.bottom, Theme.Spacing.s10)
            }
        }
        .background(Theme.Color.bg)
        .accentTopWash(color: accent, intensity: 0.14)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.automatic, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Button {
                    guard avatarRef != nil else { return }
                    Haptics.impact(.light)
                    showAvatarFullscreen = true
                } label: {
                    HStack(spacing: Theme.Spacing.s2) {
                        AvatarView(
                            avatarRef: avatarRef,
                            name: character.name,
                            accent: accent,
                            size: 26,
                            ringWidth: 1.5
                        )
                        Text(character.name)
                            .font(Theme.FontStyle.body.weight(.semibold))
                            .foregroundStyle(Theme.Color.fg)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(avatarRef == nil)
                .accessibilityLabel("View character avatar")
            }
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    CharacterEditView(
                        client: client,
                        character: character,
                        onSaved: { },
                        onDeleted: { }
                    )
                } label: {
                    Text("Edit")
                        .foregroundStyle(Theme.Color.brand1)
                }
            }
        }
        .fullScreenCover(isPresented: $showAvatarFullscreen) {
            AvatarFullscreenViewer(avatarRef: avatarRef) {
                showAvatarFullscreen = false
            }
        }
        .task(id: conversationIDsKey) { await loadPreviews() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(character.name)
                .font(Theme.FontStyle.h2)
                .foregroundStyle(Theme.Color.fg)
            Text(conversationCountLabel)
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.fg3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Theme.Spacing.s4)
        .padding(.top, Theme.Spacing.s5)
        .padding(.bottom, Theme.Spacing.s3)
    }

    private var conversationCountLabel: String {
        switch conversations.count {
        case 0:  return "No conversations"
        case 1:  return "1 conversation"
        default: return "\(conversations.count) conversations"
        }
    }

    private var conversationIDsKey: String {
        conversations.map(\.id).sorted().joined(separator: ",")
    }

    /// Fetch the newest message per conversation in one round-trip. PostgREST
    /// is ordered DESC, so the first row for each conversation_id is the
    /// most recent — we keep that and drop the rest.
    private func loadPreviews() async {
        let ids = conversations.map(\.id)
        guard !ids.isEmpty else {
            previews = [:]
            return
        }
        struct Row: Decodable {
            let conversation_id: String
            let text: String?
        }
        do {
            let rows: [Row] = try await client
                .from("messages")
                .select("conversation_id, text, created_at")
                .in("conversation_id", values: ids)
                .order("created_at", ascending: false)
                .execute()
                .value
            var byConv: [String: String] = [:]
            for row in rows {
                guard byConv[row.conversation_id] == nil else { continue }
                let snippet = row.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                guard !snippet.isEmpty else { continue }
                byConv[row.conversation_id] = snippet
            }
            previews = byConv
        } catch {
            // soft fail — the snippet is decoration; the list still works.
        }
    }
}
