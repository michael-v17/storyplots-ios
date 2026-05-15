import SwiftUI
import Supabase

/// Read-only list of memory chunks the backend has extracted for this
/// conversation. Per seed `api-contract.md` §4.1 we only ever read or
/// delete here — the backend handles writes via `memory_extract`.
struct MemoryPanelView: View {
    let conversationID: String
    let client: SupabaseClient

    @State private var chunks: [MemoryChunk] = []
    @State private var loadState: LoadState = .idle
    @Environment(\.dismiss) private var dismiss

    enum LoadState: Sendable, Equatable {
        case idle, loading, loaded, error(String)
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Memory")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                    if !chunks.isEmpty {
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
            VStack(spacing: Theme.Spacing.s2) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(Theme.Color.destructive)
                Text(m).font(Theme.FontStyle.meta).foregroundStyle(Theme.Color.fg2)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .loaded where chunks.isEmpty:
            EmptyStateView(
                systemImage: "brain",
                title: "No memory yet",
                message: "After a few exchanges, the assistant will start recalling key facts here."
            )
        case .loaded:
            List {
                ForEach(chunks) { chunk in
                    VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                        Text(chunk.text)
                            .font(Theme.FontStyle.body)
                            .foregroundStyle(Theme.Color.fg)
                        if let ts = chunk.token_estimate {
                            Text("~\(ts) tokens").font(Theme.FontStyle.timestamp).foregroundStyle(Theme.Color.fg3)
                        }
                    }
                    .padding(.vertical, Theme.Spacing.s1)
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            Haptics.notify(.warning)
                            Task { await delete(chunk) }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            }
        }
    }

    private func load() async {
        loadState = .loading
        do {
            let rows: [MemoryChunk] = try await client
                .from("memory_document_chunks")
                .select("id, conversation_id, text, token_estimate, chunk_index, created_at")
                .eq("conversation_id", value: conversationID)
                .order("created_at", ascending: false)
                .execute()
                .value
            chunks = rows
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }

    private func delete(_ chunk: MemoryChunk) async {
        do {
            try await client
                .from("memory_document_chunks")
                .delete()
                .eq("id", value: chunk.id)
                .execute()
            chunks.removeAll { $0.id == chunk.id }
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }

    private func clearAll() async {
        do {
            try await client
                .from("memory_document_chunks")
                .delete()
                .eq("conversation_id", value: conversationID)
                .execute()
            chunks = []
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }
}
