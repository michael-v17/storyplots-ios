import SwiftUI
import Supabase
import OSLog

private let chatsLog = Logger(subsystem: "com.storyplots.ios", category: "character-chats")

struct CharacterChatsView: View {
    let character: Character
    let conversations: [Conversation]
    let accent: Color
    let avatarRef: String?
    let client: SupabaseClient

    @Namespace private var transitionNamespace
    @State private var previews: [String: String] = [:]
    @State private var showAvatarFullscreen: Bool = false
    /// IDs of conversations the user has just deleted. We don't refetch
    /// after delete — instead we filter the supplied `conversations`
    /// array through this set so the row disappears immediately and
    /// stays gone until the parent view re-loads the list.
    @State private var deletedIDs: Set<String> = []
    /// Confirmation flow — set to the conversation pending deletion so
    /// `.alert` can read its title for the message body.
    @State private var pendingDelete: Conversation?
    /// Surfaced after a delete fails so the user knows the row didn't
    /// actually go away on the server.
    @State private var deleteError: String?

    private var visibleConversations: [Conversation] {
        conversations.filter { !deletedIDs.contains($0.id) }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                header
                LazyVStack(spacing: Theme.Spacing.s3) {
                    if visibleConversations.isEmpty {
                        EmptyStateView(
                            systemImage: "bubble.left.and.bubble.right",
                            title: "No chats with \(character.name)",
                            message: "Open the character to start a fresh conversation."
                        )
                    } else {
                        ForEach(visibleConversations) { conv in
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
                                    previewText: previews[conv.id],
                                    showCharacterName: false
                                )
                                .matchedTransitionSource(id: "card-\(conv.id)", in: transitionNamespace)
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button(role: .destructive) {
                                    Haptics.notify(.warning)
                                    pendingDelete = conv
                                } label: {
                                    Label("Delete conversation", systemImage: "trash")
                                }
                            }
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
        .confirmationDialog(
            pendingDelete.map { "Delete \"\($0.title)\"?" } ?? "Delete conversation?",
            isPresented: Binding(
                get: { pendingDelete != nil },
                set: { if !$0 { pendingDelete = nil } }
            ),
            titleVisibility: .visible,
            presenting: pendingDelete
        ) { conv in
            Button("Delete", role: .destructive) {
                Task { await delete(conv) }
            }
            Button("Cancel", role: .cancel) { pendingDelete = nil }
        } message: { _ in
            Text("This permanently removes the conversation and every message in it. It can't be undone.")
        }
        .alert("Couldn't delete conversation",
               isPresented: Binding(get: { deleteError != nil },
                                    set: { if !$0 { deleteError = nil } })) {
            Button("OK", role: .cancel) { deleteError = nil }
        } message: {
            Text(deleteError ?? "")
        }
        .task(id: conversationIDsKey) { await loadPreviews() }
    }

    /// Permanently remove a conversation. Optimistically hides the row on
    /// success — we don't refetch since the parent's `conversations` array
    /// is a snapshot. If the DB delete fails the row reappears on next
    /// open of the sheet and we surface the error.
    private func delete(_ conv: Conversation) async {
        pendingDelete = nil
        do {
            try await client
                .from("conversations")
                .delete()
                .eq("id", value: conv.id)
                .execute()
            chatsLog.info("deleted conversation id=\(conv.id, privacy: .public)")
            Haptics.notify(.success)
            withAnimation(.easeInOut(duration: 0.2)) {
                _ = deletedIDs.insert(conv.id)
            }
        } catch {
            chatsLog.error("delete failed for \(conv.id, privacy: .public): \(error.localizedDescription, privacy: .public)")
            deleteError = error.localizedDescription
        }
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
