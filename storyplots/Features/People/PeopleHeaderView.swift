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

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("People")
                        .font(Theme.FontStyle.h2)
                        .foregroundStyle(Theme.Color.fg)
                    Text(countLabel)
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.fg3)
                }
                Spacer(minLength: 0)
                Button {
                    Haptics.impact(.medium)
                    onCreate()
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
        .background(
            LinearGradient(
                colors: [Theme.Color.brand1.opacity(0.15), Color.clear],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 160)
            .frame(maxWidth: .infinity, alignment: .top)
            .ignoresSafeArea(edges: .top)
        )
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
                        .foregroundStyle(filter == f ? Theme.Color.fgOnBrand : Theme.Color.fg1)
                        .background(
                            filter == f
                                ? AnyShapeStyle(Theme.Color.brandGradient)
                                : AnyShapeStyle(Theme.Material.chip),
                            in: Capsule()
                        )
                        .overlay(
                            Capsule().stroke(filter == f ? Color.clear : Theme.Color.borderSoft, lineWidth: 1)
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
