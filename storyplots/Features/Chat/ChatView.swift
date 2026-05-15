import SwiftUI
import UIKit
import Supabase

struct ChatView: View {
    @State private var model: ChatViewModel
    @State private var draft: String = ""
    @State private var pinnedToBottom: Bool = true

    init(conversationID: String,
         character: Character?,
         accent: Color,
         avatarURL: URL?,
         client: SupabaseClient) {
        _model = State(initialValue: ChatViewModel(
            conversationID: conversationID,
            character: character,
            accent: accent,
            avatarURL: avatarURL,
            client: client
        ))
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
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .principal) {
                HStack(spacing: Theme.Spacing.s2) {
                    Circle().fill(model.accent).frame(width: 8, height: 8)
                    Text(model.characterName)
                        .font(.headline)
                        .foregroundStyle(Theme.Color.fg)
                }
            }
        }
        .task { if model.loadState == .idle { await model.load() } }
    }

    @ViewBuilder
    private var messagesScroll: some View {
        switch model.loadState {
        case .idle, .loading where model.items.isEmpty:
            ProgressView()
                .tint(model.accent)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
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
                                avatarURL: model.avatarURL,
                                onCopy: { UIPasteboard.general.string = item.body },
                                onRegenerate: { model.regenerate(messageID: item.id) },
                                onDelete: { model.deleteMessage(item.id) }
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
        VStack(spacing: Theme.Spacing.s2) {
            Text("No messages yet.")
                .font(Theme.FontStyle.h3)
                .foregroundStyle(Theme.Color.fg)
            Text("Phase 5 wires the composer to /chat streaming.")
                .font(Theme.FontStyle.meta)
                .foregroundStyle(Theme.Color.fg3)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Theme.Spacing.s10)
    }
}
