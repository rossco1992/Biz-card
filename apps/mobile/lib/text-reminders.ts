import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { resolveWebUrl } from "@biz-card/core";

export type TextReminderPermission = "granted" | "denied" | "undetermined";

export async function textReminderPermission(): Promise<TextReminderPermission> {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status === "granted") return "granted";
  if (permission.status === "denied") return "denied";
  return "undetermined";
}

export async function registerTextReminderDevice(accessToken: string, requestPermission: boolean) {
  if (Platform.OS === "web") return { status: "unsupported" as const };

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("followups", {
      name: "Follow-up reminders",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted" && requestPermission) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== "granted") {
    return { status: permission.status === "denied" ? "denied" as const : "undetermined" as const };
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error("KNCT push notifications are missing an EAS project ID.");

  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const base = resolveWebUrl(process.env.EXPO_PUBLIC_WEB_URL).replace(/\/$/, "");
  const response = await fetch(`${base}/api/push/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expo_push_token: expoPushToken,
      platform: Platform.OS,
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "Could not enable follow-up reminders.");

  return { status: "granted" as const };
}
