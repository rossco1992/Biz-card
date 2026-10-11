import { NativeEventEmitter, NativeModules, Platform } from "react-native";

type Authorization = {
  granted: boolean;
  deviceToken?: string | null;
  environment?: "development" | "production";
};

type NativeNotificationsModule = {
  requestAuthorization(): Promise<Authorization>;
  getAuthorizationStatus(): Promise<Authorization>;
  getInitialNotification(): Promise<Record<string, unknown> | null>;
};

const module = NativeModules.KNCTNotifications as NativeNotificationsModule | undefined;

export function nativeNotificationsAvailable() {
  return Platform.OS === "ios" && Boolean(module);
}

export async function requestNativeNotificationAuthorization() {
  if (!module) throw new Error("Native notification support is not installed in this iOS build.");
  return module.requestAuthorization();
}

export async function getNativeNotificationAuthorization() {
  if (!module) return { granted: false } satisfies Authorization;
  return module.getAuthorizationStatus();
}

export async function getInitialNativeNotification() {
  if (!module) return null;
  return module.getInitialNotification();
}

export function addNativeNotificationOpenedListener(
  handler: (payload: Record<string, unknown>) => void,
) {
  if (!module) return { remove() {} };
  const emitter = new NativeEventEmitter(NativeModules.KNCTNotifications);
  return emitter.addListener("KNCTRemoteNotificationOpened", handler);
}
