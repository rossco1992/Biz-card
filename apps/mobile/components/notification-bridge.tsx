import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  addNativeNotificationOpenedListener,
  getInitialNativeNotification,
} from "@/lib/native-notifications";
import { registerTextReminderDevice } from "@/lib/text-reminders";
import { useSession } from "@/providers/session-provider";

export function NotificationBridge() {
  const { session } = useSession();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    function open(data: Record<string, unknown> | null) {
      if (!data) return;
      const followupId = typeof data.followupId === "string" ? data.followupId : null;
      if (data.kind !== "text_followup" || !followupId) return;
      if (handled.current === followupId) return;
      handled.current = followupId;
      router.push({ pathname: "/text-followup", params: { followupId } });
    }

    void getInitialNativeNotification().then(open).catch(() => undefined);
    const subscription = addNativeNotificationOpenedListener(open);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    void registerTextReminderDevice(session.access_token, false).catch(() => {
      // Best-effort refresh of the APNs token on app launch. The Automations
      // screen lets the member explicitly enable notifications if needed.
    });
  }, [session?.access_token]);

  return null;
}
