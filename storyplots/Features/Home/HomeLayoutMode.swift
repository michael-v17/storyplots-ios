import Foundation
import SwiftUI

enum HomeLayoutMode: String, CaseIterable, Identifiable, Sendable {
    case grid
    case circles
    case list

    var id: String { rawValue }

    var systemImage: String {
        switch self {
        case .grid:    return "square.grid.2x2.fill"
        case .circles: return "circle.grid.3x3.fill"
        case .list:    return "list.bullet"
        }
    }

    var next: HomeLayoutMode {
        switch self {
        case .grid:    return .circles
        case .circles: return .list
        case .list:    return .grid
        }
    }
}
