import Foundation
import UserNotifications
import UIKit
import OSLog

private let pushLog = Logger(subsystem: "com.storyplots.ios", category: "push")

/// Phase 10 client-side push scaffolding. Requests permission, registers
/// for APNs, and hands off the device token to the backend endpoint
/// `POST /api/v2/ios/push/register` (the backend route itself lives in
/// `base/backend` and is added separately by the creator per AUTONOMY.md
/// §"Backend / web" — Claude cannot create it autonomously).
@MainActor
final class PushService: NSObject {
    static let shared = PushService()

    private(set) var deviceToken: Data?
    private var pendingTokenPost: Task<Void, Never>?

    func requestAuthorizationAndRegister() async {
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
            pushLog.info("notifications authorization granted=\(granted, privacy: .public)")
            if granted {
                UIApplication.shared.registerForRemoteNotifications()
            }
        } catch {
            pushLog.error("authorization failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func didRegister(deviceToken raw: Data) {
        self.deviceToken = raw
        let hex = raw.map { String(format: "%02x", $0) }.joined()
        pushLog.info("device token registered length=\(hex.count, privacy: .public)")
        pendingTokenPost?.cancel()
        pendingTokenPost = Task { [weak self] in
            await self?.postToken(hex: hex)
        }
    }

    func didFailToRegister(error: Error) {
        pushLog.error("registerForRemoteNotifications failed: \(error.localizedDescription, privacy: .public)")
    }

    /// POST /api/v2/ios/push/register — backend wires this in Phase 10.x.
    /// Until the route exists, this Task will fail with a 404 and the error
    /// is logged but not surfaced to the user.
    private func postToken(hex: String) async {
        var request = URLRequest(url: BackendConfig.url.appendingPathComponent("api/v2/ios/push/register"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // The bearer is added once the backend route lands. SupabaseManager.shared.client
        // is the source of the JWT (mirrors AuthStore's makeChatRequest pattern).

        let payload: [String: Any] = [
            "device_token": hex,
            "environment": "sandbox",
            "bundle_id": Bundle.main.bundleIdentifier ?? "com.tecnologiasvm.storyplots",
            "app_version": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0",
            "locale": Locale.current.identifier
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let http = response as? HTTPURLResponse {
                pushLog.info("token POST status=\(http.statusCode, privacy: .public)")
            }
        } catch {
            pushLog.error("token POST failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}
