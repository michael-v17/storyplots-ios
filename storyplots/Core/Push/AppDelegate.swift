import UIKit
import UserNotifications

/// UIKit-side AppDelegate so we can receive APNs token callbacks and route
/// notification taps. Bridged into SwiftUI via @UIApplicationDelegateAdaptor
/// in `storyplotsApp`.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    nonisolated func application(_ application: UIApplication,
                                 didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in
            PushService.shared.didRegister(deviceToken: deviceToken)
        }
    }

    nonisolated func application(_ application: UIApplication,
                                 didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in
            PushService.shared.didFailToRegister(error: error)
        }
    }

    // Foreground presentation — show banner + sound for any incoming.
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter,
                                            willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        return [.banner, .sound, .badge]
    }

    // Tap handler — currently logs; Phase 10.x routes by payload `conversation_id`.
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter,
                                            didReceive response: UNNotificationResponse) async {
        // Placeholder for deep-link routing into a specific conversation.
    }
}
