import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Linking, Text } from "react-native";
import { Button, Card, Notice, uiStyles } from "@/components/ui";
import { registerTextReminderDevice, textReminderPermission, type TextReminderPermission } from "@/lib/text-reminders";
import { useSession } from "@/providers/session-provider";

export function SmsFollowups() {
  const { session } = useSession();
  const [permission, setPermission] = useState<TextReminderPermission>("undetermined");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await textReminderPermission();
      setPermission(next);
      setReady(next === "granted");
    } catch {
      setReady(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  async function enable() {
    if (!session?.access_token || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await registerTextReminderDevice(session.access_token, true);
      setPermission(result.status === "unsupported" ? "denied" : result.status);
      setReady(result.status === "granted");
      if (result.status !== "granted") setError("Allow KNCT notifications so we can remind you when a text is ready.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not enable text reminders.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={uiStyles.sectionTitle}>Text follow-up reminders</Text>
      <Text style={uiStyles.small}>
        KNCT prepares the message and reminds you at the right time. Tap the notification to open Messages with the contact and text already filled in; you make the final Send tap from your own number.
      </Text>

      {ready ? (
        <Notice tone="success">Notifications are on. Text reminders are ready.</Notice>
      ) : permission === "denied" ? (
        <>
          <Notice>Notifications are off, so KNCT cannot remind you when a text is ready.</Notice>
          <Button variant="secondary" onPress={() => void Linking.openSettings()}>Open notification settings</Button>
        </>
      ) : (
        <Button disabled={busy || !session} loading={busy} onPress={() => void enable()}>
          Enable text reminders
        </Button>
      )}

      {error ? <Notice tone="error">{error}</Notice> : null}
    </Card>
  );
}
