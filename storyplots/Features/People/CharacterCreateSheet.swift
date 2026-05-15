import SwiftUI
import Supabase

/// 3-step wizard for crafting a character — Identity, Persona, Style. Uses
/// native Form sections with footer hints so the chrome stays iOS-native.
struct CharacterCreateSheet: View {
    @State private var model: CharacterEditViewModel
    @State private var step: Step = .identity
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focusedField: Field?
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

        var heading: String {
            switch self {
            case .identity: return "Who are they?"
            case .persona:  return "What's the scene?"
            case .style:    return "Pick their look."
            }
        }
    }

    private enum Field: Hashable { case name, tagline, scenario, systemPrompt }

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
                .animation(Theme.Motion.snappy, value: step)

                footerBar
            }
            .background(Theme.Color.bg)
            .navigationTitle("New character")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.Color.fg2)
                }
            }
        }
    }

    // MARK: Pages

    private var identityStep: some View {
        Form {
            Section {
                TextField("Name", text: $model.name)
                    .focused($focusedField, equals: .name)
                    .submitLabel(.next)
                    .onSubmit { focusedField = .tagline }
                TextField("Tagline (optional)", text: $model.tagline)
                    .focused($focusedField, equals: .tagline)
                    .submitLabel(.done)
                    .onSubmit { focusedField = nil }
            } header: {
                stepHeading(.identity)
            } footer: {
                Text("A short, memorable name plus an optional one-liner that frames who the character is. You can tweak both later.")
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.Color.bg)
    }

    private var personaStep: some View {
        Form {
            Section {
                TextField("Where do you meet them?", text: $model.scenario, axis: .vertical)
                    .focused($focusedField, equals: .scenario)
                    .lineLimit(3...8)
            } header: {
                stepHeading(.persona)
            } footer: {
                Text("The opening scenario sets the scene every conversation starts in.")
            }

            Section {
                TextField("Personality, voice, rules…", text: $model.systemPrompt, axis: .vertical)
                    .focused($focusedField, equals: .systemPrompt)
                    .lineLimit(5...20)
            } header: {
                Text("System prompt")
            } footer: {
                Text("The system prompt is the character's core voice — written in second person works well (\"You are Maya, a marine biologist…\").")
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.Color.bg)
    }

    private var styleStep: some View {
        Form {
            Section {
                AccentPicker(hex: $model.accentHex)
                    .padding(.vertical, Theme.Spacing.s2)
            } header: {
                stepHeading(.style)
            } footer: {
                Text("The accent shows up as the bubble border, header dot, and avatar ring in every chat with this character.")
            }

            if case .error(let m) = model.saveState {
                Section {
                    Text(m)
                        .font(Theme.FontStyle.meta)
                        .foregroundStyle(Theme.Color.destructive)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.Color.bg)
    }

    @ViewBuilder
    private func stepHeading(_ s: Step) -> some View {
        Text(s.heading)
            .font(Theme.FontStyle.subhead)
            .foregroundStyle(Theme.Color.fg)
            .textCase(nil)
            .padding(.bottom, 2)
    }

    // MARK: Chrome

    private var progressHeader: some View {
        VStack(spacing: Theme.Spacing.s2) {
            HStack(spacing: Theme.Spacing.s2) {
                ForEach(Step.allCases) { s in
                    Capsule()
                        .fill(s.rawValue <= step.rawValue
                              ? AnyShapeStyle(Theme.Color.brandGradient)
                              : AnyShapeStyle(Theme.Color.bg3))
                        .frame(height: 4)
                        .frame(maxWidth: .infinity)
                }
            }
            HStack(spacing: 0) {
                ForEach(Step.allCases) { s in
                    Text(s.title)
                        .font(Theme.FontStyle.timestamp.weight(s == step ? .semibold : .regular))
                        .foregroundStyle(s == step ? Theme.Color.fg : Theme.Color.fg4)
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(.horizontal, Theme.Spacing.s4)
        .padding(.top, Theme.Spacing.s2)
        .padding(.bottom, Theme.Spacing.s3)
        .background(Theme.Color.bg)
    }

    private var footerBar: some View {
        HStack(spacing: Theme.Spacing.s3) {
            Button {
                Haptics.selection()
                withAnimation(Theme.Motion.snappy) { goBack() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 13, weight: .semibold))
                    Text("Back")
                        .font(Theme.FontStyle.body.weight(.medium))
                }
                .foregroundStyle(step == .identity ? Theme.Color.fg4 : Theme.Color.fg1)
                .padding(.horizontal, Theme.Spacing.s4)
                .padding(.vertical, Theme.Spacing.s3)
                .background(Theme.Color.bg2, in: Capsule())
                .overlay(Capsule().strokeBorder(Theme.Color.borderSoft, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(step == .identity)
            .opacity(step == .identity ? 0.5 : 1)

            Spacer(minLength: 0)

            primaryButton
        }
        .padding(.horizontal, Theme.Spacing.s4)
        .padding(.vertical, Theme.Spacing.s3)
        .background(.thinMaterial)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.Color.borderSoft)
                .frame(height: 0.5)
        }
    }

    @ViewBuilder
    private var primaryButton: some View {
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
                primaryLabel(model.saveState == .saving ? "Creating…" : "Create character",
                             systemImage: model.saveState == .saving ? nil : "sparkles")
            }
            .buttonStyle(.plain)
            .disabled(!model.canSave || model.saveState == .saving)
            .opacity(model.canSave && model.saveState != .saving ? 1 : 0.55)
        } else {
            Button {
                Haptics.selection()
                focusedField = nil
                withAnimation(Theme.Motion.snappy) { goForward() }
            } label: {
                primaryLabel("Next", systemImage: "chevron.right", trailing: true)
            }
            .buttonStyle(.plain)
            .disabled(!canGoForward)
            .opacity(canGoForward ? 1 : 0.55)
        }
    }

    @ViewBuilder
    private func primaryLabel(_ title: String, systemImage: String?, trailing: Bool = false) -> some View {
        HStack(spacing: 6) {
            if !trailing, let systemImage {
                Image(systemName: systemImage)
                    .font(.system(size: 13, weight: .bold))
            }
            Text(title)
                .font(Theme.FontStyle.body.weight(.semibold))
            if trailing, let systemImage {
                Image(systemName: systemImage)
                    .font(.system(size: 13, weight: .bold))
            }
        }
        .foregroundStyle(Theme.Color.fgOnBrand)
        .padding(.horizontal, Theme.Spacing.s5)
        .padding(.vertical, Theme.Spacing.s3)
        .background(Theme.Color.brandGradient, in: Capsule())
        .shadow(color: Theme.Color.brand2.opacity(0.3), radius: 10, y: 4)
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
