import SwiftUI
import Supabase

struct SettingsView: View {
    @Environment(AuthStore.self) private var auth
    @State private var path = NavigationPath()

    var body: some View {
        Form {
            Section {
                NavigationLink(value: SettingsDestination.profile) {
                    heroCard
                }
                .listRowBackground(
                    LinearGradient(
                        colors: [Theme.Color.brand1.opacity(0.18), Theme.Color.brand2.opacity(0.08)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            }

            Section("Engines") {
                NavigationLink(value: SettingsDestination.textEngine) {
                    brandLabel("Text Engine", systemImage: "text.bubble")
                }
                NavigationLink(value: SettingsDestination.imageEngine) {
                    brandLabel("Image Engine", systemImage: "photo.stack")
                }
                NavigationLink(value: SettingsDestination.memoryEngine) {
                    brandLabel("Memory Engine", systemImage: "brain")
                }
                NavigationLink(value: SettingsDestination.voice) {
                    brandLabel("Voice", systemImage: "waveform")
                }
            }

            Section("Writing") {
                NavigationLink(value: SettingsDestination.roleplay) {
                    brandLabel("Roleplay", systemImage: "theatermasks")
                }
                NavigationLink(value: SettingsDestination.writingStyles) {
                    brandLabel("Writing styles", systemImage: "pencil.and.outline")
                }
                NavigationLink(value: SettingsDestination.grammarDashboard) {
                    brandLabel("Grammar dashboard", systemImage: "chart.bar.doc.horizontal")
                }
                NavigationLink(value: SettingsDestination.grammar) {
                    brandLabel("Grammar settings", systemImage: "checkmark.bubble")
                }
            }

            Section("Experience") {
                NavigationLink(value: SettingsDestination.visualRoleplay) {
                    brandLabel("Visual roleplay", systemImage: "photo.artframe")
                }
                NavigationLink(value: SettingsDestination.promptEditor) {
                    brandLabel("Prompt editor", systemImage: "doc.text")
                }
                NavigationLink(value: SettingsDestination.memoryUser) {
                    brandLabel("Memory", systemImage: "brain.head.profile")
                }
            }

            Section("App") {
                NavigationLink(value: SettingsDestination.privacy) {
                    brandLabel("Privacy & Data", systemImage: "lock.shield")
                }
                NavigationLink(value: SettingsDestination.about) {
                    brandLabel("About", systemImage: "info.circle")
                }
            }

            Section {
                Button(role: .destructive) {
                    Haptics.notify(.warning)
                    Task { await auth.signOut() }
                } label: {
                    if auth.isLoading {
                        ProgressView()
                    } else {
                        Text("Sign out")
                    }
                }
                .disabled(auth.isLoading)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.Color.bg)
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.automatic, for: .navigationBar)
        .navigationDestination(for: SettingsDestination.self) { dest in
            switch dest {
            case .textEngine:        TextEngineSettingsView(client: auth.client)
            case .imageEngine:       ImageEngineSettingsView(client: auth.client)
            case .memoryEngine:      MemoryEngineSettingsView(client: auth.client)
            case .voice:             VoiceSettingsView(client: auth.client)
            case .profile:           ProfileView(client: auth.client)
            case .privacy:           PrivacyAndDataView(client: auth.client).environment(auth)
            case .roleplay:          RoleplaySettingsView(client: auth.client)
            case .writingStyles:     WritingStylesSettingsView(client: auth.client)
            case .grammar:           GrammarSettingsView(client: auth.client)
            case .grammarDashboard:  GrammarDashboardView(client: auth.client)
            case .visualRoleplay:    VisualRoleplaySettingsView(client: auth.client)
            case .promptEditor:      PromptEditorView(client: auth.client)
            case .memoryUser:        MemorySettingsView(client: auth.client)
            case .about:             AboutView()
            }
        }
    }

    /// Label with the icon tinted brand-amber instead of the iOS default blue.
    @ViewBuilder
    private func brandLabel(_ title: String, systemImage: String) -> some View {
        Label {
            Text(title)
                .foregroundStyle(Theme.Color.fg)
        } icon: {
            Image(systemName: systemImage)
                .foregroundStyle(Theme.Color.brand1)
        }
    }

    /// Hero card for the top of Settings — large avatar, name/email, edit hint.
    private var heroCard: some View {
        HStack(spacing: Theme.Spacing.s4) {
            ZStack {
                Circle()
                    .fill(Theme.Color.brand1.opacity(0.22))
                    .frame(width: 72, height: 72)
                Circle()
                    .strokeBorder(Theme.Color.brand1.opacity(0.55), lineWidth: 2)
                    .frame(width: 72, height: 72)
                Text(initialsString)
                    .font(.system(size: 28, weight: .semibold, design: .rounded))
                    .foregroundStyle(Theme.Color.fg)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(displayName)
                    .font(Theme.FontStyle.h3)
                    .foregroundStyle(Theme.Color.fg)
                    .lineLimit(1)
                Text(auth.userEmail ?? "Signed-in user")
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg2)
                    .lineLimit(1)
                Text("Tap to edit profile")
                    .font(Theme.FontStyle.timestamp)
                    .foregroundStyle(Theme.Color.brand1)
                    .padding(.top, 2)
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, Theme.Spacing.s2)
    }

    private var displayName: String {
        if let email = auth.userEmail,
           let local = email.split(separator: "@").first {
            return String(local).capitalized
        }
        return "You"
    }

    private var initialsString: String {
        let stem = displayName
        let parts = stem.split(separator: " ", omittingEmptySubsequences: true).prefix(2)
        return String(parts.compactMap { $0.first }).uppercased()
    }
}

enum SettingsDestination: Hashable {
    case profile
    case textEngine, imageEngine, memoryEngine, voice
    case roleplay, writingStyles, grammar, grammarDashboard
    case visualRoleplay, promptEditor, memoryUser
    case privacy, about

    var title: String {
        switch self {
        case .profile: return "Profile"
        case .textEngine: return "Text Engine"
        case .imageEngine: return "Image Engine"
        case .memoryEngine: return "Memory Engine"
        case .voice: return "Voice"
        case .roleplay: return "Roleplay"
        case .writingStyles: return "Writing styles"
        case .grammar: return "Grammar settings"
        case .grammarDashboard: return "Grammar dashboard"
        case .visualRoleplay: return "Visual roleplay"
        case .promptEditor: return "Prompt editor"
        case .memoryUser: return "Memory"
        case .privacy: return "Privacy & Data"
        case .about: return "About"
        }
    }
}

struct SettingsSectionPlaceholder: View {
    let destination: SettingsDestination

    var body: some View {
        Form {
            Section {
                Text("\(destination.title) settings land here in a later phase.")
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg2)
            }
            if destination == .about {
                Section("StoryPlots iOS") {
                    HStack { Text("Version"); Spacer(); Text("0.1 (Phase 9)").foregroundStyle(Theme.Color.fg3) }
                    HStack { Text("Build"); Spacer(); Text("alpha").foregroundStyle(Theme.Color.fg3) }
                }
            }
        }
        .navigationTitle(destination.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
    }
}
