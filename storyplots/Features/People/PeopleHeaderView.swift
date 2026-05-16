import SwiftUI

/// Filter mode for the People tab — drives the pills row in the header and
/// is consumed by `PeopleViewModel.filtered`.
enum PeopleFilter: String, CaseIterable, Identifiable, Sendable {
    case all = "All"
    case recent = "Recent"
    case favorites = "Favorites"

    var id: String { rawValue }
}

/// Custom People header — title + count badge + create button + filter
/// pills sitting on a subtle brand-gradient wash. Replaces the stock
/// `.navigationTitle("People")` large-title layout.
struct PeopleHeaderView: View {
    let characterCount: Int
    @Binding var filter: PeopleFilter
    let onCreate: () -> Void
    let onGenerate: () -> Void
    let onImport: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Characters")
                        .font(Theme.FontStyle.h2)
                        .foregroundStyle(Theme.Color.fg)
                    Text(countLabel)
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.fg3)
                }
                Spacer(minLength: 0)
                Menu {
                    Button {
                        Haptics.impact(.medium)
                        onCreate()
                    } label: {
                        Label("Manual create", systemImage: "person.crop.circle.badge.plus")
                    }
                    Button {
                        Haptics.impact(.medium)
                        onGenerate()
                    } label: {
                        Label("Generate with AI", systemImage: "wand.and.stars")
                    }
                    Button {
                        Haptics.impact(.medium)
                        onImport()
                    } label: {
                        Label("Import from PNG card", systemImage: "square.and.arrow.down")
                    }
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Theme.Color.fgOnBrand)
                        .frame(width: 38, height: 38)
                        .background(Theme.Color.brandGradient, in: Circle())
                        .shadow(color: Theme.Color.brand2.opacity(0.4), radius: 8, y: 3)
                }
                .buttonStyle(.plain)
            }

            filterPills
        }
        .padding(.horizontal, Theme.Spacing.s4)
        .padding(.top, Theme.Spacing.s5)
        .padding(.bottom, Theme.Spacing.s3)
    }

    private var filterPills: some View {
        HStack(spacing: Theme.Spacing.s2) {
            ForEach(PeopleFilter.allCases) { f in
                Button {
                    Haptics.selection()
                    filter = f
                } label: {
                    Text(f.rawValue)
                        .font(Theme.FontStyle.timestamp.weight(.semibold))
                        .padding(.horizontal, Theme.Spacing.s3)
                        .padding(.vertical, Theme.Spacing.s2)
                        .foregroundStyle(filter == f ? Theme.Color.brand1 : Theme.Color.fg1)
                        .background(
                            filter == f
                                ? AnyShapeStyle(Theme.Color.brand1.opacity(0.18))
                                : AnyShapeStyle(Theme.Material.chip),
                            in: Capsule()
                        )
                        .overlay(
                            Capsule().stroke(
                                filter == f ? Theme.Color.brand1.opacity(0.55) : Theme.Color.borderSoft,
                                lineWidth: 1
                            )
                        )
                }
                .buttonStyle(.plain)
            }
            Spacer(minLength: 0)
        }
    }

    private var countLabel: String {
        switch characterCount {
        case 0:  return "Build your cast."
        case 1:  return "1 character"
        default: return "\(characterCount) characters"
        }
    }
}
