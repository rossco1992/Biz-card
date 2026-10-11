import Foundation
import React
import UIKit
import UserNotifications

@objc(KNCTNotifications)
final class KNCTNotifications: RCTEventEmitter {
  private static var shared: KNCTNotifications?
  private static var deviceToken: String?
  private static var pendingNotification: [AnyHashable: Any]?
  private static var pendingResolve: RCTPromiseResolveBlock?
  private static var pendingReject: RCTPromiseRejectBlock?
  private var listening = false

  override init() {
    super.init()
    KNCTNotifications.shared = self
  }

  @objc
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func supportedEvents() -> [String]! {
    ["KNCTRemoteNotificationOpened"]
  }

  override func startObserving() {
    listening = true
    if let payload = KNCTNotifications.pendingNotification {
      sendEvent(withName: "KNCTRemoteNotificationOpened", body: payload)
      KNCTNotifications.pendingNotification = nil
    }
  }

  override func stopObserving() {
    listening = false
  }

  private static var environment: String {
    #if DEBUG
    return "development"
    #else
    return "production"
    #endif
  }

  @objc(requestAuthorization:rejecter:)
  func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, error in
      if let error {
        reject("notification_permission", error.localizedDescription, error)
        return
      }
      guard granted else {
        resolve(["granted": false, "environment": KNCTNotifications.environment])
        return
      }

      DispatchQueue.main.async {
        KNCTNotifications.pendingResolve = resolve
        KNCTNotifications.pendingReject = reject
        UIApplication.shared.registerForRemoteNotifications()
      }
    }
  }

  @objc(getAuthorizationStatus:rejecter:)
  func getAuthorizationStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      let granted = settings.authorizationStatus == .authorized
        || settings.authorizationStatus == .provisional
        || settings.authorizationStatus == .ephemeral
      resolve([
        "granted": granted,
        "deviceToken": KNCTNotifications.deviceToken as Any,
        "environment": KNCTNotifications.environment,
      ])
    }
  }

  @objc(getInitialNotification:rejecter:)
  func getInitialNotification(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    let payload = KNCTNotifications.pendingNotification
    KNCTNotifications.pendingNotification = nil
    resolve(payload)
  }

  @objc
  static func didRegisterForRemoteNotifications(withDeviceToken tokenData: Data) {
    let token = tokenData.map { String(format: "%02x", $0) }.joined()
    deviceToken = token

    if let resolve = pendingResolve {
      pendingResolve = nil
      pendingReject = nil
      resolve([
        "granted": true,
        "deviceToken": token,
        "environment": environment,
      ])
    }
  }

  @objc
  static func didFailToRegisterForRemoteNotifications(_ error: Error) {
    if let reject = pendingReject {
      pendingResolve = nil
      pendingReject = nil
      reject("notification_registration", error.localizedDescription, error)
    }
  }

  @objc
  static func handleNotificationResponse(_ userInfo: [AnyHashable: Any]) {
    if let current = shared, current.listening {
      current.sendEvent(withName: "KNCTRemoteNotificationOpened", body: userInfo)
    } else {
      pendingNotification = userInfo
    }
  }
}
