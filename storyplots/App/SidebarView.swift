import SwiftUI

struct SidebarView: View {
    @Environment(AuthStore.self) private var auth

    @Binding var selection: SidebarDestination?
    @Binding var detailPath: NavigationPath
    @Binding var sidebarVisibility: NavigationSplitViewVisibility
    let model: SidebarViewModel

    @State private var showPersonaSheet: Bool = false
    @State private var showSettings: Bool = false

    var body: some View {
        List(selection: $selection) {
            // Header — wordmark stays the StoryPlots brand mark.
            Section {
                HStack {
                    Spacer(minLength: 0)
                    Image("Wordmark")
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 36)
                        .opacity(0.95)
                        .accessibilityLabel("StoryPlots")
                    Spacer(minLength: 0)
                }
                .padding(.vertical, Theme.Spacing.s3)
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            Section {
                ForEach(SidebarDestination.allCases) { dest in
                    Label {
                        Text(dest.title)
                            .foregroundStyle(Theme.Color.fg)
                    } icon: {
                        Image(systemName: dest.systemImage)
                            .foregroundStyle(Theme.Color.brand1)
                    }
                    .tag(Optional(dest))
                }
            } header: {
                sectionHeader("Sections")
            }

            Section {
                RecentChatsList(
                    rows: model.groupedRows,
                    accentResolver: { model.accent(for: $0) },
                    avatarRefResolver: { model.avatarRef(for: $0) },
                    onTap: { row in
                        detailPath.append(SidebarRoute.characterChats(characterID: row.character.id))
                        sidebarVisibility = .detailOnly
                    }
                )
            } header: {
                sectionHeader("Recent")
            }

            Section {
                SidebarPersonaCard(
                    persona: model.persona,
                    userEmail: auth.userEmail,
                    onTap: { showPersonaSheet = true }
                )
                .listRowSeparator(.hidden)

                Button {
                    Haptics.impact(.light)
                    showSettings = true
                } label: {
                    Label {
                        Text("Settings").foregroundStyle(Theme.Color.fg)
                    } icon: {
                        Image(systemName: "gearshape.fill").foregroundStyle(Theme.Color.brand1)
                    }
                }
                .buttonStyle(.plain)

                Button(role: .destructive) {
                    Haptics.notify(.warning)
                    Task { await auth.signOut() }
                } label: {
                    Label {
                        Text("Sign out").foregroundStyle(Theme.Color.destructive)
                    } icon: {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .foregroundStyle(Theme.Color.destructive)
                    }
                }
                .buttonStyle(.plain)
                .disabled(auth.isLoading)
            }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .background(Theme.Color.bg)
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await model.load() }
        .sheet(isPresented: $showPersonaSheet) {
            NavigationStack {
                ProfileView(client: auth.client)
            }
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showSettings) {
            NavigationStack {
                SettingsView()
            }
        }
    }

    @ViewBuilder
    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .tracking(1.5)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Color.fg3)
    }
}
