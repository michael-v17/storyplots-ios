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
    /// Storage path in the `avatars` bucket (e.g. `{user_id}/character-{id}.webp`).
    /// `AvatarView(avatarRef:)` resolves a signed URL on demand.
    let avatarRef: String?

    private(set) var loadState: LoadState = .idle
    private(set) var streamState: StreamState = .idle
    private(set) var items: [MessageItem] = []
    /// All variants per assistant message id — backs the pagination dots.
    private(set) var variantsByMessage: [String: [MessageVariant]] = [:]
    /// All generated images per assistant message id — backs the inline image rail.
    private(set) var imagesByMessage: [String: [GeneratedImage]] = [:]
    /// Per-message image request state (loading / error) — keyed by message id.
    private(set) var imageRequestState: [String: ImageRequestState] = [:]
    /// Per-message TTS audio state — keyed by message id.
    private(set) var audioStateByMessage: [String: MessageAudioState] = [:]
    /// Grammar corrections keyed by `user_message_id`. Populated from the
    /// SSE `correction` / `rewrite_required` events and from a one-shot
    /// fetch of `grammar_corrections` on chat load — backs the inline
    /// grammar render under user bubbles.
    private(set) var corrections: [String: GrammarCorrection] = [:]
    /// Cached audio bytes by message id, so play/pause/resume doesn't re-fetch.
    private var audioCache: [String: Data] = [:]
    /// Content-type of the cached audio, used to pick the right temp file ext.
    private var audioContentType: [String: String] = [:]

    /// Soft alert when grammar_error or rewrite_required surfaces.
    private(set) var transientNotice: String?

    private let client: SupabaseClient
    private var streamTask: Task<Void, Never>?
    private let audioPlayer = MessageAudioPlayer()

    enum ImageRequestState: Sendable, Equatable {
        case idle
        case loading
        case error(String)
    }

    init(conversationID: String, character: Character?, accent: SwiftUI.Color, avatarRef: String?, client: SupabaseClient) {
        self.conversationID = conversationID
        self.character = character
        self.accent = accent
        self.avatarRef = avatarRef
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

            // Fetch ALL variants for every assistant message in this conversation —
            // powers the dots indicator + swap-between-variants.
            let assistantIDs = messages.filter { $0.role == .assistant }.map(\.id)
            var byMessage: [String: [MessageVariant]] = [:]
            var byID: [String: MessageVariant] = [:]
            if !assistantIDs.isEmpty {
                let variants: [MessageVariant] = try await client
                    .from("message_variants")
                    .select("id, message_id, content, created_at")
                    .in("message_id", values: assistantIDs)
                    .order("created_at", ascending: true)
                    .execute()
                    .value
                for v in variants {
                    byMessage[v.message_id, default: []].append(v)
                    byID[v.id] = v
                }
            }
            self.variantsByMessage = byMessage

            var items = messages
                .map { MessageItem(message: $0, activeVariant: $0.active_variant_id.flatMap { byID[$0] }) }
                // Drop dead placeholders — assistant rows the backend
                // inserted before the provider returned empty content
                // (degenerate output detector). Without this filter they
                // render as ghost bubbles in the middle of the thread,
                // even though the next real assistant reply followed.
                .filter { item in
                    if item.role == .assistant,
                       item.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        return false
                    }
                    return true
                }
            // Mark the first assistant message as the scenario card iff its
            // body matches `character.scenario` — PersonaLLM persists the
            // chosen scenario as message #0 and renders it as a distinct
            // card. We re-derive the flag at load time so legacy threads
            // without a recorded scenario stay regular bubbles.
            if let scenarioText = character?.scenario?.trimmingCharacters(in: .whitespacesAndNewlines),
               !scenarioText.isEmpty,
               let firstIdx = items.firstIndex(where: { $0.role == .assistant }) {
                let firstBody = items[firstIdx].body.trimmingCharacters(in: .whitespacesAndNewlines)
                if firstBody == scenarioText {
                    items[firstIdx].isScenario = true
                }
            }
            self.items = items

            // Generated images attached to assistant messages in this conversation.
            await loadImages()

            // Persisted grammar corrections — backs the inline render under
            // user bubbles on a fresh chat open.
            await loadGrammarCorrections()

            self.loadState = .loaded
        } catch {
            self.loadState = .error(error.localizedDescription)
        }
    }

    private func loadImages() async {
        do {
            let rows: [GeneratedImage] = try await client
                .from("generated_images")
                .select("id, user_id, character_id, conversation_id, message_id, prompt, refined_prompt, resolution_preset, dimensions, storage_ref, external_url, engine, style, sfw_blocked, created_at")
                .eq("conversation_id", value: conversationID)
                .order("created_at", ascending: true)
                .execute()
                .value
            var bucket: [String: [GeneratedImage]] = [:]
            for row in rows {
                guard let mid = row.message_id else { continue }
                bucket[mid, default: []].append(row)
            }
            self.imagesByMessage = bucket
        } catch {
            chatLog.error("loadImages failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// Returns the images attached to the given message id, or empty.
    func images(for messageID: String) -> [GeneratedImage] {
        imagesByMessage[messageID] ?? []
    }

    /// POST `/messages/{message_id}/images` and append the returned row to the
    /// local rail. `overrides` allows the Generation Override panel to pass
    /// POV / framing / resolution / style / prompt overrides for this turn.
    func requestImage(messageID: String, overrides: GenerationOverrides = GenerationOverrides()) {
        guard imageRequestState[messageID] != .loading else { return }
        imageRequestState[messageID] = .loading
        Task { [weak self] in
            await self?.runRequestImage(messageID: messageID, overrides: overrides)
        }
    }


    /// Optimistic delete of a generated image from a message in the current
    /// chat. Hits `DELETE /images/{id}` (same endpoint Gallery uses) and rolls
    /// the optimistic removal back if the request fails.
    func deleteGeneratedImage(_ image: GeneratedImage) {
        guard let messageID = image.message_id else { return }
        let snapshot = imageRequestState
        var current = imagesByMessage[messageID] ?? []
        current.removeAll { $0.id == image.id }
        imagesByMessage[messageID] = current

        Task { [weak self] in
            guard let self else { return }
            do {
                let session = try await self.client.auth.session
                let jwt = session.accessToken
                var request = URLRequest(url: BackendConfig.url
                    .appendingPathComponent("images")
                    .appendingPathComponent(image.id))
                request.httpMethod = "DELETE"
                request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
                let (_, response) = try await URLSession.shared.data(for: request)
                if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                    chatLog.error("delete image http=\(http.statusCode, privacy: .public)")
                    self.imageRequestState = snapshot
                }
            } catch {
                chatLog.error("delete image failed: \(error.localizedDescription, privacy: .public)")
                self.imageRequestState = snapshot
            }
        }
    }

    private func runRequestImage(messageID: String, overrides: GenerationOverrides) async {
        do {
            let session = try await client.auth.session
            let jwt = session.accessToken

            let url = BackendConfig.url
                .appendingPathComponent("messages")
                .appendingPathComponent(messageID)
                .appendingPathComponent("images")

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")

            var body: [String: Any] = [:]
            if let pov = overrides.pov                       { body["pov"] = pov }
            if let shot = overrides.shotFraming              { body["shot_framing"] = shot }
            if let res = overrides.resolutionPreset          { body["resolution_preset"] = res }
            if let prompt = overrides.promptOverride         { body["prompt_override"] = prompt }
            if let style = overrides.styleOverride           { body["style_override"] = style }
            request.httpBody = try JSONSerialization.data(withJSONObject: body)

            // fal can be slow; comfyui sweeper async. Give the request room.
            request.timeoutInterval = 120

            chatLog.info("image request begin message=\(messageID, privacy: .public)")
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let http = response as? HTTPURLResponse else {
                throw APIError.transport("No HTTP response")
            }
            guard (200..<300).contains(http.statusCode) else {
                let body = String(data: data, encoding: .utf8) ?? ""
                let detail = parseDetail(from: body) ?? "Request failed (\(http.statusCode))"
                chatLog.error("image request status=\(http.statusCode, privacy: .public) body=\(body, privacy: .public)")
                imageRequestState[messageID] = .error(detail)
                return
            }

            let row = try JSONDecoder().decode(GeneratedImage.self, from: data)
            chatLog.info("image request done id=\(row.id, privacy: .public) engine=\(row.engine?.rawValue ?? "?", privacy: .public)")

            imagesByMessage[messageID, default: []].append(row)
            imageRequestState[messageID] = .idle
        } catch {
            chatLog.error("image request failed: \(error.localizedDescription, privacy: .public)")
            imageRequestState[messageID] = .error(error.localizedDescription)
        }
    }

    // MARK: Audio TTS

    func audioState(for messageID: String) -> MessageAudioState {
        audioStateByMessage[messageID] ?? .idle
    }

    /// Toggle TTS for the given assistant message:
    /// - idle → fetch + play
    /// - playing → pause
    /// - paused → resume
    /// - loading → no-op (already in-flight)
    func toggleAudio(messageID: String) {
        switch audioState(for: messageID) {
        case .idle, .error:
            // If we already have bytes cached (e.g., user paused on a different
            // message), play from cache without hitting the backend again.
            if let data = audioCache[messageID] {
                playCached(data: data, messageID: messageID)
                return
            }
            audioStateByMessage[messageID] = .loading
            Task { [weak self] in
                await self?.runFetchAudio(messageID: messageID)
            }
        case .playing:
            audioPlayer.pause()
            audioStateByMessage[messageID] = .paused
        case .paused:
            audioPlayer.resume()
            audioStateByMessage[messageID] = .playing
        case .loading:
            break
        }
    }

    private func playCached(data: Data, messageID: String) {
        do {
            // Stop any other in-flight track.
            if let prev = audioPlayer.currentMessageID, prev != messageID {
                audioStateByMessage[prev] = .idle
            }
            audioPlayer.onFinish = { [weak self] mid in
                self?.audioStateByMessage[mid] = .idle
            }
            try audioPlayer.play(data, for: messageID, contentType: audioContentType[messageID])
            audioStateByMessage[messageID] = .playing
        } catch {
            chatLog.error("audio play failed: \(error.localizedDescription, privacy: .public)")
            audioStateByMessage[messageID] = .error(error.localizedDescription)
        }
    }

    private func runFetchAudio(messageID: String) async {
        do {
            let session = try await client.auth.session
            let jwt = session.accessToken

            let url = BackendConfig.url
                .appendingPathComponent("messages")
                .appendingPathComponent(messageID)
                .appendingPathComponent("audio")

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = Data() // no body
            request.timeoutInterval = 60

            chatLog.info("audio request begin message=\(messageID, privacy: .public)")
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw APIError.transport("No HTTP response")
            }
            guard (200..<300).contains(http.statusCode) else {
                let body = String(data: data, encoding: .utf8) ?? ""
                let detail = parseDetail(from: body) ?? "Audio request failed (\(http.statusCode))"
                chatLog.error("audio status=\(http.statusCode, privacy: .public) body=\(body, privacy: .public)")
                audioStateByMessage[messageID] = .error(detail)
                return
            }
            audioCache[messageID] = data
            audioContentType[messageID] = http.value(forHTTPHeaderField: "Content-Type")
            playCached(data: data, messageID: messageID)
            chatLog.info("audio request done message=\(messageID, privacy: .public) bytes=\(data.count) ct=\(self.audioContentType[messageID] ?? "?", privacy: .public)")
        } catch {
            chatLog.error("audio request failed: \(error.localizedDescription, privacy: .public)")
            audioStateByMessage[messageID] = .error(error.localizedDescription)
        }
    }

    func stopAllAudio() {
        audioPlayer.stop()
        for (k, _) in audioStateByMessage {
            audioStateByMessage[k] = .idle
        }
    }

    // MARK: Image delete

    /// Delete an image — calls backend `/images/{id}` which cascades to storage.
    func deleteImage(_ image: GeneratedImage) {
        Task { [weak self] in
            guard let self else { return }
            do {
                let session = try await self.client.auth.session
                let jwt = session.accessToken
                let url = BackendConfig.url
                    .appendingPathComponent("images")
                    .appendingPathComponent(image.id)
                var request = URLRequest(url: url)
                request.httpMethod = "DELETE"
                request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
                let (_, response) = try await URLSession.shared.data(for: request)
                if let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
                    if let mid = image.message_id {
                        self.imagesByMessage[mid]?.removeAll { $0.id == image.id }
                    }
                }
            } catch {
                chatLog.error("delete image failed: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    private func parseDetail(from body: String) -> String? {
        guard let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return json["detail"] as? String
    }

    /// Returns (currentIndex, total) for an assistant message, or nil if no variants exist.
    func variantPagination(for messageID: String, currentBody: String) -> (Int, Int)? {
        guard let list = variantsByMessage[messageID], list.count > 1 else { return nil }
        let index = list.firstIndex { $0.content == currentBody } ?? 0
        return (index, list.count)
    }

    /// Swap the assistant message's active variant to the one at `index`.
    func setActiveVariant(messageID: String, index: Int) {
        guard let list = variantsByMessage[messageID], list.indices.contains(index) else { return }
        let target = list[index]
        // Optimistic local swap.
        if let idx = items.firstIndex(where: { $0.id == messageID }) {
            items[idx] = MessageItem(id: items[idx].id, role: .assistant, body: target.content, createdAt: items[idx].createdAt)
        }
        Task { [weak self] in
            guard let self else { return }
            do {
                struct UpdatePayload: Encodable { let active_variant_id: String }
                try await self.client
                    .from("messages")
                    .update(UpdatePayload(active_variant_id: target.id))
                    .eq("id", value: messageID)
                    .execute()
            } catch {
                self.streamState = .error(error.localizedDescription)
            }
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

    /// Re-call `/chat` to retry the last turn after a provider failure
    /// (e.g. "Model returned only ''" degenerate-output safety). The
    /// user message is already in the DB so we skip the insert and just
    /// re-run the SSE consumption. Bound to the "Reintentar" button on
    /// the error strip.
    func retryLastTurn() {
        guard !isStreaming else { return }
        streamState = .streaming
        transientNotice = nil
        streamTask = Task { [weak self] in
            await self?.runRetry()
        }
    }

    /// Add a new variant to the assistant message identified by `messageID`
    /// by POSTing `/chat` with `regenerate_message_id`. The backend creates
    /// the variant and streams its content; we keep the placeholder behavior
    /// from `send(_:)`.
    func regenerate(messageID: String) {
        guard !isStreaming else { return }
        streamState = .streaming
        transientNotice = nil
        streamTask = Task { [weak self] in
            await self?.runRegenerate(messageID: messageID)
        }
    }

    /// Soft delete: remove the message row in Supabase and the local item.
    func deleteMessage(_ messageID: String) {
        Task { [weak self] in
            guard let self else { return }
            do {
                try await self.client
                    .from("messages")
                    .delete()
                    .eq("id", value: messageID)
                    .execute()
                self.items.removeAll { $0.id == messageID }
            } catch {
                self.streamState = .error(error.localizedDescription)
            }
        }
    }

    /// Edit-as-trim: update the message text + delete everything created after it.
    func editAndTrim(messageID: String, newText: String) {
        Task { [weak self] in
            guard let self else { return }
            guard let item = self.items.first(where: { $0.id == messageID }) else { return }
            do {
                struct UpdatePayload: Encodable { let text: String; let edited_at: String }
                let nowISO = ISO8601DateFormatter().string(from: Date())
                try await self.client
                    .from("messages")
                    .update(UpdatePayload(text: newText, edited_at: nowISO))
                    .eq("id", value: messageID)
                    .execute()
                // Drop every message created strictly after the anchor.
                try await self.client
                    .from("messages")
                    .delete()
                    .eq("conversation_id", value: self.conversationID)
                    .gt("created_at", value: item.createdAt)
                    .execute()
                await self.load()
            } catch {
                self.streamState = .error(error.localizedDescription)
            }
        }
    }

    private func runRegenerate(messageID: String) async {
        let request: URLRequest
        do {
            request = try await makeChatRequest(extra: ["regenerate_message_id": messageID])
        } catch {
            streamState = .error("Couldn't start regenerate: \(error.localizedDescription)")
            return
        }
        var assistantPlaceholderIndex: Int?
        var buffer = ""
        do {
            let stream = URLSession.shared.eventStream(for: request)
            for try await event in stream {
                try Task.checkCancellation()
                switch event {
                case let .start(newMessageID, _):
                    // Replace the existing bubble in-place so the swap feels seamless.
                    if let idx = items.firstIndex(where: { $0.id == messageID }) {
                        items[idx] = MessageItem(
                            id: newMessageID,
                            role: .assistant,
                            body: "",
                            createdAt: items[idx].createdAt
                        )
                        assistantPlaceholderIndex = idx
                    }
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
                case .correction, .rewriteRequired, .grammarError:
                    break
                case let .error(message):
                    streamState = .error(message)
                    return
                case .done:
                    streamState = .idle
                    return
                }
            }
            streamState = .idle
        } catch is CancellationError {
            streamState = .idle
        } catch {
            streamState = .error(error.localizedDescription)
        }
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
                case let .correction(payload):
                    chatLog.info("correction received user_msg=\(payload.user_message_id ?? "?", privacy: .public) already_correct=\(payload.already_correct ?? false, privacy: .public)")
                    storeCorrection(payload)
                case let .rewriteRequired(payload):
                    chatLog.info("rewrite required user_msg=\(payload.user_message_id ?? "?", privacy: .public)")
                    storeCorrection(payload)
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

    /// Re-run /chat with no payload changes after a provider failure.
    /// Identical to runSend's stream-consumption path; skips step 1 (user
    /// insert) since the user message is already persisted.
    private func runRetry() async {
        chatLog.info("retry begin conversation=\(self.conversationID, privacy: .public)")
        let request: URLRequest
        do {
            request = try await makeChatRequest()
        } catch {
            chatLog.error("retry makeChatRequest failed: \(error.localizedDescription, privacy: .public)")
            streamState = .error("Couldn't start the stream: \(error.localizedDescription)")
            return
        }

        var assistantPlaceholderIndex: Int?
        var buffer = ""

        do {
            let stream = URLSession.shared.eventStream(for: request)
            for try await event in stream {
                try Task.checkCancellation()
                switch event {
                case let .start(messageID, variantID):
                    chatLog.info("retry stream start message=\(messageID, privacy: .public) variant=\(variantID, privacy: .public)")
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
                case let .correction(payload):
                    storeCorrection(payload)
                case let .rewriteRequired(payload):
                    storeCorrection(payload)
                    transientNotice = "Rewrite required by grammar settings."
                case let .grammarError(message):
                    transientNotice = "Grammar agent: \(message)"
                case let .error(message):
                    chatLog.error("retry stream error: \(message, privacy: .public)")
                    streamState = .error(message)
                    if let idx = assistantPlaceholderIndex, idx < items.count {
                        items.remove(at: idx)
                    }
                    return
                case let .done(messageID, variantID):
                    chatLog.info("retry stream done message=\(messageID, privacy: .public) variant=\(variantID, privacy: .public) tokens=\(buffer.count)")
                    streamState = .idle
                    return
                }
            }
            streamState = .idle
        } catch is CancellationError {
            streamState = .idle
        } catch {
            chatLog.error("retry stream threw: \(error.localizedDescription, privacy: .public)")
            streamState = .error(error.localizedDescription)
        }
    }

    // MARK: - Grammar corrections (inline render)

    /// Convert an SSE `correction` / `rewrite_required` payload into a
    /// `GrammarCorrection` row keyed by user_message_id, and merge it into
    /// `corrections`. Skipped when the payload is for an `already_correct`
    /// message (no diff to render) or missing a user_message_id.
    private func storeCorrection(_ payload: CorrectionPayload) {
        guard let userMsgID = payload.user_message_id,
              let original = payload.original_text,
              let corrected = payload.corrected_text,
              payload.already_correct != true,
              original.trimmingCharacters(in: .whitespacesAndNewlines)
                != corrected.trimmingCharacters(in: .whitespacesAndNewlines)
        else { return }
        corrections[userMsgID] = GrammarCorrection(
            id: userMsgID,
            conversation_id: conversationID,
            user_message_id: userMsgID,
            original_text: original,
            corrected_text: corrected,
            explanation: payload.explanation,
            error_categories: payload.error_categories,
            edit_distance: nil,
            created_at: ISO8601DateFormatter().string(from: Date())
        )
    }

    /// Backfill `corrections` from the persisted `grammar_corrections`
    /// table on chat open, so reloading a conversation re-renders the
    /// inline corrections that were applied in past turns.
    func loadGrammarCorrections() async {
        do {
            let rows: [GrammarCorrection] = try await client
                .from("grammar_corrections")
                .select("id, conversation_id, user_message_id, original_text, corrected_text, explanation, error_categories, edit_distance, created_at")
                .eq("conversation_id", value: conversationID)
                .execute()
                .value
            var byID: [String: GrammarCorrection] = [:]
            for row in rows {
                guard let userMsgID = row.user_message_id,
                      let original = row.original_text,
                      let corrected = row.corrected_text,
                      original.trimmingCharacters(in: .whitespacesAndNewlines)
                        != corrected.trimmingCharacters(in: .whitespacesAndNewlines)
                else { continue }
                byID[userMsgID] = row
            }
            self.corrections = byID
        } catch {
            chatLog.info("grammar_corrections fetch failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// Read accessor for the bubble view.
    func correction(for userMessageID: String) -> GrammarCorrection? {
        corrections[userMessageID]
    }

    // MARK: - Sibling conversation

    /// Create a fresh empty conversation with the same character — wired to the
    /// `+` toolbar item per PersonaLLM's header. Returns the new row's id so
    /// `ChatView` can push into it. Logic mirrors
    /// `CharacterLandingView.createConversation(scenarioBody: nil)` so the two
    /// stay aligned until the next refactor lifts it into a shared helper.
    func createSiblingConversation() async throws -> String {
        guard let character else {
            throw NSError(
                domain: "ChatViewModel",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "Character context missing — cannot start a sibling conversation."]
            )
        }
        let session = try await client.auth.session
        let userID = session.user.id.uuidString
        let personaID = await Self.fetchPrimaryPersonaID(client: client)

        struct CharacterSnapshotPayload: Encodable {
            let name: String
            let system_prompt: String?
            let mode: String?
            let scenario: String?
        }
        struct EmptySnapshot: Encodable {}
        struct ConvInsert: Encodable {
            let user_id: String
            let character_id: String
            let title: String
            let character_snapshot: CharacterSnapshotPayload
            let writing_style_snapshot: EmptySnapshot
            let persona_id: String?
        }

        let payload = ConvInsert(
            user_id: userID,
            character_id: character.id,
            title: character.name,
            character_snapshot: CharacterSnapshotPayload(
                name: character.name,
                system_prompt: character.system_prompt,
                mode: character.mode,
                scenario: character.scenario
            ),
            writing_style_snapshot: EmptySnapshot(),
            persona_id: personaID
        )

        let inserted: [Conversation] = try await client
            .from("conversations")
            .insert(payload)
            .select("id, title, character_id, character_snapshot, last_message_at, updated_at")
            .execute()
            .value
        guard let row = inserted.first else {
            throw NSError(
                domain: "ChatViewModel",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "Empty conversation insert"]
            )
        }
        return row.id
    }

    /// Best-effort lookup of the user's primary persona so the new
    /// conversation can address them by the right name. Failure is non-fatal.
    private static func fetchPrimaryPersonaID(client: SupabaseClient) async -> String? {
        struct PersonaRow: Decodable { let id: String }
        do {
            let session = try await client.auth.session
            let rows: [PersonaRow] = try await client
                .from("user_personas")
                .select("id")
                .eq("user_id", value: session.user.id.uuidString)
                .order("created_at", ascending: true)
                .limit(1)
                .execute()
                .value
            return rows.first?.id
        } catch {
            return nil
        }
    }

    /// Fetch every conversation this character has for the trailing `list`
    /// toolbar item. Returns oldest-first ordering — `CharacterChatsView`
    /// renders the array verbatim.
    func loadSiblingConversations() async throws -> [Conversation] {
        guard let character else { return [] }
        let session = try await client.auth.session
        let rows: [Conversation] = try await client
            .from("conversations")
            .select("id, title, character_id, character_snapshot, last_message_at, updated_at")
            .eq("user_id", value: session.user.id.uuidString)
            .eq("character_id", value: character.id)
            .order("updated_at", ascending: false)
            .execute()
            .value
        return rows
    }

    private func makeChatRequest(extra: [String: Any] = [:]) async throws -> URLRequest {
        // Pull the live Supabase JWT so the backend can authenticate.
        let session = try await client.auth.session
        let jwt = session.accessToken

        var request = URLRequest(url: BackendConfig.url.appendingPathComponent("chat"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")

        var body: [String: Any] = [
            "conversation_id": conversationID
        ]
        for (k, v) in extra { body[k] = v }
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
