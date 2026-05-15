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
        .brandTopWash()
        .navigationTitle(character.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
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
    }

    private struct ConversationDestination: Hashable {
        let id: String
    }

    private var hero: some View {
        VStack(spacing: Theme.Spacing.s3) {
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
                    Text(creating ? "Starting…" : "Start this scene")
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
        Haptics.impact(.medium)
        Task {
            do {
                let conversationID = try await createConversation(scenarioBody: scenarioBody)
                creating = false
                newConversationID = conversationID
            } catch {
                landingLog.error("create conversation failed: \(error.localizedDescription, privacy: .public)")
                startError = "Couldn't start a conversation. Try again."
                creating = false
            }
        }
    }

    private func createConversation(scenarioBody: String?) async throws -> String {
        struct ConvInsert: Encodable {
            let character_id: String
            let title: String
        }
        let title = scenarioBody == nil ? character.name : "\(character.name) · Scenario"
        let inserted: [Conversation] = try await client
            .from("conversations")
            .insert(ConvInsert(character_id: character.id, title: title))
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
}
