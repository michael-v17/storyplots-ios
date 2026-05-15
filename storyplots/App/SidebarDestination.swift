import Foundation
import SwiftUI

enum SidebarDestination: String, Hashable, CaseIterable, Identifiable {
    case home
    case characters
    case gallery

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home:       return "Home"
        case .characters: return "Characters"
        case .gallery:    return "Gallery"
        }
    }

    var systemImage: String {
        switch self {
        case .home:       return "house.fill"
        case .characters: return "person.2.fill"
        case .gallery:    return "photo.stack.fill"
        }
    }
}

/// Routes pushed onto the detail `NavigationStack` from sidebar interactions.
enum SidebarRoute: Hashable {
    case characterChats(characterID: String)
}
