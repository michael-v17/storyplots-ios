import SwiftUI
import Supabase

struct PeopleView: View {
    @State private var model: PeopleViewModel
    @State private var showCreateSheet: Bool = false
    @State private var showGenerateSheet: Bool = false
    @State private var filter: PeopleFilter = .all
    @Namespace private var transitionNamespace
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
        .brandTopWash()
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                SidebarToggleButton()
            }
        }
        .searchable(text: Binding(
            get: { model.searchText },
            set: { model.searchText = $0 }
        ), prompt: "Search characters")
        .refreshable { await model.load() }
        .task { if model.loadState == .idle { await model.load() } }
        .sheet(isPresented: $showCreateSheet) {
            CharacterCreateSheet(client: client) { _ in
                Task { await model.load() }
            }
        }
        .sheet(isPresented: $showGenerateSheet) {
            CharacterGenerateSheet(client: client) { _ in
                Task { await model.load() }
            }
        }
        .sheet(isPresented: $showImportSheet) {
            CharacterImportSheet(client: client) { _ in
                Task { await model.load() }
            }
        }
        .navigationDestination(for: Character.self) { character in
            CharacterDetailView(
                character: character,
                accent: model.accent(for: character),
                avatarRef: model.avatarRef(for: character),
                client: client,
                onChanged: { Task { await model.load() } }
            )
        }
    }

    @State private var showImportSheet: Bool = false

    private var gridState: some View {
        ScrollView {
            VStack(spacing: 0) {
                PeopleHeaderView(
                    characterCount: model.characters.count,
                    filter: $filter,
                    onCreate: { showCreateSheet = true },
                    onGenerate: { showGenerateSheet = true },
                    onImport: { showImportSheet = true }
                )
                if model.filtered.isEmpty {
                    emptyState
                } else {
                    LazyVGrid(columns: columns, spacing: Theme.Spacing.s3) {
                        ForEach(model.filtered) { character in
                            NavigationLink {
                                CharacterLandingView(
                                    character: character,
                                    accent: model.accent(for: character),
                                    avatarRef: model.avatarRef(for: character),
                                    client: client,
                                    onChanged: { Task { await model.load() } }
                                )
                                .navigationTransition(
                                    .zoom(sourceID: "char-\(character.id)", in: transitionNamespace)
                                )
                            } label: {
                                CharacterCardView(
                                    character: character,
                                    accent: model.accent(for: character),
                                    avatarRef: model.avatarRef(for: character)
                                )
                                .matchedTransitionSource(id: "char-\(character.id)", in: transitionNamespace)
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                NavigationLink(value: character) {
                                    Label("Edit character", systemImage: "pencil")
                                }
                            }
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.s4)
                    .padding(.top, Theme.Spacing.s2)
                    .padding(.bottom, 100)
                }
            }
        }
    }

    private var emptyState: some View {
        EmptyStateView(
            systemImage: "person.crop.circle.badge.plus",
            title: "No characters yet",
            message: "Craft a persona, write a scenario, and start the story.",
            actionTitle: "Create character"
        ) {
            showCreateSheet = true
        }
    }

    private var loadingState: some View {
        ScrollView {
            VStack(spacing: 0) {
                PeopleHeaderView(
                    characterCount: 0,
                    filter: $filter,
                    onCreate: { showCreateSheet = true },
                    onGenerate: { showGenerateSheet = true },
                    onImport: { showImportSheet = true }
                )
                LazyVGrid(columns: columns, spacing: Theme.Spacing.s3) {
                    ForEach(0..<6, id: \.self) { _ in
                        CharacterSkeletonCard()
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
