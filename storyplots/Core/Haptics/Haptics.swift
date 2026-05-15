import Foundation
#if os(iOS)
import UIKit
#endif

/// Lightweight haptics façade — usable from any layer (views, view models)
/// without leaking UIKit imports across the codebase. All methods are no-ops
/// on platforms where haptics aren't available.
@MainActor
enum Haptics {
    /// Single tactile bump — `impact(.light)` for swipes/taps; `.medium` for
    /// confirms; `.heavy` for crossing thresholds (e.g. pull-to-refresh).
    static func impact(_ style: Style = .medium) {
        #if os(iOS)
        let generator = UIImpactFeedbackGenerator(style: style.uiKit)
        generator.prepare()
        generator.impactOccurred()
        #endif
    }

    /// Pair of taps for success / warning / error.
    static func notify(_ kind: NotificationKind) {
        #if os(iOS)
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(kind.uiKit)
        #endif
    }

    /// Subtle tick — picker rotation, variant swap, slider step.
    static func selection() {
        #if os(iOS)
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
        #endif
    }

    enum Style: Sendable {
        case soft, light, medium, rigid, heavy

        #if os(iOS)
        var uiKit: UIImpactFeedbackGenerator.FeedbackStyle {
            switch self {
            case .soft:   return .soft
            case .light:  return .light
            case .medium: return .medium
            case .rigid:  return .rigid
            case .heavy:  return .heavy
            }
        }
        #endif
    }

    enum NotificationKind: Sendable {
        case success, warning, error

        #if os(iOS)
        var uiKit: UINotificationFeedbackGenerator.FeedbackType {
            switch self {
            case .success: return .success
            case .warning: return .warning
            case .error:   return .error
            }
        }
        #endif
    }
}
