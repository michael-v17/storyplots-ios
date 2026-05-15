import SwiftUI
import Supabase

struct HomeView: View {
    @State private var model: HomeViewModel
    @State private var showPersonaSheet: Bool = false
    @Namespace private var transitionNamespace

    init(client: SupabaseClient) {
        _model = State(initialValue: HomeViewModel(client: client))
    }

    var body: some View {
        Group {
            switch model.loadState {
            case .idle:
                loadingState
            case .loading where model.conversations.isEmpty:
                loadingState
            case .error(let message) where model.conversations.isEmpty:
                errorState(message)
            default:
                listState
            }
        }
        .background(Theme.Color.bg)
        .brandTopWash()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .navigationBar)
        .refreshable {
            await model.load()
        }
        .task {
            if model.loadState == .idle { await model.load() }
        }
        .sheet(isPresented: $showPersonaSheet) {
            PersonaEditPlaceholder(persona: model.persona)
        }
    }

    private var listState: some View {
        ScrollView {
            VStack(spacing: 0) {
                HomeHeaderView(
                    personaName: model.persona?.name,
                    personaPhotoRef: model.persona?.photo_ref,
                    conversationCount: model.conversations.count,
                    onAvatarTap: { showPersonaSheet = true }
                )

                LazyVStack(spacing: Theme.Spacing.s3) {
                    YourPersonaPill(persona: model.persona) { showPersonaSheet = true }

                    if model.conversations.isEmpty {
                        emptyState
                    } else {
                        ForEach(model.conversations) { conv in
                            NavigationLink {
                                ChatView(
                                    conversationID: conv.id,
                                    character: conv.character_id.flatMap { model.charactersByID[$0] },
                                    accent: model.accent(for: conv),
                                    avatarRef: model.avatarRef(for: conv),
                                    client: model.client
                                )
                                .navigationTransition(
                                    .zoom(sourceID: "card-\(conv.id)", in: transitionNamespace)
                                )
                            } label: {
                                ConversationCardView(
                                    conversation: conv,
                                    accent: model.accent(for: conv),
                                    avatarRef: model.avatarRef(for: conv)
                                )
                                .matchedTransitionSource(id: "card-\(conv.id)", in: transitionNamespace)
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button(role: .destructive) {
                                    Haptics.notify(.warning)
                                    Task { await model.delete(conv) }
                                } label: {
                                    Label("Delete chat", systemImage: "trash")
                                }
                            }
                        }
                    }

                    if case .error(let m) = model.loadState {
                        Text(m)
                            .font(Theme.FontStyle.meta)
                            .foregroundStyle(Theme.Color.destructive)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(Theme.Spacing.s3)
                            .background(Theme.Color.destructiveSoft, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
                    }
                }
                .padding(.horizontal, Theme.Spacing.s4)
                .padding(.top, Theme.Spacing.s2)
                .padding(.bottom, 100)
            }
        }
    }

    private var emptyState: some View {
        EmptyStateView(
            systemImage: "bubble.left.and.bubble.right.fill",
            title: "No conversations yet",
            message: "Open the People tab to pick a character and start your first chat."
        )
    }

    private var loadingState: some View {
        ScrollView {
            VStack(spacing: 0) {
                HomeHeaderView(
                    personaName: nil,
                    personaPhotoRef: nil,
                    conversationCount: 0,
                    onAvatarTap: { showPersonaSheet = true }
                )
                LazyVStack(spacing: Theme.Spacing.s3) {
                    ForEach(0..<5, id: \.self) { _ in
                        ConversationSkeletonRow()
                    }
                }
                .padding(.horizontal, Theme.Spacing.s4)
                .padding(.top, Theme.Spacing.s2)
            }
        }
        .disabled(true)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: Theme.Spacing.s3) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 36))
                .foregroundStyle(Theme.Color.destructive)
            Text("Something went wrong")
                .font(Theme.FontStyle.h3)
                .foregroundStyle(Theme.Color.fg)
            Text(message)
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.fg2)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Theme.Spacing.s4)
            Button("Retry") {
                Task { await model.load() }
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.Color.brand1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Placeholder sheet for editing the persona. Phase 9 replaces it.
private struct PersonaEditPlaceholder: View {
    let persona: UserPersona?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Persona") {
                    if let name = persona?.name {
                        HStack {
                            Text("Name").foregroundStyle(Theme.Color.fg1)
                            Spacer()
                            Text(name).foregroundStyle(Theme.Color.fg3)
                        }
                    } else {
                        Text("No persona configured yet.").foregroundStyle(Theme.Color.fg3)
                    }
                }
                Section {
                    Text("Persona editing lands in Phase 9 (Settings → Profile).")
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.fg3)
                }
            }
            .navigationTitle("Your persona")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}
