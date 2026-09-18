import { router } from "expo-router";
import { useRef, useState } from "react";
import { DEFAULT_WEB_URL } from "@biz-card/core";
import { supabase } from "@/lib/supabase";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Button, Card, Notice, PageHeader, Screen, uiStyles } from "@/components/ui";
import { colors, radii } from "@/constants/theme";
import { useSession } from "@/providers/session-provider";

export default function AutomationsScreen() {
  const { profile, modes, session, toggleFollowups } = useSession();
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const testInFlight = useRef(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const activeMode = modes.find((mode) => mode.id === profile.active_mode_id);

  async function sendTest() {
    if (!supabase || !activeMode || testInFlight.current) return;
    testInFlight.current = true;
    setTesting(true); setError(""); setTestMessage("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || !data.session) throw new Error("Sign in again to send a test.");
      const base = (process.env.EXPO_PUBLIC_WEB_URL || DEFAULT_WEB_URL).replace(/\/$/, "");
      const response = await fetch(`${base}/api/test-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ mode_id: activeMode.id }),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Test email is unavailable. Deploy the latest web version first.");
      setTestMessage(`Resend accepted the test for ${result.recipient}. Check your inbox and spam folder. Existing schedules are unchanged.`);
    } catch (cause) {
      setError(cause instanceof Error && cause.name === "AbortError"
        ? "The request timed out; it may still have sent. Check your inbox before retrying."
        : cause instanceof Error ? cause.message : "Could not send the test email.");
    } finally {
      clearTimeout(timeout); testInFlight.current = false; setTesting(false);
    }
  }

  async function toggle() {
    setBusy(true);
    setError("");
    try { await toggleFollowups(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update automations."); } finally { setBusy(false); }
  }

  return (
    <Screen>
      <PageHeader eyebrow="Follow-up engine" title="Automations" />
      <Text style={uiStyles.body}>Choose what gets sent after someone connects. Your active mode follows your QR everywhere.</Text>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Card>
        <View style={uiStyles.between}>
          <View style={styles.toggleCopy}><Text style={uiStyles.sectionTitle}>Automatic follow-up</Text><Text style={uiStyles.small}>{profile.followup_enabled ? "New connections are being scheduled." : "Connections save, but no email is scheduled."}</Text></View>
          <Switch value={profile.followup_enabled} disabled={busy} onValueChange={() => void toggle()} trackColor={{ false: "#CCD0CD", true: "#78AE9B" }} thumbColor={profile.followup_enabled ? colors.accent : "#F8F8F6"} />
        </View>
      </Card>
      <View style={uiStyles.between}><Text style={uiStyles.sectionTitle}>Your modes</Text><Text style={styles.count}>{modes.length}</Text></View>
      <Card>
        <Text style={uiStyles.sectionTitle}>Temporary email test</Text>
        <Text style={uiStyles.small}>Send the saved {activeMode?.name ?? "active mode"} message immediately to {session?.user.email ?? "your signed-in email"}. No connections or schedules are changed.</Text>
        <Button variant="secondary" onPress={() => void sendTest()} loading={testing} disabled={!activeMode || !session?.user.email}>Send test email</Button>
        {testMessage ? <Notice tone="success">{testMessage}</Notice> : null}
      </Card>
      <View style={styles.modeList}>
        {modes.map((mode) => {
          const active = profile.active_mode_id === mode.id;
          return (
            <Pressable key={mode.id} onPress={() => router.push({ pathname: "/mode-editor", params: { modeId: mode.id } })} style={styles.modeCard}>
              <View style={styles.icon}><Text style={styles.iconText}>{mode.kind === "everyday" ? "☀︎" : "✦"}</Text></View>
              <View style={styles.modeCopy}>
                <View style={styles.modeTitleRow}><Text style={styles.modeName}>{mode.name}</Text>{active ? <View style={styles.active}><Text style={styles.activeText}>Active</Text></View> : null}</View>
                <Text style={uiStyles.small}>Wait {mode.delay_hours}h · {mode.subject_template}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
      </View>
      <Button variant="secondary" onPress={() => router.push({ pathname: "/mode-editor", params: { modeId: "new" } })}>+ New mode</Button>
      <Notice>Use {"{{first_name}}"} in a subject or message to personalize it automatically.</Notice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleCopy: { flex: 1, gap: 4, paddingRight: 12 },
  count: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  modeList: { gap: 10 },
  modeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.medium, padding: 15 },
  icon: { width: 43, height: 43, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  iconText: { color: colors.accent, fontSize: 18 },
  modeCopy: { flex: 1, gap: 5 },
  modeTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  modeName: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  active: { backgroundColor: colors.accentSoft, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  activeText: { color: colors.accent, fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7 },
  chevron: { color: colors.muted, fontSize: 26 },
});
