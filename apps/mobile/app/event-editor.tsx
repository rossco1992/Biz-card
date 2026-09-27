import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, Field, Notice, Screen, uiStyles } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useSession } from "@/providers/session-provider";

export default function EventEditor() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { profile, events, saveEvent, deleteEvent } = useSession();
  const event = useMemo(() => events.find((item) => item.id === eventId), [eventId, events]);
  const creating = eventId === "new";
  const active = profile?.active_event_id === event?.id;
  const [name, setName] = useState(event?.name ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function save() {
    if (submitting.current || (!creating && !event)) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await saveEvent(creating ? null : event?.id ?? null, { name, location });
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this event.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function remove() {
    if (!event || active || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await deleteEvent(event.id);
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this event.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!event || busy || active) return;
    Alert.alert(`Delete “${event.name}”?`, "Past connections keep their event name and location snapshots.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete event", style: "destructive", onPress: () => void remove() },
    ]);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable disabled={busy} onPress={() => router.back()}><Text style={styles.close}>Cancel</Text></Pressable>
        <Text style={styles.headerTitle}>{creating ? "New event" : "Edit event"}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.title}>{creating ? "Where are you networking?" : event?.name ?? "Event"}</Text>
      <Text style={uiStyles.body}>KNCT uses this context in follow-ups so the person immediately remembers where they met you.</Text>

      <Card>
        <Field label="Event name" value={name} onChangeText={setName} placeholder="SaaStr Annual 2026" />
        <Field label="Location" value={location} onChangeText={setLocation} placeholder="San Francisco, CA" />
        <Notice>Follow-ups can use {"{{event_name}}"}, {"{{event_location}}"}, and {"{{event_context}}"} automatically.</Notice>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button onPress={() => void save()} loading={busy} disabled={busy || !name.trim() || !location.trim() || (!creating && !event)}>Save event</Button>
      </Card>

      {!creating && event ? (
        <View style={{ gap: 10 }}>
          <Button variant="danger" onPress={confirmDelete} disabled={busy || active}>Delete event</Button>
          {active ? <Text style={uiStyles.small}>This is your active event. Activate another event in My Card before deleting it.</Text> : null}
        </View>
      ) : null}
      {!creating && !event ? <Notice>This event is no longer available. Go back to My Card and refresh.</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 38 },
  close: { color: colors.accent, fontSize: 15, fontWeight: "700" },
  headerTitle: { color: colors.ink, fontWeight: "800" },
  headerSpacer: { width: 48 },
  title: { color: colors.ink, fontSize: 34, fontWeight: "800", letterSpacing: -1.4 },
});
