import SwiftUI
import Supabase

struct CharacterChatsView: View {
    let character: Character
    let conversations: [Conversation]
    let accent: Color
    let avatarRef: String?
    let client: SupabaseClient

    @Namespace private var transitionNamespace

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
                                    avatarRef: avatarRef
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
        .brandTopWash()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
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
}
