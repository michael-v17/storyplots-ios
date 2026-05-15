import SwiftUI

/// About — wordmark + version + privacy + credits. Reachable from
/// Settings → App → About.
struct AboutView: View {
    private var version: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(v) (\(build))"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.s6) {
                wordmarkBlock
                    .padding(.top, Theme.Spacing.s8)

                versionBlock

                aboutBlock

                creditsBlock
            }
            .padding(.horizontal, Theme.Spacing.s4)
            .padding(.bottom, Theme.Spacing.s10)
        }
        .background(Theme.Color.bg)
        .brandTopWash()
        .navigationTitle("About")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
    }

    private var wordmarkBlock: some View {
        VStack(spacing: Theme.Spacing.s3) {
            Image("Wordmark")
                .resizable()
                .scaledToFit()
                .frame(maxHeight: 96)
                .accessibilityLabel("StoryPlots")
            Text("Stories worth telling.")
                .font(Theme.FontStyle.subhead)
                .foregroundStyle(Theme.Color.fg2)
        }
    }

    private var versionBlock: some View {
        VStack(spacing: Theme.Spacing.s1) {
            Text("Version")
                .font(Theme.FontStyle.sectionLabel)
                .foregroundStyle(Theme.Color.fg3)
            Text(version)
                .font(Theme.FontStyle.body.monospaced())
                .foregroundStyle(Theme.Color.fg)
        }
    }

    private var aboutBlock: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("StoryPlots is a private writing companion for character-driven roleplay. Your characters, conversations, and prompts stay yours.")
                .font(Theme.FontStyle.body)
                .foregroundStyle(Theme.Color.fg1)
                .multilineTextAlignment(.leading)
        }
        .padding(Theme.Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
    }

    private var creditsBlock: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("Credits")
                .font(Theme.FontStyle.sectionLabel)
                .foregroundStyle(Theme.Color.fg3)
            Text("Built with SwiftUI, supabase-swift, and the StoryPlots backend. Image generation runs against your own provider; text generation against the model you configure in Engine → Text Engine.")
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.fg2)
        }
        .padding(Theme.Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
    }
}
