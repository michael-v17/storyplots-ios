import SwiftUI
import Supabase

/// Full CRUD over `lorebook_entries` scoped to the active conversation.
struct LorebookPanelView: View {
    let conversationID: String
    let client: SupabaseClient

    @State private var entries: [LorebookEntry] = []
    @State private var loadState: LoadState = .idle
    @State private var editing: LorebookEntry?
    @State private var showingNew: Bool = false
    @Environment(\.dismiss) private var dismiss

    enum LoadState: Sendable, Equatable {
        case idle, loading, loaded, error(String)
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Lorebook")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            Haptics.impact(.light)
                            showingNew = true
                        } label: {
                            Image(systemName: "plus").foregroundStyle(Theme.Color.brand1)
                        }
                    }
                }
                .task { await load() }
                .sheet(isPresented: $showingNew) {
                    LorebookEntryEditor(
                        conversationID: conversationID,
                        client: client,
                        entry: nil,
                        onSaved: { Task { await load() } }
                    )
                }
                .sheet(item: $editing) { entry in
                    LorebookEntryEditor(
                        conversationID: conversationID,
                        client: client,
                        entry: entry,
                        onSaved: { Task { await load() } }
                    )
                }
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
        case .loaded where entries.isEmpty:
            EmptyStateView(
                systemImage: "book.closed.fill",
                title: "Empty lorebook",
                message: "Add entries the assistant should remember when matching keywords appear.",
                actionTitle: "New entry",
                onAction: { showingNew = true }
            )
        case .loaded:
            List {
                ForEach(entries) { entry in
                    Button {
                        Haptics.impact(.light)
                        editing = entry
                    } label: {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                            Text(entry.title).font(.headline).foregroundStyle(Theme.Color.fg)
                            if let kws = entry.keywords, !kws.isEmpty {
                                Text(kws.joined(separator: " · "))
                                    .font(Theme.FontStyle.timestamp)
                                    .foregroundStyle(Theme.Color.fg3)
                            }
                            Text(entry.body)
                                .font(Theme.FontStyle.meta)
                                .foregroundStyle(Theme.Color.fg2)
                                .lineLimit(2)
                        }
                        .padding(.vertical, Theme.Spacing.s1)
                    }
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            Haptics.notify(.warning)
                            Task { await delete(entry) }
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
            let rows: [LorebookEntry] = try await client
                .from("lorebook_entries")
                .select("id, conversation_id, title, keywords, body, token_estimate, enabled")
                .eq("conversation_id", value: conversationID)
                .order("title", ascending: true)
                .execute()
                .value
            entries = rows
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }

    private func delete(_ entry: LorebookEntry) async {
        do {
            try await client
                .from("lorebook_entries")
                .delete()
                .eq("id", value: entry.id)
                .execute()
            entries.removeAll { $0.id == entry.id }
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }
}

private struct LorebookEntryEditor: View {
    let conversationID: String
    let client: SupabaseClient
    let entry: LorebookEntry?
    let onSaved: () -> Void

    @State private var title: String = ""
    @State private var keywords: String = ""
    @State private var bodyText: String = ""
    @State private var saving: Bool = false
    @State private var error: String?
    @Environment(\.dismiss) private var dismiss

    var isEditing: Bool { entry != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section("Title") {
                    TextField("Name of this entry", text: $title)
                }
                Section("Keywords") {
                    TextField("Comma-separated triggers", text: $keywords)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                }
                Section("Body") {
                    TextEditor(text: $bodyText)
                        .frame(minHeight: 160)
                }
                if let error {
                    Text(error).foregroundStyle(Theme.Color.destructive)
                }
            }
            .navigationTitle(isEditing ? "Edit entry" : "New entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Saving…" : "Save") {
                        Task { await save() }
                    }
                    .disabled(saving || title.trimmingCharacters(in: .whitespaces).isEmpty || bodyText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                if let e = entry {
                    title = e.title
                    keywords = (e.keywords ?? []).joined(separator: ", ")
                    bodyText = e.body
                }
            }
        }
        .presentationDetents([.large])
    }

    private func save() async {
        saving = true
        defer { saving = false }
        let kws = keywords
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        do {
            if let e = entry {
                struct Update: Encodable {
                    let title: String
                    let keywords: [String]
                    let body: String
                }
                try await client
                    .from("lorebook_entries")
                    .update(Update(title: title, keywords: kws, body: bodyText))
                    .eq("id", value: e.id)
                    .execute()
            } else {
                let uid = try await client.auth.session.user.id.uuidString
                struct Insert: Encodable {
                    let conversation_id: String
                    let user_id: String
                    let title: String
                    let keywords: [String]
                    let body: String
                    let source: String
                    let token_estimate: Int
                }
                let payload = Insert(
                    conversation_id: conversationID,
                    user_id: uid,
                    title: title,
                    keywords: kws,
                    body: bodyText,
                    source: "manual",
                    token_estimate: Self.estimateTokens(title: title, body: bodyText, keywords: kws)
                )
                try await client
                    .from("lorebook_entries")
                    .insert(payload)
                    .execute()
            }
            Haptics.notify(.success)
            onSaved()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Cheap token estimate: ~4 chars per token, mirroring the bookkeeping the
    /// backend uses for `knowledge_budget` slicing (schema.md §2.7). Keywords
    /// are summed because each one becomes a retrieval input.
    private static func estimateTokens(title: String, body: String, keywords: [String]) -> Int {
        let total = title.count + body.count + keywords.reduce(0) { $0 + $1.count }
        return max(1, total / 4)
    }
}
