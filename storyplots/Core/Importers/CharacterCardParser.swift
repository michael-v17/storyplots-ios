import Foundation
import ImageIO
import OSLog
import UniformTypeIdentifiers

private let parserLog = Logger(subsystem: "com.storyplots.ios", category: "char-card-parser")

enum CharacterCardFormat: String, Sendable {
    case v1
    case v2
    case v3
}

struct ParsedCharacterCard {
    let format: CharacterCardFormat
    let rawCard: [String: Any]
}

enum CharacterCardParserError: Error, Equatable, Sendable {
    case unreadableImage
    case noTextChunks
    case decodeFailed
    case unsupportedFormat

    var userMessage: String {
        switch self {
        case .unreadableImage:
            return "Couldn't read that PNG. Try another file."
        case .noTextChunks:
            return "This PNG doesn't carry a Character Card payload (no tEXt metadata)."
        case .decodeFailed:
            return "The embedded payload looks malformed — base64 or JSON decode failed."
        case .unsupportedFormat:
            return "Card format not supported. Use a v1, v2, or v3 PNG."
        }
    }
}

enum CharacterCardParser {
    /// Parse a PNG buffer carrying a Character Card JSON in its tEXt chunk.
    ///
    /// Convention across Tavern / RisuAI / chub.ai: keyword `chara` (or `ccv3`)
    /// holds a base64-encoded JSON string. Format is detected from the
    /// payload's `spec` field; v1 lacks the wrapper.
    static func parse(pngData data: Data) throws -> ParsedCharacterCard {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else {
            throw CharacterCardParserError.unreadableImage
        }
        guard
            let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
            let png = props[kCGImagePropertyPNGDictionary] as? [CFString: Any]
        else {
            throw CharacterCardParserError.noTextChunks
        }

        // Try canonical keys first, then iterate.
        if let value = lookupChunk(in: png) {
            return try decode(value)
        }
        // Some encoders namespace under non-CGImage-promoted keys; iterate.
        for (_, v) in png {
            if let s = v as? String, let parsed = try? decodeIfJSONOrBase64(s) {
                return parsed
            }
        }
        throw CharacterCardParserError.noTextChunks
    }

    private static func lookupChunk(in png: [CFString: Any]) -> String? {
        let candidates: [String] = ["chara", "ccv3", "Description", "comment"]
        for key in candidates {
            if let value = png[key as CFString] as? String {
                return value
            }
        }
        return nil
    }

    private static func decode(_ rawValue: String) throws -> ParsedCharacterCard {
        try decodeIfJSONOrBase64(rawValue)
    }

    /// Accepts either a base64-encoded JSON or a raw JSON string; returns the parsed card.
    private static func decodeIfJSONOrBase64(_ rawValue: String) throws -> ParsedCharacterCard {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)

        // Attempt base64 first.
        if let data = Data(base64Encoded: trimmed, options: .ignoreUnknownCharacters),
           let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return classify(dict)
        }

        // Fall back to raw JSON.
        if let data = trimmed.data(using: .utf8),
           let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return classify(dict)
        }

        throw CharacterCardParserError.decodeFailed
    }

    private static func classify(_ dict: [String: Any]) -> ParsedCharacterCard {
        let spec = (dict["spec"] as? String)?.lowercased() ?? ""
        if spec.contains("v3") {
            return ParsedCharacterCard(format: .v3, rawCard: dict)
        }
        if spec.contains("v2") {
            return ParsedCharacterCard(format: .v2, rawCard: dict)
        }
        return ParsedCharacterCard(format: .v1, rawCard: dict)
    }
}
