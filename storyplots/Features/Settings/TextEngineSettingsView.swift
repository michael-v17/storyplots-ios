import SwiftUI
import Supabase

@MainActor
@Observable
final class TextEngineViewModel {
    enum LoadState: Sendable, Equatable {
        case idle, loading, loaded, error(String)
    }

    private(set) var loadState: LoadState = .idle
    private(set) var active: ProviderConfig?
    private(set) var testState: TestState = .idle

    enum TestState: Sendable, Equatable {
        case idle
        case testing
        case ok(model: String?)
        case failed(String)
    }

    private let client: SupabaseClient

    init(client: SupabaseClient) {
        self.client = client
    }

    func load() async {
        loadState = .loading
        do {
            let rows: [ProviderConfig] = try await client
                .from("provider_configs")
                .select("id, kind, provider_family, base_url, model_id, temperature, max_tokens, context_length, thinking_mode, last_tested_ok, last_tested_at, is_active, updated_at")
                .eq("kind", value: "text")
                .eq("is_active", value: true)
                .limit(1)
                .execute()
                .value
            self.active = rows.first
            self.loadState = .loaded
        } catch {
            self.loadState = .error(error.localizedDescription)
        }
    }

    /// POST /providers/test against the backend with the user's JWT.
    func test() async {
        testState = .testing
        do {
            let session = try await client.auth.session
            var req = URLRequest(url: BackendConfig.url.appendingPathComponent("providers/test"))
            req.httpMethod = "POST"
            req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let (data, _) = try await URLSession.shared.data(for: req)
            struct Result: Decodable {
                let ok: Bool
                let model: String?
                let error: String?
            }
            let result = try JSONDecoder().decode(Result.self, from: data)
            if result.ok {
                testState = .ok(model: result.model)
            } else {
                testState = .failed(result.error ?? "Test failed")
            }
        } catch {
            testState = .failed(error.localizedDescription)
        }
    }
}

struct TextEngineSettingsView: View {
    @State private var model: TextEngineViewModel

    init(client: SupabaseClient) {
        _model = State(initialValue: TextEngineViewModel(client: client))
    }

    var body: some View {
        Form {
            switch model.loadState {
            case .idle, .loading:
                Section { ProgressView().frame(maxWidth: .infinity).tint(Theme.Color.brand1) }
            case .error(let m):
                Section {
                    Text(m).foregroundStyle(Theme.Color.destructive).font(Theme.FontStyle.meta)
                }
            case .loaded:
                if let provider = model.active {
                    Section("Active provider") {
                        row("Provider", provider.provider_family.capitalized)
                        if let url = provider.base_url, !url.isEmpty {
                            row("Base URL", url)
                        }
                        if let modelID = provider.model_id, !modelID.isEmpty {
                            row("Model", modelID)
                        }
                        if let t = provider.temperature {
                            row("Temperature", String(format: "%.2f", t))
                        }
                        if let m = provider.max_tokens {
                            row("Max tokens", "\(m)")
                        }
                        if let c = provider.context_length {
                            row("Context length", "\(c)")
                        }
                        if let thinking = provider.thinking_mode {
                            row("Thinking mode", thinking ? "On" : "Off")
                        }
                    }
                    Section("Last test") {
                        if let ok = provider.last_tested_ok {
                            HStack {
                                Image(systemName: ok ? "checkmark.circle.fill" : "xmark.circle.fill")
                                    .foregroundStyle(ok ? Theme.Color.success : Theme.Color.destructive)
                                Text(ok ? "Passed" : "Failed")
                            }
                            if let at = provider.last_tested_at {
                                row("At", relative(at))
                            }
                        } else {
                            Text("Never tested").foregroundStyle(Theme.Color.fg3).font(.subheadline)
                        }
                    }
                    Section {
                        Button {
                            Task { await model.test() }
                        } label: {
                            HStack {
                                if case .testing = model.testState {
                                    ProgressView().tint(Theme.Color.brand1)
                                } else {
                                    Image(systemName: "bolt.fill")
                                }
                                Text(testButtonLabel)
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .disabled(model.testState == .testing)

                        if case .ok(let modelName) = model.testState {
                            Text("Reached \(modelName ?? "the model"). Connection healthy.")
                                .font(Theme.FontStyle.meta)
                                .foregroundStyle(Theme.Color.success)
                        }
                        if case .failed(let m) = model.testState {
                            Text(m)
                                .font(Theme.FontStyle.meta)
                                .foregroundStyle(Theme.Color.destructive)
                        }
                    }
                } else {
                    Section {
                        Text("No active text provider. Configure one on the web app — iOS will pick it up automatically.")
                            .font(Theme.FontStyle.meta)
                            .foregroundStyle(Theme.Color.fg3)
                    }
                }
            }
        }
        .navigationTitle("Text Engine")
        .navigationBarTitleDisplayMode(.inline)
        .task { if model.loadState == .idle { await model.load() } }
        .refreshable { await model.load() }
        .toolbarBackground(Theme.Material.navBar, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
    }

    private var testButtonLabel: String {
        switch model.testState {
        case .testing: return "Testing…"
        case .idle, .ok, .failed: return "Run test"
        }
    }

    private func row(_ key: String, _ value: String) -> some View {
        HStack {
            Text(key).foregroundStyle(Theme.Color.fg2)
            Spacer()
            Text(value).foregroundStyle(Theme.Color.fg).multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
    }

    private func relative(_ iso: String) -> String {
        let f1 = ISO8601DateFormatter()
        f1.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let f2 = ISO8601DateFormatter()
        f2.formatOptions = [.withInternetDateTime]
        guard let date = f1.date(from: iso) ?? f2.date(from: iso) else { return iso }
        let fmt = RelativeDateTimeFormatter()
        fmt.unitsStyle = .short
        return fmt.localizedString(for: date, relativeTo: Date())
    }
}
