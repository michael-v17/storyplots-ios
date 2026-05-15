import Foundation
import Observation
import OSLog
import Supabase

private let dashLog = Logger(subsystem: "com.storyplots.ios", category: "grammar-dashboard")

struct GrammarAggregate: Decodable, Sendable, Equatable {
    let last_aggregate_pct: Double?
    let total_corrections: Int?
    let error_categories: [String: Int]?
    let updated_at: String?
}

@MainActor
@Observable
final class GrammarDashboardViewModel {
    enum LoadState: Sendable, Equatable {
        case idle
        case loading
        case loaded
        case error(String)
    }

    enum RunState: Sendable, Equatable {
        case idle
        case running
        case done
        case failed(String)
    }

    private(set) var loadState: LoadState = .idle
    private(set) var runState: RunState = .idle
    private(set) var aggregate: GrammarAggregate?
    private(set) var corrections: [GrammarCorrection] = []

    let client: SupabaseClient

    init(client: SupabaseClient) {
        self.client = client
    }

    var accuracy: Double? { aggregate?.last_aggregate_pct }
    var totalCorrections: Int { aggregate?.total_corrections ?? corrections.count }

    var topCategories: [(name: String, count: Int)] {
        let bag: [String: Int]
        if let stored = aggregate?.error_categories, !stored.isEmpty {
            bag = stored
        } else {
            var tally: [String: Int] = [:]
            for row in corrections {
                for cat in row.error_categories ?? [] {
                    tally[cat, default: 0] += 1
                }
            }
            bag = tally
        }
        return bag.sorted { $0.value > $1.value }.prefix(3).map { ($0.key, $0.value) }
    }

    func load() async {
        loadState = .loading
        do {
            async let aggregateTask = fetchAggregate()
            async let correctionsTask = fetchCorrections()
            let (agg, corr) = try await (aggregateTask, correctionsTask)
            self.aggregate = agg
            self.corrections = corr
            self.loadState = .loaded
        } catch {
            dashLog.error("load failed: \(error.localizedDescription, privacy: .public)")
            self.loadState = .error(error.localizedDescription)
        }
    }

    func runInsights() async {
        runState = .running
        do {
            let session = try await client.auth.session
            let jwt = session.accessToken
            var request = URLRequest(url: BackendConfig.url.appendingPathComponent("insights").appendingPathComponent("run"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
            request.httpBody = Data("{}".utf8)
            request.timeoutInterval = 90
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                runState = .failed("Failed (HTTP \(code))")
                return
            }
            runState = .done
            await load()
        } catch {
            dashLog.error("runInsights failed: \(error.localizedDescription, privacy: .public)")
            runState = .failed(error.localizedDescription)
        }
    }

    // MARK: queries

    private func fetchAggregate() async -> GrammarAggregate? {
        do {
            let rows: [GrammarAggregate] = try await client
                .from("grammar_aggregates")
                .select("last_aggregate_pct, total_corrections, error_categories, updated_at")
                .limit(1)
                .execute()
                .value
            return rows.first
        } catch {
            dashLog.info("grammar_aggregates unavailable: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    private func fetchCorrections() async throws -> [GrammarCorrection] {
        try await client
            .from("grammar_corrections")
            .select("id, conversation_id, user_message_id, original_text, corrected_text, explanation, error_categories, edit_distance, created_at")
            .order("created_at", ascending: false)
            .limit(20)
            .execute()
            .value
    }
}
