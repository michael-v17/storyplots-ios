import SwiftUI
import Supabase
import OSLog

private let landingLog = Logger(subsystem: "com.storyplots.ios", category: "character-landing")

struct CharacterLandingView: View {
    let character: Character
    let accent: Color
    let avatarRef: String?
    let client: SupabaseClient
    let onChanged: () -> Void

    @State private var creating: Bool = false
    @State private var startError: String?
    @State private var newConversationID: String?
    @State private var startProgressLabel: String = "Starting…"
    @State private var showHeroFullscreen: Bool = false
    @State private var showConversationsList: Bool = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.s6) {
                hero
                modePill
                if let scenario = character.scenario, !scenario.isEmpty {
                    scenarioCard(scenario)
                } else {
                    emptyScenarioCard
                }
                if let startError {
                    Text(startError)
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.destructive)
                        .padding(.horizontal, Theme.Spacing.s4)
                }
            }
            .padding(.horizontal, Theme.Spacing.s4)
            .padding(.top, Theme.Spacing.s4)
            .padding(.bottom, Theme.Spacing.s12)
        }
        .background(Theme.Color.bg)
        .accentTopWash(color: accent, intensity: 0.14)
        .navigationTitle(character.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.automatic, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Haptics.impact(.light)
                    showConversationsList = true
                } label: {
                    Image(systemName: "list.bullet")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(accent)
                }
                .accessibilityLabel("Conversations with \(character.name)")
            }
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    CharacterEditView(
                        client: client,
                        character: character,
                        onSaved: onChanged,
                        onDeleted: onChanged
                    )
                } label: {
                    Text("Edit").foregroundStyle(Theme.Color.brand1)
                }
            }
        }
        .navigationDestination(item: Binding(
            get: { newConversationID.map { ConversationDestination(id: $0) } },
            set: { newConversationID = $0?.id }
        )) { destination in
            ChatView(
                conversationID: destination.id,
                character: character,
                accent: accent,
                avatarRef: avatarRef,
                client: client
            )
        }
        .fullScreenCover(isPresented: $showHeroFullscreen) {
            AvatarFullscreenViewer(avatarRef: avatarRef) {
                showHeroFullscreen = false
            }
        }
        .sheet(isPresented: $showConversationsList) {
            NavigationStack {
                CharacterLandingChatsLoader(
                    character: character,
                    accent: accent,
                    avatarRef: avatarRef,
                    client: client,
                    onDismiss: { showConversationsList = false }
                )
            }
            .presentationDetents([.large])
        }
    }

    private struct ConversationDestination: Hashable {
        let id: String
    }

    private var hero: some View {
        VStack(spacing: Theme.Spacing.s3) {
            Button {
                guard avatarRef != nil else { return }
                Haptics.impact(.light)
                showHeroFullscreen = true
            } label: {
                ZStack {
                    Circle()
                        .fill(accent.opacity(0.18))
                        .frame(width: 168, height: 168)
                        .blur(radius: 18)
                    AvatarView(
                        avatarRef: avatarRef,
                        name: character.name,
                        accent: accent,
                        size: 132,
                        ringWidth: 2.5
                    )
                }
            }
            .buttonStyle(.plain)
            .disabled(avatarRef == nil)
            .accessibilityLabel("View character avatar")
            VStack(spacing: 4) {
                Text(character.name)
                    .font(Theme.FontStyle.h2)
                    .foregroundStyle(Theme.Color.fg)
                if let tagline = character.tagline, !tagline.isEmpty {
                    Text(tagline)
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.fg2)
                        .multilineTextAlignment(.center)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Theme.Spacing.s4)
    }

    private var modePill: some View {
        let label = character.mode?.replacingOccurrences(of: "_", with: " ").capitalized ?? "Roleplay"
        return HStack(spacing: 6) {
            Image(systemName: "book.fill")
                .font(.system(size: 12, weight: .semibold))
            Text(label)
                .font(Theme.FontStyle.timestamp.weight(.semibold))
        }
        .foregroundStyle(accent)
        .padding(.horizontal, Theme.Spacing.s3)
        .padding(.vertical, 6)
        .background(accent.opacity(0.15), in: Capsule())
        .overlay(Capsule().strokeBorder(accent.opacity(0.45), lineWidth: 1))
        .frame(maxWidth: .infinity)
    }

    private func scenarioCard(_ body: String) -> some View {
        Button(action: { startConversation(with: body) }) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                HStack {
                    Text("Scenario 1")
                        .font(Theme.FontStyle.timestamp.weight(.semibold))
                        .foregroundStyle(accent)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(accent.opacity(0.18), in: Capsule())
                    Spacer(minLength: 0)
                    Text("Opening scene")
                        .font(Theme.FontStyle.timestamp)
                        .foregroundStyle(Theme.Color.fg3)
                }
                Text(body)
                    .font(Theme.FontStyle.body)
                    .foregroundStyle(Theme.Color.fg1)
                    .lineLimit(4)
                    .multilineTextAlignment(.leading)
                HStack(spacing: Theme.Spacing.s2) {
                    if creating {
                        ProgressView().tint(accent)
                    }
                    Text(creating ? startProgressLabel : "Start this scene")
                        .font(Theme.FontStyle.body.weight(.semibold))
                        .foregroundStyle(accent)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(accent)
                }
            }
            .padding(Theme.Spacing.s4)
            .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.card)
                    .strokeBorder(accent.opacity(0.45), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(creating)
    }

    private var emptyScenarioCard: some View {
        Button(action: { startConversation(with: nil) }) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Text("Start fresh")
                    .font(Theme.FontStyle.body.weight(.semibold))
                    .foregroundStyle(accent)
                Text("No scenario set yet — open an empty chat and write your own first line.")
                    .font(Theme.FontStyle.meta)
                    .foregroundStyle(Theme.Color.fg2)
            }
            .padding(Theme.Spacing.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.bg2, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.card)
                    .strokeBorder(Theme.Color.borderSoft, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(creating)
    }

    private func startConversation(with scenarioBody: String?) {
        guard !creating else { return }
        creating = true
        startError = nil
        startProgressLabel = "Starting…"
        Haptics.impact(.medium)
        Task {
            do {
                let conversationID = try await createConversationWithRetry(scenarioBody: scenarioBody)
                creating = false
                newConversationID = conversationID
            } catch {
                let detail = error.localizedDescription
                landingLog.error("create conversation failed: \(detail, privacy: .public)")
                startError = Self.userFacing(error: detail)
                creating = false
            }
        }
    }

    /// Keep retry/cold-start copy when the failure looks like a transient
    /// network problem; otherwise surface the actual backend message so the
    /// underlying schema/auth issue is visible instead of the generic catch.
    private static func userFacing(error detail: String) -> String {
        let lower = detail.lowercased()
        if lower.contains("offline")
            || lower.contains("network connection")
            || lower.contains("timed out")
            || lower.contains("could not be found") {
            return "Couldn't start a conversation. Check your connection and try again."
        }
        if detail.isEmpty {
            return "Couldn't start a conversation. Try again in a moment."
        }
        return detail
    }

    private func createConversationWithRetry(scenarioBody: String?) async throws -> String {
        do {
            return try await createConversation(scenarioBody: scenarioBody)
        } catch {
            // Backend may be cold-starting on Render Free — give it a second
            // and try once more before surfacing an error.
            startProgressLabel = "Waking up the backend…"
            landingLog.info("first attempt failed (likely cold start), retrying once")
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            return try await createConversation(scenarioBody: scenarioBody)
        }
    }

    private func createConversation(scenarioBody: String?) async throws -> String {
        // Conversations RLS requires user_id = auth.uid(). The backend also
        // expects a character_snapshot, writing_style_snapshot, and (optionally)
        // a persona_id per `base/frontend/src/lib/conversations.ts:161-167`.
        let session = try await client.auth.session
        let userID = session.user.id.uuidString

        // Best-effort: pick the user's primary persona so /chat can address them
        // by the right name. Failure here is non-fatal — the conversation can
        // still be created with persona_id = nil.
        let personaID: String? = await Self.fetchPrimaryPersonaID(client: client)

        struct CharacterSnapshotPayload: Encodable {
            let name: String
            let system_prompt: String?
            let mode: String?
            let scenario: String?
        }
        // Empty-dict snapshot until we surface a writing-style picker on iOS;
        // matches the web's `styleRow ? buildWritingStyleSnapshot(styleRow) : {}`
        // fallback when the user has no active style.
        struct EmptySnapshot: Encodable {}
        struct ConvInsert: Encodable {
            let user_id: String
            let character_id: String
            let title: String
            let character_snapshot: CharacterSnapshotPayload
            let writing_style_snapshot: EmptySnapshot
            let persona_id: String?
        }

        let snapshot = CharacterSnapshotPayload(
            name: character.name,
            system_prompt: character.system_prompt,
            mode: character.mode,
            scenario: character.scenario
        )
        let title = scenarioBody == nil ? character.name : "\(character.name) · Scenario"
        let payload = ConvInsert(
            user_id: userID,
            character_id: character.id,
            title: title,
            character_snapshot: snapshot,
            writing_style_snapshot: EmptySnapshot(),
            persona_id: personaID
        )

        let inserted: [Conversation] = try await client
            .from("conversations")
            .insert(payload)
            .select("id, title, character_id, character_snapshot, last_message_at, updated_at")
            .execute()
            .value
        guard let row = inserted.first else {
            throw NSError(domain: "CharacterLanding", code: -1, userInfo: [NSLocalizedDescriptionKey: "Empty conversation insert"])
        }
        if let scenarioBody, !scenarioBody.isEmpty {
            struct MsgInsert: Encodable {
                let conversation_id: String
                let role: String
                let text: String
            }
            try await client
                .from("messages")
                .insert(MsgInsert(conversation_id: row.id, role: "assistant", text: scenarioBody))
                .execute()
        }
        return row.id
    }

    private static func fetchPrimaryPersonaID(client: SupabaseClient) async -> String? {
        struct Row: Decodable { let id: String }
        do {
            let rows: [Row] = try await client
                .from("user_personas")
                .select("id")
                .order("created_at", ascending: true)
                .limit(1)
                .execute()
                .value
            return rows.first?.id
        } catch {
            return nil
        }
    }
}


/// Sheet body opened from the conversations-list trailing toolbar item.
/// Fetches every conversation the user has with this character and renders
/// the existing `CharacterChatsView` once they land. Mirrors
/// `CharacterChatsLoader` in `ChatView.swift` but pulls directly via the
/// Supabase client (no ChatViewModel handy in this surface).
struct CharacterLandingChatsLoader: View {
    let character: Character
    let accent: Color
    let avatarRef: String?
    let client: SupabaseClient
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
            let session = try await client.auth.session
            let rows: [Conversation] = try await client
                .from("conversations")
                .select("id, title, character_id, character_snapshot, last_message_at, updated_at")
                .eq("user_id", value: session.user.id.uuidString)
                .eq("character_id", value: character.id)
                .order("updated_at", ascending: false)
                .execute()
                .value
            conversations = rows
            didLoad = true
        } catch {
            loadingError = error.localizedDescription
            didLoad = true
        }
    }
}
