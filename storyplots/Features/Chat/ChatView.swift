import SwiftUI
import UIKit
import Supabase

struct ChatView: View {
    @State private var model: ChatViewModel
    @State private var draft: String = ""
    @State private var pinnedToBottom: Bool = true
    @State private var activePanel: ChatPanel?
    @State private var generationOverrides = GenerationOverrides()
    @State private var forkAnchorID: String?
    @State private var forkedConversationID: String?
    @State private var presentedImage: GeneratedImage?
    @State private var editingMessageID: String?
    @State private var showCharacterDetail: Bool = false
    @State private var showCharacterChats: Bool = false
    @State private var siblingConversationID: String?
    @State private var siblingError: String?
    @State private var creatingSibling: Bool = false
    @Namespace private var imageNamespace
    private let client: SupabaseClient

    init(conversationID: String,
         character: Character?,
         accent: Color,
         avatarRef: String?,
         client: SupabaseClient) {
        _model = State(initialValue: ChatViewModel(
            conversationID: conversationID,
            character: character,
            accent: accent,
            avatarRef: avatarRef,
            client: client
        ))
        self.client = client
    }

    var body: some View {
        mainStack
            .background(Theme.Color.bg)
            .accentHaloWash(color: model.accent)
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .tabBar)
            .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
            .toolbarBackgroundVisibility(.visible, for: .navigationBar)
            .toolbar { toolbarContent }
            .modifier(ChatSheetsModifier(
                showCharacterDetail: $showCharacterDetail,
                editingMessageID: $editingMessageID,
                activePanel: $activePanel,
                forkAnchorID: $forkAnchorID,
                forkedConversationID: $forkedConversationID,
                generationOverrides: $generationOverrides,
                presentedImage: $presentedImage,
                imageNamespace: imageNamespace,
                client: client,
                model: model
            ))
            .navigationDestination(item: Binding(
                get: { siblingConversationID.map { SiblingConversationDestination(id: $0) } },
                set: { siblingConversationID = $0?.id }
            )) { destination in
                ChatView(
                    conversationID: destination.id,
                    character: model.character,
                    accent: model.accent,
                    avatarRef: model.avatarRef,
                    client: client
                )
            }
            .sheet(isPresented: $showCharacterChats) {
                if let character = model.character {
                    NavigationStack {
                        CharacterChatsLoader(
                            character: character,
                            accent: model.accent,
                            avatarRef: model.avatarRef,
                            client: client,
                            model: model,
                            onDismiss: { showCharacterChats = false }
                        )
                    }
                    .presentationDetents([.large])
                }
            }
            .alert("Couldn't start a new conversation",
                   isPresented: Binding(get: { siblingError != nil },
                                        set: { if !$0 { siblingError = nil } })) {
                Button("OK", role: .cancel) { siblingError = nil }
            } message: {
                Text(siblingError ?? "")
            }
            .task { if model.loadState == .idle { await model.load() } }
            .onDisappear { model.stopAllAudio() }
    }

    private struct SiblingConversationDestination: Hashable {
        let id: String
    }

    private func startSiblingConversation() {
        guard !creatingSibling else { return }
        creatingSibling = true
        Haptics.impact(.medium)
        Task {
            do {
                let newID = try await model.createSiblingConversation()
                creatingSibling = false
                siblingConversationID = newID
            } catch {
                creatingSibling = false
                siblingError = error.localizedDescription
            }
        }
    }

    private var mainStack: some View {
        VStack(spacing: 0) {
            messagesScroll
            noticeStrip
            errorStrip
            ComposerView(
                draft: $draft,
                accent: model.accent,
                isStreaming: model.isStreaming,
                placeholderName: model.characterName,
                chatPanel: $activePanel,
                onSend: {
                    let toSend = draft
                    draft = ""
                    model.send(toSend)
                },
                onCancel: { model.cancelStream() }
            )
        }
    }

    private struct ForkAnchor: Identifiable, Equatable { let id: String }
    private struct EditAnchor: Identifiable, Equatable { let id: String }

    @ViewBuilder
    private var messagesScroll: some View {
        if isSkeletonState {
            skeletonScroll
        } else {
            resolvedScroll
        }
    }

    private var isSkeletonState: Bool {
        switch model.loadState {
        case .idle:    return true
        case .loading: return model.items.isEmpty
        default:       return false
        }
    }


    @ViewBuilder
    private var noticeStrip: some View {
        if let notice = model.transientNotice {
            Text(notice)
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.warning)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Theme.Spacing.s4)
                .padding(.vertical, Theme.Spacing.s2)
                .background(Theme.Color.warningSoft)
        }
    }

    @ViewBuilder
    private var errorStrip: some View {
        if case .error(let m) = model.streamState {
            Text(m)
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.destructive)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Theme.Spacing.s4)
                .padding(.vertical, Theme.Spacing.s2)
                .background(Theme.Color.destructiveSoft)
        }
    }


    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .principal) {
            ChatHeaderTitle(
                avatarRef: model.avatarRef,
                characterName: model.characterName,
                tagline: model.character?.tagline,
                isStreaming: model.isStreaming,
                accent: model.accent
            ) {
                Haptics.impact(.light)
                showCharacterDetail = true
            }
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                Haptics.impact(.light)
                showCharacterChats = true
            } label: {
                Image(systemName: "list.bullet")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(model.accent)
            }
            .accessibilityLabel("Conversations with \(model.characterName)")
            .disabled(model.character == nil)
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                startSiblingConversation()
            } label: {
                if creatingSibling {
                    ProgressView()
                        .controlSize(.small)
                        .tint(model.accent)
                } else {
                    Image(systemName: "plus")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(model.accent)
                }
            }
            .accessibilityLabel("Start a new conversation with \(model.characterName)")
            .disabled(model.character == nil || creatingSibling)
        }
    }

    private var skeletonScroll: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                ForEach(0..<3, id: \.self) { _ in
                    ChatBubbleSkeleton()
                }
            }
            .padding(.vertical, Theme.Spacing.s3)
        }
        .disabled(true)
    }

    @ViewBuilder
    private var resolvedScroll: some View {
        switch model.loadState {
        case .error(let m) where model.items.isEmpty:
            VStack(spacing: Theme.Spacing.s3) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(Theme.Color.destructive)
                Text(m)
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg2)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Theme.Spacing.s4)
                Button("Retry") { Task { await model.load() } }
                    .buttonStyle(.borderedProminent)
                    .tint(model.accent)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        default:
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                        ForEach(model.items) { item in
                            if item.isScenario {
                                ScenarioCardView(
                                    text: item.body,
                                    accent: model.accent,
                                    scenarioTitle: nil
                                )
                                .id(item.id)
                            } else {
                                MessageBubbleView(
                                    item: item,
                                    accent: model.accent,
                                    characterName: model.characterName,
                                    avatarRef: model.avatarRef,
                                    variantPagination: model.variantPagination(for: item.id, currentBody: item.body),
                                    images: model.images(for: item.id),
                                    imageRequestLoading: model.imageRequestState[item.id] == .loading,
                                    audioState: model.audioState(for: item.id),
                                    imageNamespace: imageNamespace,
                                    onCopy: { UIPasteboard.general.string = item.body },
                                    onRegenerate: { model.regenerate(messageID: item.id) },
                                    onDelete: { model.deleteMessage(item.id) },
                                    onFork: { forkAnchorID = item.id },
                                    onSelectVariant: { idx in model.setActiveVariant(messageID: item.id, index: idx) },
                                    onRequestImage: { model.requestImage(messageID: item.id, overrides: generationOverrides) },
                                    onSelectImage: { img in
                                        withAnimation(Theme.Motion.smooth) { presentedImage = img }
                                    },
                                    onToggleAudio: { model.toggleAudio(messageID: item.id) },
                                    onEdit: { editingMessageID = item.id }
                                )
                                .id(item.id)
                            }
                        }
                        if model.items.isEmpty {
                            emptyState
                        }
                    }
                    .padding(.vertical, Theme.Spacing.s3)
                }
                .onChange(of: model.items.count) { _, _ in
                    if let last = model.items.last {
                        withAnimation(Theme.Motion.snappy) {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        EmptyStateView(
            systemImage: "bubble.left.and.text.bubble.right.fill",
            title: "Say hello to \(model.characterName)",
            message: "Set the scene, ask a question, or jump right into roleplay. Tap the composer to begin."
        )
    }
}


/// All the sheet/overlay/alert presentations for ChatView. Bundled into a
/// dedicated modifier so SwiftUI's type-checker can resolve the body in
/// reasonable time (without this split the chained .sheet/.alert/.overlay
/// stack hits the compiler's complexity ceiling).
private struct ChatSheetsModifier: ViewModifier {
    @Binding var showCharacterDetail: Bool
    @Binding var editingMessageID: String?
    @Binding var activePanel: ChatPanel?
    @Binding var forkAnchorID: String?
    @Binding var forkedConversationID: String?
    @Binding var generationOverrides: GenerationOverrides
    @Binding var presentedImage: GeneratedImage?
    let imageNamespace: Namespace.ID
    let client: SupabaseClient
    let model: ChatViewModel

    private struct ForkAnchor: Identifiable, Equatable { let id: String }
    private struct EditAnchor: Identifiable, Equatable { let id: String }

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: $showCharacterDetail) {
                if let character = model.character {
                    CharacterDetailSheet(
                        character: character,
                        accent: model.accent,
                        avatarRef: model.avatarRef,
                        client: client,
                        onClose: { showCharacterDetail = false }
                    )
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
                }
            }
            .sheet(item: Binding(
                get: { editingMessageID.map { EditAnchor(id: $0) } },
                set: { editingMessageID = $0?.id }
            )) { anchor in
                if let item = model.items.first(where: { $0.id == anchor.id }) {
                    EditTrimSheet(originalText: item.body) { newText in
                        model.editAndTrim(messageID: anchor.id, newText: newText)
                    }
                }
            }
            .sheet(item: $activePanel) { panel in
                ChatPanelSheet(
                    panel: panel,
                    conversationID: model.conversationID,
                    client: client,
                    generationOverrides: $generationOverrides
                )
            }
            .sheet(item: Binding(
                get: { forkAnchorID.map { ForkAnchor(id: $0) } },
                set: { forkAnchorID = $0?.id }
            )) { anchor in
                ForkDialog(
                    conversationID: model.conversationID,
                    anchorMessageID: anchor.id,
                    client: client
                ) { newID in
                    forkedConversationID = newID
                }
            }
            .alert("Forked", isPresented: Binding(
                get: { forkedConversationID != nil },
                set: { if !$0 { forkedConversationID = nil } }
            )) {
                Button("OK") { forkedConversationID = nil }
            } message: {
                Text("New branch created. Go back to Home to open it.")
            }
            .overlay(alignment: .center) {
                if let img = presentedImage {
                    ImageViewer(
                        image: img,
                        namespace: imageNamespace,
                        onDismiss: { withAnimation(Theme.Motion.smooth) { presentedImage = nil } },
                        onRegenerate: {
                            if let messageID = img.message_id {
                                model.requestImage(messageID: messageID, overrides: generationOverrides)
                            }
                        },
                        onDelete: { model.deleteGeneratedImage(img) }
                    )
                    .transition(.opacity)
                    .zIndex(50)
                }
            }
    }
}

/// Small wrapper around `CharacterChatsView` that fetches the per-character
/// conversation list on appear. Used by the chat header's `list` trailing
/// toolbar item so we don't have to thread the conversation array through
/// every screen that opens a chat. The sheet shows a single-step
/// `ProgressView` until the rows resolve.
struct CharacterChatsLoader: View {
    let character: Character
    let accent: Color
    let avatarRef: String?
    let client: SupabaseClient
    let model: ChatViewModel
    let onDismiss: () -> Void

    @State private var conversations: [Conversation] = []
    @State private var loadingError: String?
    @State private var didLoad: Bool = false

    var body: some View {
        Group {
            if !didLoad {
                ProgressView()
                    .controlSize(.large)
                    .tint(accent)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.Color.bg)
            } else if let loadingError {
                VStack(spacing: Theme.Spacing.s3) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(Theme.Color.destructive)
                    Text(loadingError)
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.fg2)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, Theme.Spacing.s4)
                    Button("Retry") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                        .tint(accent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.Color.bg)
            } else {
                CharacterChatsView(
                    character: character,
                    conversations: conversations,
                    accent: accent,
                    avatarRef: avatarRef,
                    client: client
                )
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    Haptics.impact(.light)
                    onDismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(accent)
                }
                .accessibilityLabel("Close")
            }
        }
        .task { await load() }
    }

    private func load() async {
        loadingError = nil
        do {
            conversations = try await model.loadSiblingConversations()
            didLoad = true
        } catch {
            loadingError = error.localizedDescription
            didLoad = true
        }
    }
}
