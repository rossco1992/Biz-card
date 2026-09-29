import { Brand } from "@/components/brand";
import { router } from "expo-router";
import { ProfilePhoto } from "@/components/profile-photo";
import { resolveWebUrl, publicCardUrl } from "@biz-card/core";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Button, Card, Notice, PageHeader, Screen, uiStyles } from "@/components/ui";
import { colors, radii } from "@/constants/theme";
import { useSession } from "@/providers/session-provider";

export default function MyCardScreen() {
  const { profile, modes, events, activateMode, activateEvent, refreshing, refresh, error } = useSession();
  const [switching, setSwitching] = useState("");
  const webUrl = resolveWebUrl(process.env.EXPO_PUBLIC_WEB_URL);
  const cardUrl = profile ? publicCardUrl(profile.slug, webUrl) : webUrl;
  const activeMode = useMemo(() => modes.find((mode) => mode.id === profile?.active_mode_id) ?? modes[0], [modes, profile]);
  const activeEvent = useMemo(() => events.find((event) => event.id === profile?.active_event_id) ?? null, [events, profile?.active_event_id]);
  if (!profile) return null;

  async function switchMode(modeId: string) {
    const nextMode = modes.find((mode) => mode.id === modeId);
    if (nextMode?.kind === "event" && !activeEvent) {
      Alert.alert("Add your event first", "Event mode works best when KNCT knows the event name and location.", [
        { text: "Cancel", style: "cancel" },
        { text: "Add event", onPress: () => router.push({ pathname: "/event-editor", params: { eventId: "new" } }) },
      ]);
      return;
    }
    setSwitching(modeId);
    try { await activateMode(modeId); } finally { setSwitching(""); }
  }

  async function switchEvent(eventId: string) {
    setSwitching(`event:${eventId}`);
    try { await activateEvent(eventId); } finally { setSwitching(""); }
  }

  return (
    <Screen>
      <Brand />
      <PageHeader eyebrow="Your smart card" title="Ready to connect." action={<ProfilePhoto name={profile.full_name} url={profile.avatar_url} size={48} />} />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Card style={styles.qrCard}>
        <View style={styles.identity}>
          <Text style={styles.name}>{profile.full_name}</Text>
          <Text style={styles.role}>{[profile.title, profile.company].filter(Boolean).join(" · ")}</Text>
        </View>
        <View style={styles.qrWrap}><QRCode value={cardUrl} size={226} color={colors.ink} backgroundColor="white" /></View>
        <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>{profile.followup_enabled && activeMode ? `${activeMode.name} · ${activeMode.delay_hours}h follow-up` : "Follow-up paused"}</Text></View>
        <Text style={[uiStyles.small, styles.centerText]}>Have them scan this. They share their details, then save yours.</Text>
      </Card>

      <View style={styles.actions}>
        <View style={styles.action}><Button onPress={() => void Share.share({ title: `${profile.full_name}'s card`, message: cardUrl, url: cardUrl })} variant="secondary">Share link</Button></View>
        <View style={styles.action}><Button onPress={() => void WebBrowser.openBrowserAsync(cardUrl)} variant="secondary">Preview card</Button></View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={uiStyles.sectionTitle}>Active mode</Text>
        <Pressable onPress={() => void refresh()} disabled={refreshing}><Text style={styles.refresh}>{refreshing ? "Refreshing…" : "Refresh"}</Text></Pressable>
      </View>
      <View style={styles.modeList}>
        {modes.map((mode) => {
          const active = mode.id === activeMode?.id;
          return (
            <Pressable key={mode.id} onPress={() => void switchMode(mode.id)} style={[styles.mode, active && styles.modeActive]}>
              <View style={[styles.modeIcon, active && styles.modeIconActive]}><Text>{mode.kind === "everyday" ? "☀︎" : "✦"}</Text></View>
              <View style={styles.modeCopy}><Text style={styles.modeName}>{mode.name}</Text><Text style={uiStyles.small}>Send after {mode.delay_hours} hours</Text></View>
              <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioInner} /> : null}</View>
            </Pressable>
          );
        })}
      </View>
      {switching ? <Text style={styles.switching}>Updating…</Text> : null}

      <View style={styles.sectionHeader}>
        <View>
          <Text style={uiStyles.sectionTitle}>Event context</Text>
          <Text style={uiStyles.small}>Name + location are added automatically when Event mode is active.</Text>
        </View>
        <Pressable onPress={() => router.push({ pathname: "/event-editor", params: { eventId: "new" } })}><Text style={styles.refresh}>+ New</Text></Pressable>
      </View>

      {events.length === 0 ? (
        <Card>
          <Text style={styles.eventEmptyTitle}>Make the follow-up instantly recognizable.</Text>
          <Text style={uiStyles.small}>Add the conference, meetup, or client event once. KNCT will remember it for every connection you make there.</Text>
          <Button variant="secondary" onPress={() => router.push({ pathname: "/event-editor", params: { eventId: "new" } })}>Add an event</Button>
        </Card>
      ) : (
        <View style={styles.modeList}>
          {events.map((event) => {
            const active = event.id === activeEvent?.id;
            return (
              <Pressable key={event.id} onPress={() => void switchEvent(event.id)} style={[styles.mode, active && styles.modeActive]}>
                <View style={[styles.modeIcon, active && styles.modeIconActive]}><Text>⌖</Text></View>
                <View style={styles.modeCopy}>
                  <Text style={styles.modeName}>{event.name}</Text>
                  <Text style={uiStyles.small}>{event.location}</Text>
                </View>
                <Pressable hitSlop={10} onPress={(press) => { press.stopPropagation(); router.push({ pathname: "/event-editor", params: { eventId: event.id } }); }}>
                  <Text style={styles.editEvent}>Edit</Text>
                </Pressable>
                <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioInner} /> : null}</View>
              </Pressable>
            );
          })}
        </View>
      )}
      {activeMode?.kind === "event" && activeEvent ? <Notice>Event follow-ups will identify you as {profile.full_name.split(" ")[0]} from {activeEvent.name} in {activeEvent.location}.</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "white", fontWeight: "800" },
  qrCard: { alignItems: "center", paddingTop: 22 },
  identity: { alignItems: "center" },
  name: { color: colors.ink, fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  role: { color: colors.muted, fontSize: 13, marginTop: 4 },
  qrWrap: { backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 24, padding: 17 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.accentSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99 },
  liveDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: colors.accent },
  liveText: { color: colors.accent, fontSize: 12, fontWeight: "800" },
  centerText: { textAlign: "center", maxWidth: 285 },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  refresh: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  modeList: { gap: 9 },
  mode: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,.72)", borderColor: colors.line, borderWidth: 1, borderRadius: radii.medium, padding: 14 },
  modeActive: { backgroundColor: colors.surface, borderColor: colors.accent },
  modeIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  modeIconActive: { backgroundColor: colors.accentSoft },
  modeCopy: { flex: 1 },
  modeName: { color: colors.ink, fontSize: 15, fontWeight: "800", marginBottom: 3 },
  radio: { width: 21, height: 21, borderRadius: 99, borderColor: "#B9BFBB", borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.accent },
  radioInner: { width: 11, height: 11, borderRadius: 99, backgroundColor: colors.accent },
  switching: { color: colors.muted, fontSize: 12, textAlign: "center" },
  eventEmptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  editEvent: { color: colors.accent, fontSize: 12, fontWeight: "800", paddingHorizontal: 3 },
});
