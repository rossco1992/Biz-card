import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { registerTextReminderDevice } from "@/lib/text-reminders";
import { useSession } from "@/providers/session-provider";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function NotificationBridge() {
  const { session } = useSession();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    function open(notification: Notifications.Notification) {
      const data = notification.request.content.data;
      const followupId = typeof data?.followupId === "string" ? data.followupId : null;
      if (data?.kind !== "text_followup" || !followupId) return;
      const key = `${notification.request.identifier}:${followupId}`;
      if (handled.current === key) return;
      handled.current = key;
      router.push({ pathname: "/text-followup", params: { followupId } });
    }

    const initial = Notifications.getLastNotificationResponse();
    if (initial?.notification) open(initial.notification);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => open(response.notification));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    void registerTextReminderDevice(session.access_token, false).catch(() => {
      // Registration is best-effort here. The Automations screen exposes any
      // permission/setup issue and lets the member retry explicitly.
    });
  }, [session?.access_token]);

  return null;
}
