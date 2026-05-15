import SwiftUI
import Supabase

/// Fork sheet (`.medium`). Picks `keep_messages` vs `summarize_fresh`,
/// optional title, then POSTs `/conversations/{id}/fork`. On success
/// returns the new conversation id to the caller.
struct ForkDialog: View {
    let conversationID: String
    let anchorMessageID: String
    let client: SupabaseClient
    let onForked: (String) -> Void

    enum Mode: String, CaseIterable, Identifiable {
        case keepMessages = "keep_messages"
        case summarizeFresh = "summarize_fresh"
        var id: String { rawValue }
        var label: String {
            switch self {
            case .keepMessages: return "Keep messages"
            case .summarizeFresh: return "Summarize fresh"
            }
        }
        var hint: String {
            switch self {
            case .keepMessages:
                return "Copies every message up to this point into a new conversation."
            case .summarizeFresh:
                return "Summarizes the conversation so far and starts a new branch with the summary as context. Takes a few seconds."
            }
        }
    }

    @Environment(\.dismiss) private var dismiss
    @State private var mode: Mode = .keepMessages
    @State private var title: String = ""
    @State private var phase: Phase = .idle

    enum Phase: Sendable, Equatable {
        case idle, forking, error(String)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Branch mode") {
                    Picker("Mode", selection: $mode) {
                        ForEach(Mode.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    Text(mode.hint)
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.fg3)
                }

                Section("Title (optional)") {
                    TextField("New branch title", text: $title)
                }

                if case .error(let m) = phase {
                    Section {
                        Text(m).foregroundStyle(Theme.Color.destructive).font(Theme.FontStyle.meta)
                    }
                }

                if mode == .summarizeFresh, case .forking = phase {
                    Section {
                        HStack {
                            ProgressView().tint(Theme.Color.brand1)
                            Text("Summarizing the conversation so far…")
                                .font(Theme.FontStyle.meta)
                                .foregroundStyle(Theme.Color.fg2)
                        }
                    }
                }
            }
            .navigationTitle("Fork from here")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Confirm") {
                        Task { await runFork() }
                    }
                    .disabled(phase == .forking)
                }
            }
            .interactiveDismissDisabled(phase == .forking)
        }
        .presentationDetents([.medium])
    }

    private func runFork() async {
        phase = .forking
        do {
            let session = try await client.auth.session
            var req = URLRequest(url: BackendConfig.url
                .appendingPathComponent("conversations")
                .appendingPathComponent(conversationID)
                .appendingPathComponent("fork"))
            req.httpMethod = "POST"
            req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            var body: [String: Any] = [
                "message_id": anchorMessageID,
                "mode": mode.rawValue
            ]
            let trimmed = title.trimmingCharacters(in: .whitespaces)
            if !trimmed.isEmpty { body["title"] = trimmed }
            req.httpBody = try JSONSerialization.data(withJSONObject: body)

            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                phase = .error("Fork failed (HTTP \(code))")
                return
            }
            struct ForkResponse: Decodable {
                let conversation_id: String
                let title: String?
                let branch_mode: String?
            }
            let parsed = try JSONDecoder().decode(ForkResponse.self, from: data)
            onForked(parsed.conversation_id)
            dismiss()
        } catch {
            phase = .error(error.localizedDescription)
        }
    }
}
