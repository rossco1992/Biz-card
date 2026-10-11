import Foundation
import MessageUI
import React
import UIKit

@objc(KNCTMessages)
final class KNCTMessages: NSObject, MFMessageComposeViewControllerDelegate {
  private var pendingResolve: RCTPromiseResolveBlock?

  @objc
  static func requiresMainQueueSetup() -> Bool {
    true
  }

  @objc(compose:body:resolver:rejecter:)
  func compose(
    _ recipient: String,
    body: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      guard MFMessageComposeViewController.canSendText() else {
        reject("messages_unavailable", "Messages is not available on this device.", nil)
        return
      }

      guard self.pendingResolve == nil else {
        reject("messages_busy", "A message composer is already open.", nil)
        return
      }

      guard let presenter = Self.topViewController() else {
        reject("messages_presenter", "Could not open Messages.", nil)
        return
      }

      let composer = MFMessageComposeViewController()
      composer.messageComposeDelegate = self
      composer.recipients = [recipient]
      composer.body = body
      self.pendingResolve = resolve
      presenter.present(composer, animated: true)
    }
  }

  func messageComposeViewController(
    _ controller: MFMessageComposeViewController,
    didFinishWith result: MessageComposeResult
  ) {
    let value: String
    switch result {
    case .sent:
      value = "sent"
    case .cancelled:
      value = "cancelled"
    case .failed:
      value = "failed"
    @unknown default:
      value = "failed"
    }

    let resolve = pendingResolve
    pendingResolve = nil
    controller.dismiss(animated: true) {
      resolve?(value)
    }
  }

  private static func topViewController(
    from root: UIViewController? = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first(where: { $0.isKeyWindow })?
      .rootViewController
  ) -> UIViewController? {
    if let navigation = root as? UINavigationController {
      return topViewController(from: navigation.visibleViewController)
    }
    if let tab = root as? UITabBarController {
      return topViewController(from: tab.selectedViewController)
    }
    if let presented = root?.presentedViewController {
      return topViewController(from: presented)
    }
    return root
  }
}
