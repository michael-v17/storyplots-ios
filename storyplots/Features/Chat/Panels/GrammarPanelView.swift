import SwiftUI
import Supabase

/// Read-only list of grammar corrections written by the Grammar Agent
/// for this conversation.
struct GrammarPanelView: View {
    let conversationID: String
    let client: SupabaseClient

    @State private var rows: [GrammarCorrection] = []
    @State private var loadState: LoadState = .idle
    @Environment(\.dismiss) private var dismiss

    enum LoadState: Sendable, Equatable {
        case idle, loading, loaded, error(String)
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Grammar")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                    if !rows.isEmpty {
                        ToolbarItem(placement: .topBarLeading) {
                            Button(role: .destructive) {
                                Haptics.notify(.warning)
                                Task { await clearAll() }
                            } label: {
                                Image(systemName: "trash").tint(Theme.Color.destructive)
                            }
                        }
                    }
                }
                .task { await load() }
        }
        .presentationDetents([.large])
    }

    @ViewBuilder
    private var content: some View {
        switch loadState {
        case .idle, .loading:
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case .error(let m):
            Text(m).font(Theme.FontStyle.meta).foregroundStyle(Theme.Color.destructive)
        case .loaded where rows.isEmpty:
            EmptyStateView(
                systemImage: "checkmark.bubble.fill",
                title: "Clean slate",
                message: "No grammar corrections logged for this conversation."
            )
        case .loaded:
            List(rows) { row in
                VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                    if let original = row.original_text, !original.isEmpty {
                        Text("Original: \(original)")
                            .font(Theme.FontStyle.meta)
                            .foregroundStyle(Theme.Color.fg3)
                    }
                    if let corrected = row.corrected_text, !corrected.isEmpty {
                        Text(corrected)
                            .font(Theme.FontStyle.body)
                            .foregroundStyle(Theme.Color.fg)
                    }
                    if let explanation = row.explanation, !explanation.isEmpty {
                        Text(explanation)
                            .font(Theme.FontStyle.timestamp)
                            .foregroundStyle(Theme.Color.fg2)
                    }
                    if let cats = row.error_categories, !cats.isEmpty {
                        HStack(spacing: Theme.Spacing.s1) {
                            ForEach(cats, id: \.self) { c in
                                Text(c)
                                    .font(Theme.FontStyle.timestamp)
                                    .padding(.horizontal, Theme.Spacing.s2)
                                    .padding(.vertical, 2)
                                    .background(Theme.Color.warningSoft, in: Capsule())
                                    .foregroundStyle(Theme.Color.warning)
                            }
                        }
                    }
                }
                .padding(.vertical, Theme.Spacing.s1)
            }
        }
    }

    private func load() async {
        loadState = .loading
        do {
            let result: [GrammarCorrection] = try await client
                .from("grammar_corrections")
                .select("id, conversation_id, user_message_id, original_text, corrected_text, explanation, error_categories, edit_distance, created_at")
                .eq("conversation_id", value: conversationID)
                .order("created_at", ascending: false)
                .execute()
                .value
            rows = result
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }

    private func clearAll() async {
        do {
            try await client
                .from("grammar_corrections")
                .delete()
                .eq("conversation_id", value: conversationID)
                .execute()
            rows = []
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }
}
