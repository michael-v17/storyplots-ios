import SwiftUI
import Supabase

struct PeopleView: View {
    @State private var model: PeopleViewModel
    @State private var showCreateSheet: Bool = false
    private let client: SupabaseClient

    init(client: SupabaseClient) {
        _model = State(initialValue: PeopleViewModel(client: client))
        self.client = client
    }

    private let columns = [
        GridItem(.flexible(), spacing: Theme.Spacing.s3),
        GridItem(.flexible(), spacing: Theme.Spacing.s3)
    ]

    var body: some View {
        Group {
            switch model.loadState {
            case .idle:
                loadingState
            case .loading where model.characters.isEmpty:
                loadingState
            case .error(let m) where model.characters.isEmpty:
                errorState(m)
            default:
                gridState
            }
        }
        .background(Theme.Color.bg)
        .navigationTitle("People")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
        .searchable(text: Binding(
            get: { model.searchText },
            set: { model.searchText = $0 }
        ), prompt: "Search characters")
        .refreshable { await model.load() }
        .task { if model.loadState == .idle { await model.load() } }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreateSheet = true
                } label: {
                    Image(systemName: "plus")
                        .foregroundStyle(Theme.Color.brand1)
                }
            }
        }
        .sheet(isPresented: $showCreateSheet) {
            CharacterCreateSheet(client: client) { _ in
                Task { await model.load() }
            }
        }
    }

    private var gridState: some View {
        ScrollView {
            if model.filtered.isEmpty {
                emptyState
            } else {
                LazyVGrid(columns: columns, spacing: Theme.Spacing.s3) {
                    ForEach(model.filtered) { character in
                        NavigationLink {
                            CharacterDetailView(
                                character: character,
                                accent: model.accent(for: character),
                                avatarURL: model.avatarURL(for: character),
                                client: client,
                                onChanged: { Task { await model.load() } }
                            )
                        } label: {
                            CharacterCardView(
                                character: character,
                                accent: model.accent(for: character),
                                avatarURL: model.avatarURL(for: character)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, Theme.Spacing.s4)
                .padding(.top, Theme.Spacing.s2)
                .padding(.bottom, Theme.Spacing.s6)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: Theme.Spacing.s3) {
            Image(systemName: "person.2")
                .font(.system(size: 48))
                .foregroundStyle(Theme.Color.fg3)
            Text("No characters yet")
                .font(Theme.FontStyle.h3)
                .foregroundStyle(Theme.Color.fg)
            Text("Phase 6 ships the create / import / generate flows.")
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.fg3)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, Theme.Spacing.s10)
        .frame(maxWidth: .infinity)
    }

    private var loadingState: some View {
        VStack(spacing: Theme.Spacing.s3) {
            ProgressView().tint(Theme.Color.brand1)
            Text("Loading…").font(Theme.FontStyle.meta).foregroundStyle(Theme.Color.fg3)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: Theme.Spacing.s3) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 36))
                .foregroundStyle(Theme.Color.destructive)
            Text("Something went wrong").font(Theme.FontStyle.h3).foregroundStyle(Theme.Color.fg)
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
