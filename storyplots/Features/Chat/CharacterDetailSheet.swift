import SwiftUI
import Supabase

/// Sheet presented from `ChatView`'s tappable principal toolbar item. Surfaces
/// the character's avatar (tappable → fullscreen viewer), name, tagline,
/// scenario, and a brand-gradient "Edit character" CTA that pushes the editor.
struct CharacterDetailSheet: View {
    let character: Character
    let accent: Color
    let avatarRef: String?
    let client: SupabaseClient
    let onClose: () -> Void

    @State private var showAvatarFullscreen: Bool = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Theme.Spacing.s5) {
                    avatar
                    nameBlock
                    if let scenario = character.scenario, !scenario.isEmpty {
                        scenarioCard(scenario)
                    }
                    editCTA
                }
                .padding(.horizontal, Theme.Spacing.s4)
                .padding(.vertical, Theme.Spacing.s5)
            }
            .background(Theme.Color.bg)
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { onClose() }
                        .foregroundStyle(Theme.Color.brand1)
                }
            }
        }
        .fullScreenCover(isPresented: $showAvatarFullscreen) {
            AvatarFullscreenViewer(avatarRef: avatarRef) {
                showAvatarFullscreen = false
            }
        }
    }

    private var avatar: some View {
        Button {
            guard avatarRef != nil else { return }
            Haptics.impact(.light)
            showAvatarFullscreen = true
        } label: {
            AvatarView(
                avatarRef: avatarRef,
                name: character.name,
                accent: accent,
                size: 132,
                ringWidth: 2.5
            )
        }
        .buttonStyle(.plain)
        .disabled(avatarRef == nil)
        .accessibilityLabel("View character avatar")
    }

    private var nameBlock: some View {
        VStack(spacing: 4) {
            Text(character.name)
                .font(Theme.FontStyle.h2)
                .foregroundStyle(Theme.Color.fg)
                .multilineTextAlignment(.center)
            if let tagline = character.tagline, !tagline.isEmpty {
                Text(tagline)
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg2)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private func scenarioCard(_ body: String) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("SCENARIO")
                .font(Theme.FontStyle.sectionLabel)
                .foregroundStyle(accent)
            Text(body)
                .font(Theme.FontStyle.body)
                .foregroundStyle(Theme.Color.fg1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s4)
        .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .strokeBorder(accent.opacity(0.25), lineWidth: 1)
        )
    }

    private var editCTA: some View {
        NavigationLink {
            CharacterEditView(
                client: client,
                character: character,
                onSaved: { onClose() },
                onDeleted: { onClose() }
            )
        } label: {
            HStack(spacing: Theme.Spacing.s2) {
                Image(systemName: "square.and.pencil")
                Text("Edit character")
            }
            .font(Theme.FontStyle.body.weight(.semibold))
            .foregroundStyle(Theme.Color.fgOnBrand)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Spacing.s3)
            .background(Theme.Color.brandGradient, in: Capsule())
        }
        .buttonStyle(.plain)
    }
}
