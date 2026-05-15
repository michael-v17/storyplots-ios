import SwiftUI
import Supabase

/// Minimal create flow per `seed/roadmap.md` §Fase 6. Single sheet (rather
/// than 3-step wizard) for speed — Phase 7+ can split into wizard if the
/// scope justifies it.
struct CharacterCreateSheet: View {
    @State private var model: CharacterEditViewModel
    @State private var step: Step = .identity
    @Environment(\.dismiss) private var dismiss
    let onSaved: (String) -> Void

    enum Step: Int, CaseIterable, Identifiable {
        case identity, persona, style
        var id: Int { rawValue }
        var title: String {
            switch self {
            case .identity: return "Identity"
            case .persona:  return "Persona"
            case .style:    return "Style"
            }
        }
    }

    init(client: SupabaseClient, onSaved: @escaping (String) -> Void) {
        _model = State(initialValue: CharacterEditViewModel(client: client))
        self.onSaved = onSaved
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                progressHeader

                TabView(selection: $step) {
                    identityStep.tag(Step.identity)
                    personaStep.tag(Step.persona)
                    styleStep.tag(Step.style)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

                footerBar
            }
            .navigationTitle("New character")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    // MARK: Pages

    private var identityStep: some View {
        Form {
            Section("Who are they?") {
                TextField("Name", text: $model.name)
                TextField("Tagline (optional)", text: $model.tagline)
            }
            Section {
                Text("A short, memorable name + an optional one-liner that frames who the character is. You can tweak both later.")
                    .font(Theme.FontStyle.meta).foregroundStyle(Theme.Color.fg3)
            }
        }
    }

    private var personaStep: some View {
        Form {
            Section("Opening scenario") {
                TextField("Where do you meet them?", text: $model.scenario, axis: .vertical)
                    .lineLimit(3...8)
            }
            Section("System prompt") {
                TextField("Personality, voice, rules…", text: $model.systemPrompt, axis: .vertical)
                    .lineLimit(5...20)
            }
            Section {
                Text("The system prompt is the character's core voice — written in second person works well (\"You are Maya, a marine biologist…\").")
                    .font(Theme.FontStyle.meta).foregroundStyle(Theme.Color.fg3)
            }
        }
    }

    private var styleStep: some View {
        Form {
            Section("Accent color") {
                AccentPicker(hex: $model.accentHex)
                    .padding(.vertical, Theme.Spacing.s2)
            }
            Section {
                Text("The accent shows up as the bubble border, header dot, and avatar ring in every chat with this character.")
                    .font(Theme.FontStyle.meta).foregroundStyle(Theme.Color.fg3)
            }
            if case .error(let m) = model.saveState {
                Section {
                    Text(m).foregroundStyle(Theme.Color.destructive).font(Theme.FontStyle.meta)
                }
            }
        }
    }

    // MARK: Chrome

    private var progressHeader: some View {
        HStack(spacing: Theme.Spacing.s2) {
            ForEach(Step.allCases) { s in
                VStack(spacing: Theme.Spacing.s1) {
                    Capsule()
                        .fill(s.rawValue <= step.rawValue
                              ? AnyShapeStyle(Theme.Color.brandGradient)
                              : AnyShapeStyle(Theme.Color.bg3))
                        .frame(height: 4)
                    Text(s.title)
                        .font(Theme.FontStyle.timestamp)
                        .foregroundStyle(s == step ? Theme.Color.fg : Theme.Color.fg3)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, Theme.Spacing.s4)
        .padding(.vertical, Theme.Spacing.s2)
    }

    private var footerBar: some View {
        HStack {
            Button {
                Haptics.selection()
                withAnimation(Theme.Motion.snappy) { goBack() }
            } label: {
                Text("Back")
            }
            .disabled(step == .identity)
            Spacer()
            if step == .style {
                Button {
                    Haptics.notify(.success)
                    Task {
                        if let id = await model.save() {
                            onSaved(id)
                            dismiss()
                        }
                    }
                } label: {
                    Text("Create")
                        .font(Theme.FontStyle.body.weight(.semibold))
                        .padding(.horizontal, Theme.Spacing.s4)
                        .padding(.vertical, Theme.Spacing.s2)
                        .foregroundStyle(Theme.Color.fgOnBrand)
                        .background(Theme.Color.brandGradient, in: Capsule())
                }
                .disabled(!model.canSave)
            } else {
                Button {
                    Haptics.selection()
                    withAnimation(Theme.Motion.snappy) { goForward() }
                } label: {
                    Text("Next")
                        .font(Theme.FontStyle.body.weight(.semibold))
                        .padding(.horizontal, Theme.Spacing.s4)
                        .padding(.vertical, Theme.Spacing.s2)
                        .foregroundStyle(Theme.Color.fgOnBrand)
                        .background(Theme.Color.brandGradient, in: Capsule())
                }
                .disabled(!canGoForward)
            }
        }
        .padding(.horizontal, Theme.Spacing.s4)
        .padding(.vertical, Theme.Spacing.s3)
        .background(.thinMaterial)
    }

    private var canGoForward: Bool {
        switch step {
        case .identity: return !model.name.trimmingCharacters(in: .whitespaces).isEmpty
        case .persona:  return !model.systemPrompt.trimmingCharacters(in: .whitespaces).isEmpty
        case .style:    return model.canSave
        }
    }

    private func goBack() {
        if let prev = Step(rawValue: step.rawValue - 1) { step = prev }
    }

    private func goForward() {
        if let next = Step(rawValue: step.rawValue + 1) { step = next }
    }
}
