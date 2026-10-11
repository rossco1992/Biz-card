# KNCT native iOS integration

The Xcode project is not committed to this repository, so these source files must be added to the KNCT iOS application target.

## Add files to the app target

Add:

- KNCTNotifications.swift
- KNCTMessages.swift
- KNCTNativeModules.m

Make sure each file has the KNCT application target checked in Target Membership.

## Enable the Apple capability

In the KNCT application target:

1. Open **Signing & Capabilities**.
2. Add **Push Notifications**.
3. Confirm the built application's entitlements contain `aps-environment`.

## AppDelegate.swift

Make the app delegate conform to `UNUserNotificationCenterDelegate`, import `UserNotifications`, set the notification center delegate during launch, and forward APNs callbacks to `KNCTNotifications`.

Use this wiring alongside the app's existing launch code:

```swift
import UserNotifications

class AppDelegate: RCTAppDelegate, UNUserNotificationCenterDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    KNCTNotifications.didRegisterForRemoteNotifications(withDeviceToken: deviceToken)
  }

  override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    KNCTNotifications.didFailToRegisterForRemoteNotifications(error)
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .list, .sound])
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    KNCTNotifications.handleNotificationResponse(
      response.notification.request.content.userInfo
    )
    completionHandler()
  }
}
```

If the existing AppDelegate already implements any of these methods, merge the forwarding calls into the existing implementation instead of defining duplicates.
