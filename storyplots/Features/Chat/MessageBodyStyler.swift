import Foundation
import SwiftUI

/// Turns a raw chat-message body into a styled `AttributedString` that
/// visually distinguishes the three voices PersonaLLM uses inside a single
/// turn:
///
/// - **Action / narration** — written as `*asterisks*`, `_underscores_`, or
///   `[brackets]` by the model. Rendered italic + muted (`fg2`) so the
///   prose recedes against the dialogue.
/// - **Out-of-character notes** — wrapped in `((double parens))`. Rendered
///   even more muted (`fg3`) so meta-asides stay clearly outside the
///   in-character voice.
/// - **Dialogue / plain prose** — everything else. Rendered at the bubble's
///   default foreground (`fg`).
///
/// We don't try to detect quoted dialogue specially — straight quotes (`"`)
/// and curly quotes (`"` / `"`) mix freely in NPC output and demarcating
/// them visually would clash with the existing accent border on the bubble.
enum MessageBodyStyler {
    static func attributed(_ raw: String) -> AttributedString {
        // 1. Promote `[bracketed]` action descriptions to *italic* markdown
        //    so the standard parser picks them up alongside `*asterisks*`
        //    and `_underscores_`. The model uses either convention
        //    interchangeably depending on system-prompt style.
        let bracketed = raw.replacingOccurrences(
            of: #"\[([^\[\]]+)\]"#,
            with: "*$1*",
            options: .regularExpression
        )

        // 2. Parse as inline markdown so existing emphasis/bold/links keep
        //    working. Fall back to the raw string if the parser chokes.
        var attributed: AttributedString
        do {
            attributed = try AttributedString(
                markdown: bracketed,
                options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
            )
        } catch {
            return AttributedString(raw)
        }

        // 3. Recolor italic spans to `fg2` so emphasized action prose recedes
        //    against in-character dialogue. Collect ranges first to avoid
        //    mutating while iterating the runs view.
        let italicRanges = attributed.runs.compactMap { run -> Range<AttributedString.Index>? in
            guard let intent = run.inlinePresentationIntent,
                  intent.contains(.emphasized) else { return nil }
            return run.range
        }
        for range in italicRanges {
            attributed[range].foregroundColor = Theme.Color.fg2
        }

        // 4. OOC double-parens — `((...))` — get an even more muted color
        //    so meta-asides clearly sit outside the in-character voice.
        attributed = colorize(
            attributed,
            pattern: #"\(\(([^()]+)\)\)"#,
            color: Theme.Color.fg3
        )

        return attributed
    }

    private static func colorize(
        _ source: AttributedString,
        pattern: String,
        color: Color
    ) -> AttributedString {
        var result = source
        let raw = String(result.characters)
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return result }
        let nsRange = NSRange(raw.startIndex..<raw.endIndex, in: raw)
        let matches = regex.matches(in: raw, range: nsRange)
        for match in matches.reversed() {
            guard let stringRange = Range(match.range, in: raw),
                  let attrRange = Range(stringRange, in: result) else { continue }
            result[attrRange].foregroundColor = color
        }
        return result
    }
}
