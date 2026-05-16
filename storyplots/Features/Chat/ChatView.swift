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
        VStack(spacing: 0) {
            messagesScroll
            if let notice = model.transientNotice {
                Text(notice)
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.warning)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Theme.Spacing.s4)
                    .padding(.vertical, Theme.Spacing.s2)
                    .background(Theme.Color.warningSoft)
            }
            if case .error(let m) = model.streamState {
                Text(m)
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.destructive)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Theme.Spacing.s4)
                    .padding(.vertical, Theme.Spacing.s2)
                    .background(Theme.Color.destructiveSoft)
            }
            ComposerView(
                draft: $draft,
                accent: model.accent,
                isStreaming: model.isStreaming,
                onSend: {
                    let toSend = draft
                    draft = ""
                    model.send(toSend)
                },
                onCancel: { model.cancelStream() }
            )
        }
        .background(Theme.Color.bg)
        .accentTopWash(color: model.accent, intensity: 0.18)
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
        .toolbar {
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
                ChatPanelsMenuButton(presented: $activePanel)
            }
        }
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
        .task { if model.loadState == .idle { await model.load() } }
        .overlay(alignment: .center) {
            if let img = presentedImage {
                ImageViewer(image: img, namespace: imageNamespace) {
                    withAnimation(Theme.Motion.smooth) { presentedImage = nil }
                }
                .transition(.opacity)
                .zIndex(50)
            }
        }
        .onDisappear { model.stopAllAudio() }
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
