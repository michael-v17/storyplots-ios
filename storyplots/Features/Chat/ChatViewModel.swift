import Foundation
import Observation
import OSLog
import SwiftUI
import Supabase

private let chatLog = Logger(subsystem: "com.storyplots.ios", category: "chat-stream")

@MainActor
@Observable
final class ChatViewModel {
    enum LoadState: Sendable, Equatable {
        case idle
        case loading
        case loaded
        case error(String)
    }

    enum StreamState: Sendable, Equatable {
        case idle
        case streaming
        case error(String)
    }

    let conversationID: String
    let character: Character?
    let accent: SwiftUI.Color
    let avatarURL: URL?

    private(set) var loadState: LoadState = .idle
    private(set) var streamState: StreamState = .idle
    private(set) var items: [MessageItem] = []

    /// Soft alert when grammar_error or rewrite_required surfaces.
    private(set) var transientNotice: String?

    private let client: SupabaseClient
    private var streamTask: Task<Void, Never>?

    init(conversationID: String, character: Character?, accent: SwiftUI.Color, avatarURL: URL?, client: SupabaseClient) {
        self.conversationID = conversationID
        self.character = character
        self.accent = accent
        self.avatarURL = avatarURL
        self.client = client
    }

    // Stream cancellation on dismissal is handled via .task { } lifecycle in ChatView.

    var characterName: String { character?.name ?? "Character" }

    var isStreaming: Bool {
        if case .streaming = streamState { return true }
        return false
    }

    func load() async {
        loadState = .loading
        do {
            let messages: [Message] = try await client
                .from("messages")
                .select("id, conversation_id, role, text, active_variant_id, created_at, edited_at")
                .eq("conversation_id", value: conversationID)
                .order("created_at", ascending: true)
                .execute()
                .value

            let variantIDs = messages.compactMap(\.active_variant_id)
            var variantsByID: [String: MessageVariant] = [:]
            if !variantIDs.isEmpty {
                let variants: [MessageVariant] = try await client
                    .from("message_variants")
                    .select("id, message_id, content, created_at")
                    .in("id", values: variantIDs)
                    .execute()
                    .value
                variantsByID = Dictionary(uniqueKeysWithValues: variants.map { ($0.id, $0) })
            }

            self.items = messages.map { MessageItem(message: $0, activeVariant: $0.active_variant_id.flatMap { variantsByID[$0] }) }
            self.loadState = .loaded
        } catch {
            self.loadState = .error(error.localizedDescription)
        }
    }

    /// Send a user message: insert the user row in Supabase first (so the
    /// backend can find it during prompt assembly), then POST `/chat` and
    /// consume the SSE stream into a placeholder assistant bubble.
    func send(_ raw: String) {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isStreaming else { return }

        streamState = .streaming
        transientNotice = nil

        streamTask = Task { [weak self] in
            await self?.runSend(text)
        }
    }

    func cancelStream() {
        streamTask?.cancel()
        streamTask = nil
        streamState = .idle
    }

    private func runSend(_ text: String) async {
        chatLog.info("send begin conversation=\(self.conversationID, privacy: .public) length=\(text.count)")
        // 1. Insert the user message via Supabase so the backend can read it
        //    during prompt assembly.
        do {
            let insertPayload = ["conversation_id": conversationID, "role": "user", "text": text]
            let inserted: [Message] = try await client
                .from("messages")
                .insert(insertPayload)
                .select("id, conversation_id, role, text, active_variant_id, created_at, edited_at")
                .execute()
                .value
            if let userRow = inserted.first {
                let item = MessageItem(message: userRow, activeVariant: nil)
                items.append(item)
                chatLog.info("user message inserted id=\(userRow.id, privacy: .public)")
            }
        } catch {
            chatLog.error("user insert failed: \(error.localizedDescription, privacy: .public)")
            streamState = .error("Couldn't save your message: \(error.localizedDescription)")
            return
        }

        // 2. Build the authenticated /chat request.
        let request: URLRequest
        do {
            request = try await makeChatRequest()
        } catch {
            chatLog.error("makeChatRequest failed: \(error.localizedDescription, privacy: .public)")
            streamState = .error("Couldn't start the stream: \(error.localizedDescription)")
            return
        }

        // 3. Consume the SSE stream.
        var assistantPlaceholderIndex: Int?
        var buffer = ""

        do {
            let stream = URLSession.shared.eventStream(for: request)
            for try await event in stream {
                try Task.checkCancellation()
                switch event {
                case let .start(messageID, variantID):
                    chatLog.info("stream start message=\(messageID, privacy: .public) variant=\(variantID, privacy: .public)")
                    let placeholder = MessageItem(
                        id: messageID,
                        role: .assistant,
                        body: "",
                        createdAt: ISO8601DateFormatter().string(from: Date())
                    )
                    items.append(placeholder)
                    assistantPlaceholderIndex = items.count - 1
                case let .token(text):
                    buffer += text
                    if let idx = assistantPlaceholderIndex, idx < items.count {
                        items[idx] = MessageItem(
                            id: items[idx].id,
                            role: .assistant,
                            body: buffer,
                            createdAt: items[idx].createdAt
                        )
                    }
                case .correction:
                    chatLog.info("correction received")
                    transientNotice = "Grammar correction received."
                case .rewriteRequired:
                    chatLog.info("rewrite required")
                    transientNotice = "Rewrite required by grammar settings."
                case let .grammarError(message):
                    chatLog.info("grammar error: \(message, privacy: .public)")
                    transientNotice = "Grammar agent: \(message)"
                case let .error(message):
                    chatLog.error("stream error: \(message, privacy: .public)")
                    streamState = .error(message)
                    if let idx = assistantPlaceholderIndex, idx < items.count {
                        items.remove(at: idx)
                    }
                    return
                case let .done(messageID, variantID):
                    chatLog.info("stream done message=\(messageID, privacy: .public) variant=\(variantID, privacy: .public) tokens=\(buffer.count)")
                    streamState = .idle
                    return
                }
            }
            chatLog.info("stream ended without done; buffered=\(buffer.count)")
            streamState = .idle
        } catch is CancellationError {
            chatLog.info("stream canceled")
            streamState = .idle
        } catch {
            chatLog.error("stream threw: \(error.localizedDescription, privacy: .public)")
            streamState = .error(error.localizedDescription)
        }
    }

    private func makeChatRequest() async throws -> URLRequest {
        // Pull the live Supabase JWT so the backend can authenticate.
        let session = try await client.auth.session
        let jwt = session.accessToken

        var request = URLRequest(url: BackendConfig.url.appendingPathComponent("chat"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = [
            "conversation_id": conversationID
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return request
    }
}

private extension MessageItem {
    init(id: String, role: MessageRole, body: String, createdAt: String) {
        // Build directly without the `Message` round-trip for streaming placeholders.
        self.id = id
        self.role = role
        self.body = body
        self.createdAt = createdAt
    }
}
