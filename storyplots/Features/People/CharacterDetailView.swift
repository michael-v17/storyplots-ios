import SwiftUI
import Supabase

/// Read-only landing for a character (per `seed/open-questions.md` Q5.3 default).
/// The "Edit" toolbar item pushes a real `CharacterEditView` in Phase 6.
struct CharacterDetailView: View {
    let character: Character
    let accent: Color
    let avatarRef: String?
    let client: SupabaseClient
    let onChanged: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.s5) {
                heroHeader

                if let scenario = character.scenario, !scenario.isEmpty {
                    section(title: "Scenario", body: scenario)
                }

                if let prompt = character.system_prompt, !prompt.isEmpty {
                    section(title: "System prompt", body: prompt)
                }

                identitySection
            }
            .padding(Theme.Spacing.s4)
            .padding(.bottom, Theme.Spacing.s12)
        }
        .background(Theme.Color.bg)
        .navigationTitle(character.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    CharacterEditView(
                        client: client,
                        character: character,
                        onSaved: onChanged,
                        onDeleted: onChanged
                    )
                } label: {
                    Text("Edit").foregroundStyle(Theme.Color.brand1)
                }
            }
        }
    }

    private var heroHeader: some View {
        HStack(spacing: Theme.Spacing.s4) {
            AvatarView(
                avatarRef: avatarRef,
                name: character.name,
                accent: accent,
                size: 96,
                ringWidth: 2.5
            )
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text(character.name)
                    .font(Theme.FontStyle.h2)
                    .foregroundStyle(Theme.Color.fg)
                if let tagline = character.tagline, !tagline.isEmpty {
                    Text(tagline)
                        .font(.callout)
                        .foregroundStyle(Theme.Color.fg2)
                }
            }
            Spacer(minLength: 0)
        }
    }

    private var identitySection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("Identity").sectionLabel()
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                row("Mode", character.mode?.replacingOccurrences(of: "_", with: " ").capitalized)
                row("Age", character.age)
                row("Gender", character.gender?.replacingOccurrences(of: "_", with: " ").capitalized)
            }
            .padding(Theme.Spacing.s3)
            .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
        }
    }

    @ViewBuilder
    private func row(_ key: String, _ value: String?) -> some View {
        if let value, !value.isEmpty {
            HStack {
                Text(key).foregroundStyle(Theme.Color.fg3)
                Spacer()
                Text(value).foregroundStyle(Theme.Color.fg1)
            }
            .font(.subheadline)
        }
    }

    private func section(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(title).sectionLabel()
            Text(body)
                .font(.callout)
                .foregroundStyle(Theme.Color.fg1)
                .padding(Theme.Spacing.s3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
        }
    }
}
