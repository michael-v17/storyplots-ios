import SwiftUI
import Supabase

/// Routes the chat toolbar ⋯ menu to one of the side-panel sheets
/// (Memory, Grammar, Lorebook, Author's Note, Generation Override,
/// Chat Controls). Phase 8 ships these as placeholders — real CRUD
/// lands per-panel as the underlying surfaces stabilize.
enum ChatPanel: String, Identifiable, Hashable, CaseIterable {
    case memory, grammar, lorebook, authorsNote, generationOverride, chatControls
    var id: String { rawValue }

    var title: String {
        switch self {
        case .memory: return "Memory"
        case .grammar: return "Grammar"
        case .lorebook: return "Lorebook"
        case .authorsNote: return "Author's Note"
        case .generationOverride: return "Generation Override"
        case .chatControls: return "Chat Controls"
        }
    }

    var systemImage: String {
        switch self {
        case .memory: return "brain"
        case .grammar: return "checkmark.bubble"
        case .lorebook: return "book.closed"
        case .authorsNote: return "note.text"
        case .generationOverride: return "slider.horizontal.3"
        case .chatControls: return "gearshape"
        }
    }
}

struct ChatPanelsMenuButton: View {
    @Binding var presented: ChatPanel?

    var body: some View {
        Menu {
            ForEach(ChatPanel.allCases) { panel in
                Button {
                    presented = panel
                } label: {
                    Label(panel.title, systemImage: panel.systemImage)
                }
            }
        } label: {
            Image(systemName: "ellipsis")
                .foregroundStyle(Theme.Color.fg1)
        }
    }
}

/// Generic sheet body. Each panel resolves to a Phase-8 placeholder until
/// its real CRUD lands. Tap-through stops here.
struct ChatPanelSheet: View {
    let panel: ChatPanel
    let conversationID: String
    let client: SupabaseClient
    @Binding var generationOverrides: GenerationOverrides

    var body: some View {
        switch panel {
        case .memory:
            MemoryPanelView(conversationID: conversationID, client: client)
        case .lorebook:
            LorebookPanelView(conversationID: conversationID, client: client)
        case .authorsNote:
            AuthorsNotePanelView(conversationID: conversationID, client: client)
        case .chatControls:
            ChatControlsPanelView(conversationID: conversationID, client: client)
        case .generationOverride:
            GenerationOverridePanelView(overrides: $generationOverrides)
        case .grammar:
            GrammarPanelView(conversationID: conversationID, client: client)
        }
    }
}
