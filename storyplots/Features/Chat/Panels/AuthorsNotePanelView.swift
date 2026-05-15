import SwiftUI
import Supabase

/// Upserts the per-conversation Author's Note. Schema: `authors_notes`
/// with `conversation_id` as the natural primary key.
struct AuthorsNotePanelView: View {
    let conversationID: String
    let client: SupabaseClient

    @State private var notesText: String = ""
    @State private var depth: Int = 4
    @State private var loadState: LoadState = .idle
    @State private var saving: Bool = false
    @State private var error: String?
    @Environment(\.dismiss) private var dismiss

    enum LoadState: Sendable, Equatable {
        case idle, loading, loaded, error(String)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Note") {
                    TextEditor(text: $notesText)
                        .frame(minHeight: 200)
                    Text("\(notesText.count) characters")
                        .font(Theme.FontStyle.timestamp)
                        .foregroundStyle(Theme.Color.fg3)
                }
                Section("Injection depth") {
                    Stepper(value: $depth, in: 1...12) {
                        Text("After last \(depth) messages")
                    }
                }
                if let error {
                    Section { Text(error).foregroundStyle(Theme.Color.destructive) }
                }
                Section {
                    Text("Injected right before the model generates, so the assistant keeps these instructions present in the freshest context window.")
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.fg3)
                }
            }
            .navigationTitle("Author's Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Saving…" : "Save") {
                        Task { await save() }
                    }
                    .disabled(saving || loadState == .loading)
                }
            }
            .task { await load() }
        }
        .presentationDetents([.large])
    }

    private func load() async {
        loadState = .loading
        do {
            struct Row: Decodable {
                let notes_text: String?
                let injection_depth: Int?
            }
            let rows: [Row] = try await client
                .from("authors_notes")
                .select("notes_text, injection_depth")
                .eq("conversation_id", value: conversationID)
                .limit(1)
                .execute()
                .value
            if let row = rows.first {
                notesText = row.notes_text ?? ""
                depth = row.injection_depth ?? 4
            }
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        do {
            struct Payload: Encodable {
                let conversation_id: String
                let notes_text: String
                let injection_depth: Int
            }
            try await client
                .from("authors_notes")
                .upsert(
                    Payload(conversation_id: conversationID, notes_text: notesText, injection_depth: depth),
                    onConflict: "conversation_id"
                )
                .execute()
            Haptics.notify(.success)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
