import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, Field, Notice, Screen, uiStyles } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useSession } from "@/providers/session-provider";

export default function ModeEditor() {
  const { modeId } = useLocalSearchParams<{ modeId: string }>();
  const { modes, saveMode } = useSession();
  const mode = useMemo(() => modes.find((item) => item.id === modeId), [modeId, modes]);
  const creating = modeId === "new";
  const [name, setName] = useState(mode?.name ?? "New mode");
  const [delay, setDelay] = useState(String(mode?.delay_hours ?? 24));
  const [subject, setSubject] = useState(mode?.subject_template ?? "Great meeting you");
  const [body, setBody] = useState(mode?.body_template ?? "Hey {{first_name}} — it was great meeting you. I wanted to follow up while our conversation was still fresh.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      await saveMode(creating ? null : mode?.id ?? null, { name: name.trim(), delay_hours: Number(delay), subject_template: subject.trim(), body_template: body.trim() });
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this mode.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.close}>Cancel</Text></Pressable>
        <Text style={styles.headerTitle}>{creating ? "New mode" : "Edit mode"}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <Text style={styles.title}>{creating ? "Create a new context." : mode?.name ?? "Mode"}</Text>
      <Text style={uiStyles.body}>Tailor the timing and message for a conference, client meeting, or everyday introduction.</Text>
      <Card>
        <Field label="Mode name" value={name} onChangeText={setName} />
        <Field label="Send after (hours)" value={delay} onChangeText={setDelay} keyboardType="number-pad" />
        <Field label="Email subject" value={subject} onChangeText={setSubject} />
        <Field label="Message" value={body} onChangeText={setBody} multiline />
        <Text style={uiStyles.small}>Available personalization: {"{{first_name}}"}, {"{{last_name}}"}, {"{{full_name}}"}</Text>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button onPress={() => void save()} loading={busy} disabled={!name.trim() || !subject.trim() || !body.trim() || !Number.isFinite(Number(delay))}>Save mode</Button>
      </Card>
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
