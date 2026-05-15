import SwiftUI

struct SettingsView: View {
    @Environment(AuthStore.self) private var auth
    @State private var path = NavigationPath()

    var body: some View {
        Form {
            Section {
                NavigationLink(value: SettingsDestination.profile) {
                    HStack(spacing: Theme.Spacing.s3) {
                        AvatarView(name: auth.userEmail ?? "You", accent: Theme.Color.brand1, size: 48, ringWidth: 1.5)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(auth.userEmail ?? "Signed-in user")
                                .font(.headline).foregroundStyle(Theme.Color.fg)
                            Text("Tap to view profile").font(.caption).foregroundStyle(Theme.Color.fg3)
                        }
                    }
                }
            }

            Section("Engines") {
                NavigationLink(value: SettingsDestination.textEngine) {
                    Label("Text Engine", systemImage: "text.bubble")
                }
                NavigationLink(value: SettingsDestination.imageEngine) {
                    Label("Image Engine", systemImage: "photo.stack")
                }
                NavigationLink(value: SettingsDestination.memoryEngine) {
                    Label("Memory", systemImage: "brain")
                }
                NavigationLink(value: SettingsDestination.voice) {
                    Label("Voice", systemImage: "waveform")
                }
            }

            Section("Writing") {
                NavigationLink(value: SettingsDestination.roleplay) {
                    Label("Roleplay", systemImage: "theatermasks")
                }
                NavigationLink(value: SettingsDestination.writingStyles) {
                    Label("Writing styles", systemImage: "pencil.and.outline")
                }
                NavigationLink(value: SettingsDestination.grammar) {
                    Label("Grammar", systemImage: "checkmark.bubble")
                }
            }

            Section("App") {
                NavigationLink(value: SettingsDestination.privacy) {
                    Label("Privacy & Data", systemImage: "lock.shield")
                }
                NavigationLink(value: SettingsDestination.about) {
                    Label("About", systemImage: "info.circle")
                }
            }

            Section {
                Button(role: .destructive) {
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
        .navigationDestination(for: SettingsDestination.self) { dest in
            SettingsSectionPlaceholder(destination: dest)
        }
    }
}

enum SettingsDestination: Hashable {
    case profile
    case textEngine, imageEngine, memoryEngine, voice
    case roleplay, writingStyles, grammar
    case privacy, about

    var title: String {
        switch self {
        case .profile: return "Profile"
        case .textEngine: return "Text Engine"
        case .imageEngine: return "Image Engine"
        case .memoryEngine: return "Memory"
        case .voice: return "Voice"
        case .roleplay: return "Roleplay"
        case .writingStyles: return "Writing styles"
        case .grammar: return "Grammar"
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
