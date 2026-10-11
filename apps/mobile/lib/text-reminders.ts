import { resolveWebUrl } from "@biz-card/core";
import {
  getNativeNotificationAuthorization,
  nativeNotificationsAvailable,
  requestNativeNotificationAuthorization,
} from "@/lib/native-notifications";

export type TextReminderPermission = "granted" | "denied" | "undetermined";

export async function textReminderPermission(): Promise<TextReminderPermission> {
  if (!nativeNotificationsAvailable()) return "undetermined";
  const authorization = await getNativeNotificationAuthorization();
  return authorization.granted ? "granted" : "undetermined";
}

export async function registerTextReminderDevice(accessToken: string, requestPermission: boolean) {
  if (!nativeNotificationsAvailable()) return { status: "unsupported" as const };

  let authorization = await getNativeNotificationAuthorization();
  if (requestPermission || authorization.granted) {
    authorization = await requestNativeNotificationAuthorization();
  }

  if (!authorization.granted) {
    return { status: requestPermission ? "denied" as const : "undetermined" as const };
  }

  if (!authorization.deviceToken || !authorization.environment) {
    throw new Error("Apple push registration did not return a device token.");
  }

  const base = resolveWebUrl(process.env.EXPO_PUBLIC_WEB_URL).replace(/\/$/, "");
  const response = await fetch(`${base}/api/push/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      device_token: authorization.deviceToken,
      environment: authorization.environment,
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "Could not enable follow-up reminders.");

  return { status: "granted" as const };
}
