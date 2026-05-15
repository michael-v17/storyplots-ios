import SwiftUI
import Supabase

struct HomeView: View {
    @State private var model: HomeViewModel
    @State private var showPersonaSheet: Bool = false

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
        .navigationTitle("Home")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
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
                                avatarURL: model.avatarURL(for: conv),
                                client: model.client
                            )
                        } label: {
                            ConversationCardView(
                                conversation: conv,
                                accent: model.accent(for: conv),
                                avatarURL: model.avatarURL(for: conv)
                            )
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button(role: .destructive) {
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
            .padding(.bottom, Theme.Spacing.s6)
        }
    }

    private var emptyState: some View {
        VStack(spacing: Theme.Spacing.s3) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 48))
                .foregroundStyle(Theme.Color.fg3)
            Text("No conversations yet")
                .font(Theme.FontStyle.h3)
                .foregroundStyle(Theme.Color.fg)
            Text("Pick a character on the People tab to start chatting.")
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.fg3)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.Spacing.s10)
    }

    private var loadingState: some View {
        VStack(spacing: Theme.Spacing.s3) {
            ProgressView().tint(Theme.Color.brand1)
            Text("Loading…")
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.fg3)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
