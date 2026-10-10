import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Button, Card, Field, Notice, Screen, uiStyles } from "@/components/ui";
import { TemplateField } from "@/components/template-field";
import { friendlyTemplate, storedTemplate } from "@/lib/template-fields";
import { colors } from "@/constants/theme";
import { useSession } from "@/providers/session-provider";

export default function ModeEditor() {
  const { modeId } = useLocalSearchParams<{ modeId: string }>();
  const { profile, modes, saveMode, deleteMode } = useSession();
  const mode = useMemo(() => modes.find((item) => item.id === modeId), [modeId, modes]);
  const creating = modeId === "new";
  const [name, setName] = useState(mode?.name ?? "Event");
  const [delay, setDelay] = useState(String(mode?.delay_hours ?? 48));
  const [subject, setSubject] = useState(friendlyTemplate(mode?.subject_template ?? "{{my_first_name}} from {{event_name}} — great meeting you"));
  const [body, setBody] = useState(friendlyTemplate(mode?.body_template ?? "Hey {{first_name}} — {{my_first_name}} here. It was great meeting you at {{event_context}}. I wanted to follow up while our conversation was still fresh. Would love to stay connected."));
  const [includeSignature, setIncludeSignature] = useState(mode?.include_signature ?? true);
  const [smsEnabled, setSmsEnabled] = useState(mode?.sms_enabled ?? false);
  const [smsBody, setSmsBody] = useState(friendlyTemplate(mode?.sms_body_template ?? "Hey {{first_name}} — {{my_first_name}} here. Great meeting you. Wanted to stay connected."));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submitting = useRef(false);
  const active = profile?.active_mode_id === mode?.id;
  const canDelete = !!mode && !active && modes.length > 1;

  async function remove() {
    if (!mode || !canDelete || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await deleteMode(mode.id);
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this mode.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!mode || busy) return;
    Alert.alert(`Delete “${mode.name}”?`, "This cannot be undone. Existing contacts and already-scheduled emails will be kept.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete mode", style: "destructive", onPress: () => void remove() },
    ]);
  }

  async function save() {
    if (submitting.current || (!creating && !mode)) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await saveMode(creating ? null : mode?.id ?? null, { name: name.trim(), delay_hours: Number(delay), subject_template: storedTemplate(subject.trim()), body_template: storedTemplate(body.trim()), include_signature: includeSignature, sms_enabled: smsEnabled, sms_body_template: smsEnabled ? storedTemplate(smsBody.trim()) : null });
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this mode.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable disabled={busy} onPress={() => router.back()}><Text style={styles.close}>Cancel</Text></Pressable>
        <Text style={styles.headerTitle}>{creating ? "New mode" : "Edit mode"}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <Text style={styles.title}>{creating ? "Create a new context." : mode?.name ?? "Mode"}</Text>
      <Text style={uiStyles.body}>Modes belong only to your account. Tailor the timing and message for a conference, client meeting, or everyday introduction.</Text>
      <Card>
        <Field label="Mode name" value={name} onChangeText={setName} />
        <Field label="Send after (hours)" value={delay} onChangeText={setDelay} keyboardType="number-pad" />
        <Text style={uiStyles.small}>Personalize your email with fields that fill in automatically for each person.</Text>
        <TemplateField label="Email subject" value={subject} onChangeText={setSubject} disabled={busy} />
        <TemplateField label="Message" value={body} onChangeText={setBody} multiline disabled={busy} />
        <View style={styles.signatureRow}>
          <View style={styles.signatureCopy}>
            <Text style={styles.signatureTitle}>Include my signature</Text>
            <Text style={uiStyles.small}>{profile?.email_signature?.trim() ? "Uses the signature saved in Settings." : "Set up your signature once in Settings."}</Text>
          </View>
          <Switch value={includeSignature} onValueChange={setIncludeSignature} trackColor={{ false: "#CCD0CD", true: colors.accent }} thumbColor={includeSignature ? colors.accent : "#F8F8F6"} />
        </View>
        <View style={styles.signatureRow}>
          <View style={styles.signatureCopy}>
            <Text style={styles.signatureTitle}>Remind me to text</Text>
            <Text style={uiStyles.small}>At follow-up time, KNCT notifies you and opens Messages with this text ready to send.</Text>
          </View>
          <Switch value={smsEnabled} onValueChange={setSmsEnabled} trackColor={{ false: "#CCD0CD", true: colors.accent }} thumbColor={smsEnabled ? colors.accent : "#F8F8F6"} />
        </View>
        {smsEnabled ? <>
          <TemplateField label="Text message" value={smsBody} onChangeText={setSmsBody} multiline disabled={busy} />
          <Text style={uiStyles.small}>The text sends from your own Messages account only after you tap Send.</Text>
        </> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button onPress={() => void save()} loading={busy} disabled={busy || (!creating && !mode) || !name.trim() || !subject.trim() || !body.trim() || (smsEnabled && !smsBody.trim()) || !Number.isFinite(Number(delay))}>Save mode</Button>
      </Card>
      {!creating && mode ? <View style={{ gap: 10 }}>
        <Button variant="danger" onPress={confirmDelete} disabled={busy || !canDelete}>Delete mode</Button>
        {active ? <Text style={uiStyles.small}>This is your active mode. Activate another mode in My Card before deleting it.</Text>
          : modes.length <= 1 ? <Text style={uiStyles.small}>Keep at least one mode. Create another before deleting this one.</Text> : null}
      </View> : null}
      {!creating && !mode ? <Notice>This mode is no longer available. Go back to your modes and refresh.</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 38 },
  close: { color: colors.accent, fontSize: 15, fontWeight: "700" },
  headerTitle: { color: colors.ink, fontWeight: "800" },
  headerSpacer: { width: 48 },
  title: { color: colors.ink, fontSize: 34, fontWeight: "800", letterSpacing: -1.4 },
  signatureRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingVertical: 2 },
  signatureCopy: { flex: 1, gap: 3 },
  signatureTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
});
