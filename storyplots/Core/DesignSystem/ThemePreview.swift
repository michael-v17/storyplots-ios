import SwiftUI

/// Visual reference of the design system. Used as a `#Preview` to satisfy the
/// Phase 0 Liquid Glass gate ("ThemePreview shows each material visible").
struct ThemePreview: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.s6) {
                surfacesSection
                semanticSection
                accentPresetsSection
                typographySection
                spacingSection
                materialsSection
            }
            .padding(Theme.Spacing.s4)
        }
        .background(Theme.Color.bg)
        .preferredColorScheme(.dark)
    }

    private var surfacesSection: some View {
        section(title: "Surfaces") {
            HStack(spacing: Theme.Spacing.s2) {
                swatch(Theme.Color.bg,      label: "bg")
                swatch(Theme.Color.bg1,     label: "bg1")
                swatch(Theme.Color.bg2,     label: "bg2")
                swatch(Theme.Color.bg3,     label: "bg3")
                swatch(Theme.Color.bgInset, label: "inset")
            }
        }
    }

    private var semanticSection: some View {
        section(title: "Semantic") {
            HStack(spacing: Theme.Spacing.s2) {
                swatch(Theme.Color.brand1,      label: "brand1")
                swatch(Theme.Color.brand2,      label: "brand2")
                swatch(Theme.Color.success,     label: "success")
                swatch(Theme.Color.warning,     label: "warning")
                swatch(Theme.Color.destructive, label: "destructive")
            }
        }
    }

    private var accentPresetsSection: some View {
        section(title: "Accent presets (16)") {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Theme.Spacing.s2), count: 8),
                      spacing: Theme.Spacing.s2) {
                ForEach(Array(Theme.Color.AccentPreset.all.enumerated()), id: \.offset) { _, color in
                    Circle()
                        .fill(color)
                        .frame(height: 28)
                        .overlay(Circle().stroke(Theme.Color.border, lineWidth: 0.5))
                }
            }
        }
    }

    private var typographySection: some View {
        section(title: "Typography") {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Text("Largest Title").font(Theme.FontStyle.h1)
                Text("Title").font(Theme.FontStyle.h2)
                Text("Subhead").font(Theme.FontStyle.subhead)
                Text("Body — the quick brown fox jumps over the lazy dog.")
                    .font(Theme.FontStyle.body)
                    .foregroundStyle(Theme.Color.fg1)
                Text("section label").sectionLabel()
                Text("12:34 timestamp").font(Theme.FontStyle.timestamp).foregroundStyle(Theme.Color.fg4)
                Text("/* let mono: String */").font(Theme.FontStyle.mono).foregroundStyle(Theme.Color.fg2)
            }
        }
    }

    private var spacingSection: some View {
        section(title: "Spacing scale") {
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                spacingRow(label: "s1 / 4",  width: Theme.Spacing.s1)
                spacingRow(label: "s2 / 8",  width: Theme.Spacing.s2)
                spacingRow(label: "s3 / 12", width: Theme.Spacing.s3)
                spacingRow(label: "s4 / 16", width: Theme.Spacing.s4)
                spacingRow(label: "s6 / 24", width: Theme.Spacing.s6)
                spacingRow(label: "s8 / 32", width: Theme.Spacing.s8)
                spacingRow(label: "s12 / 48", width: Theme.Spacing.s12)
            }
        }
    }

    /// Material strip over the brand gradient — Phase 0 Liquid Glass gate.
    private var materialsSection: some View {
        section(title: "Materials over brand gradient") {
            ZStack(alignment: .leading) {
                Theme.Color.brandGradient
                    .frame(height: 240)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card))

                VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                    materialChip(Theme.Material.navBar,         label: "navBar / regularMaterial")
                    materialChip(Theme.Material.chip,           label: "chip / thinMaterial")
                    materialChip(Theme.Material.sheetCard,      label: "sheetCard / thinMaterial")
                    materialChip(Theme.Material.viewerOverlay,  label: "viewerOverlay / ultraThickMaterial")
                }
                .padding(Theme.Spacing.s4)
            }
        }
    }

    // MARK: helpers

    private func section<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(title).sectionLabel()
            content()
        }
    }

    private func swatch(_ color: SwiftUI.Color, label: String) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            RoundedRectangle(cornerRadius: Theme.Radius.card)
                .fill(color)
                .frame(height: 56)
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.card).stroke(Theme.Color.border, lineWidth: 0.5))
            Text(label).font(Theme.FontStyle.timestamp).foregroundStyle(Theme.Color.fg3)
        }
    }

    private func spacingRow(label: String, width: CGFloat) -> some View {
        HStack(spacing: Theme.Spacing.s2) {
            Text(label).font(Theme.FontStyle.timestamp).foregroundStyle(Theme.Color.fg3).frame(width: 72, alignment: .leading)
            Rectangle()
                .fill(Theme.Color.brand1)
                .frame(width: width, height: 6)
                .clipShape(Capsule())
        }
    }

    private func materialChip(_ material: SwiftUI.Material, label: String) -> some View {
        Text(label)
            .font(Theme.FontStyle.meta)
            .foregroundStyle(Theme.Color.fg)
            .padding(.horizontal, Theme.Spacing.s3)
            .padding(.vertical, Theme.Spacing.s2)
            .background(material, in: Capsule())
    }
}

#Preview {
    ThemePreview()
}
