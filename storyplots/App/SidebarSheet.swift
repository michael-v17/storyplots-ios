import SwiftUI

/// Sheet-presented sidebar. Replaces `NavigationSplitView` columnVisibility on
/// iPhone because the system doesn't reliably collapse the column on selection
/// in iOS 26 with custom row chrome. Owns its own scroll + safe-area handling.
struct SidebarSheet: View {
    @Environment(AuthStore.self) private var auth

    @Binding var selection: SidebarDestination
    @Binding var detailPath: NavigationPath
    let model: SidebarViewModel
    let dismiss: () -> Void

    @State private var showPersonaSheet: Bool = false
    @State private var showSettings: Bool = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.s5) {
                    wordmark

                    sectionLabel("Sections")
                    destinationsCard
                        .padding(.horizontal, Theme.Spacing.s4)

                    sectionLabel("Recent")
                    recentsCard
                        .padding(.horizontal, Theme.Spacing.s4)

                    footerCard
                        .padding(.horizontal, Theme.Spacing.s4)
                        .padding(.top, Theme.Spacing.s4)
                }
                .padding(.vertical, Theme.Spacing.s4)
            }
            .background(Theme.Color.bg)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Theme.Color.brand1)
                }
            }
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
    }

    private var wordmark: some View {
        HStack {
            Spacer(minLength: 0)
            Image("Wordmark")
                .resizable()
                .scaledToFit()
                .frame(maxHeight: 44)
                .accessibilityLabel("StoryPlots")
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.Spacing.s4)
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .tracking(1.5)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Color.fg3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Theme.Spacing.s4)
            .padding(.top, Theme.Spacing.s2)
    }

    private var destinationsCard: some View {
        VStack(spacing: 0) {
            ForEach(Array(SidebarDestination.allCases.enumerated()), id: \.element.id) { idx, dest in
                Button {
                    Haptics.impact(.light)
                    selection = dest
                    detailPath = NavigationPath()
                    dismiss()
                } label: {
                    HStack(spacing: Theme.Spacing.s3) {
                        Image(systemName: dest.systemImage)
                            .foregroundStyle(selection == dest ? Theme.Color.fgOnBrand : Theme.Color.brand1)
                            .frame(width: 32, height: 32)
                            .background(
                                selection == dest ? AnyShapeStyle(Theme.Color.brandGradient) : AnyShapeStyle(Theme.Color.brand1.opacity(0.10)),
                                in: RoundedRectangle(cornerRadius: 8)
                            )
                        Text(dest.title)
                            .font(Theme.FontStyle.body.weight(.medium))
                            .foregroundStyle(Theme.Color.fg)
                        Spacer(minLength: 0)
                        if selection == dest {
                            Image(systemName: "checkmark")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.Color.brand1)
                        } else {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.Color.fg4)
                        }
                    }
                    .padding(.vertical, Theme.Spacing.s3)
                    .padding(.horizontal, Theme.Spacing.s4)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                if idx < SidebarDestination.allCases.count - 1 {
                    Divider().overlay(Theme.Color.borderSoft).padding(.leading, Theme.Spacing.s4 + 32 + Theme.Spacing.s3)
                }
            }
        }
        .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
    }

    private var recentsCard: some View {
        let rows = model.groupedRows
        return VStack(spacing: 0) {
            if rows.isEmpty {
                HStack {
                    Text("No chats yet")
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.fg4)
                    Spacer(minLength: 0)
                }
                .padding(Theme.Spacing.s4)
            } else {
                ForEach(Array(rows.enumerated()), id: \.element.id) { idx, row in
                    Button {
                        Haptics.impact(.light)
                        detailPath.append(SidebarRoute.characterChats(characterID: row.character.id))
                        dismiss()
                    } label: {
                        HStack(spacing: Theme.Spacing.s3) {
                            AvatarView(
                                avatarRef: model.avatarRef(for: row.character),
                                name: row.character.name,
                                accent: model.accent(for: row.character),
                                size: 36,
                                ringWidth: 1.5
                            )
                            VStack(alignment: .leading, spacing: 1) {
                                Text(row.character.name)
                                    .font(Theme.FontStyle.body.weight(.medium))
                                    .foregroundStyle(Theme.Color.fg)
                                    .lineLimit(1)
                                Text(countLabel(row.count))
                                    .font(Theme.FontStyle.timestamp)
                                    .foregroundStyle(Theme.Color.fg3)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.Color.fg4)
                        }
                        .padding(.vertical, Theme.Spacing.s2)
                        .padding(.horizontal, Theme.Spacing.s4)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    if idx < rows.count - 1 {
                        Divider().overlay(Theme.Color.borderSoft).padding(.leading, Theme.Spacing.s4 + 36 + Theme.Spacing.s3)
                    }
                }
            }
        }
        .padding(.vertical, Theme.Spacing.s2)
        .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
    }

    private var footerCard: some View {
        VStack(spacing: 0) {
            Button {
                Haptics.impact(.light)
                showPersonaSheet = true
            } label: {
                HStack(spacing: Theme.Spacing.s3) {
                    AvatarView(
                        avatarRef: model.persona?.photo_ref,
                        name: model.persona?.name ?? displayName,
                        accent: Theme.Color.brand1,
                        size: 40,
                        ringWidth: 1.5
                    )
                    VStack(alignment: .leading, spacing: 2) {
                        Text(model.persona?.name ?? displayName)
                            .font(Theme.FontStyle.body.weight(.semibold))
                            .foregroundStyle(Theme.Color.fg)
                            .lineLimit(1)
                        Text(model.persona == nil ? "Set up persona" : "Your persona")
                            .font(Theme.FontStyle.timestamp)
                            .foregroundStyle(model.persona == nil ? Theme.Color.brand1 : Theme.Color.fg3)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.fg4)
                }
                .padding(Theme.Spacing.s3)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Divider().overlay(Theme.Color.borderSoft).padding(.horizontal, Theme.Spacing.s3)

            Button {
                Haptics.impact(.light)
                showSettings = true
            } label: {
                HStack(spacing: Theme.Spacing.s3) {
                    Image(systemName: "gearshape.fill")
                        .foregroundStyle(Theme.Color.brand1)
                        .frame(width: 32, height: 32)
                        .background(Theme.Color.brand1.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
                    Text("Settings")
                        .font(Theme.FontStyle.body.weight(.medium))
                        .foregroundStyle(Theme.Color.fg)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.fg4)
                }
                .padding(Theme.Spacing.s3)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Divider().overlay(Theme.Color.borderSoft).padding(.horizontal, Theme.Spacing.s3)

            Button(role: .destructive) {
                guard !auth.isLoading else { return }
                Haptics.notify(.warning)
                Task { await auth.signOut() }
            } label: {
                HStack(spacing: Theme.Spacing.s3) {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .foregroundStyle(Theme.Color.destructive)
                        .frame(width: 32, height: 32)
                        .background(Theme.Color.destructiveSoft, in: RoundedRectangle(cornerRadius: 8))
                    Text("Sign out")
                        .font(Theme.FontStyle.body.weight(.medium))
                        .foregroundStyle(Theme.Color.destructive)
                    Spacer(minLength: 0)
                }
                .padding(Theme.Spacing.s3)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(auth.isLoading)
        }
        .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
    }

    private func countLabel(_ count: Int) -> String {
        switch count {
        case 0:  return "No chats"
        case 1:  return "1 chat"
        default: return "\(count) chats"
        }
    }

    private var displayName: String {
        if let email = auth.userEmail, let stem = email.split(separator: "@").first {
            return String(stem).capitalized
        }
        return "You"
    }
}
