import Foundation

/// One decoded event from the backend `/chat` SSE stream. See
/// `seed/api-contract.md` §3.2 — 7 event types across 5 flow modes.
enum ChatStreamEvent: Sendable, Equatable {
    case start(messageID: String, variantID: String)
    case token(text: String)
    case correction(payload: CorrectionPayload)
    case rewriteRequired(payload: CorrectionPayload)
    case grammarError(message: String)
    case error(message: String)
    case done(messageID: String, variantID: String)
}

struct CorrectionPayload: Decodable, Sendable, Equatable {
    let user_message_id: String?
    let original_text: String?
    let already_correct: Bool?
    let corrected_text: String?
    let explanation: String?
    let error_categories: [String]?
}

/// Parses one SSE frame (between `\n\n`s). Returns nil if the frame has no
/// `data:` lines or the JSON is unparseable — caller should skip it.
enum SSEFrameParser {
    private struct StartPayload: Decodable { let message_id: String; let variant_id: String }
    private struct DonePayload: Decodable { let message_id: String; let variant_id: String }
    private struct TokenPayload: Decodable { let text: String }
    private struct MessagePayload: Decodable { let message: String }

    static func parse(_ frame: String) -> ChatStreamEvent? {
        var eventName = "message"
        var dataLines: [String] = []
        for line in frame.split(separator: "\n", omittingEmptySubsequences: false) {
            let s = String(line)
            if s.hasPrefix("event: ") {
                eventName = String(s.dropFirst("event: ".count)).trimmingCharacters(in: .whitespaces)
            } else if s.hasPrefix("data: ") {
                dataLines.append(String(s.dropFirst("data: ".count)))
            }
        }
        guard !dataLines.isEmpty else { return nil }
        let dataString = dataLines.joined(separator: "\n")
        guard let data = dataString.data(using: .utf8) else { return nil }

        let decoder = JSONDecoder()
        switch eventName {
        case "start":
            guard let p = try? decoder.decode(StartPayload.self, from: data) else { return nil }
            return .start(messageID: p.message_id, variantID: p.variant_id)
        case "token":
            guard let p = try? decoder.decode(TokenPayload.self, from: data) else { return nil }
            return .token(text: p.text)
        case "correction":
            guard let p = try? decoder.decode(CorrectionPayload.self, from: data) else { return nil }
            return .correction(payload: p)
        case "rewrite_required":
            guard let p = try? decoder.decode(CorrectionPayload.self, from: data) else { return nil }
            return .rewriteRequired(payload: p)
        case "grammar_error":
            guard let p = try? decoder.decode(MessagePayload.self, from: data) else { return nil }
            return .grammarError(message: p.message)
        case "error":
            guard let p = try? decoder.decode(MessagePayload.self, from: data) else { return nil }
            return .error(message: p.message)
        case "done":
            guard let p = try? decoder.decode(DonePayload.self, from: data) else { return nil }
            return .done(messageID: p.message_id, variantID: p.variant_id)
        default:
            return nil
        }
    }
}
