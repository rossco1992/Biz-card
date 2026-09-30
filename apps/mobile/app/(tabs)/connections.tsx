import { connectionName, getConnectionFollowupByChannel } from "@biz-card/core";
import type { Connection } from "@biz-card/types";
import { useMemo, useState } from "react";
import { FlatList, Platform, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { EmptyState, KeyboardFrame, Notice, PageHeader } from "@/components/ui";
import { colors, radii } from "@/constants/theme";
import { useSession } from "@/providers/session-provider";

function when(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function statusFor(followup: ReturnType<typeof getConnectionFollowupByChannel>) {
  if (!followup) return null;
  if (followup.status === "sent") return { label: "Sent", tone: "success" };
  if (followup.status === "sending") return { label: "Sending", tone: "scheduled" };
  if (followup.status === "failed") return { label: "Needs attention", tone: "danger" };
  if (followup.status === "cancelled") return { label: "Cancelled", tone: "neutral" };
  return { label: `Sends ${when(followup.send_at)}`, tone: "scheduled" };
}

export default function ConnectionsScreen() {
  const { connections, refreshing, refresh, error } = useSession();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return connections;
    return connections.filter((item) => `${item.first_name} ${item.last_name ?? ""} ${item.email} ${item.mode_name_snapshot ?? ""} ${item.event_name_snapshot ?? ""} ${item.event_location_snapshot ?? ""}`.toLowerCase().includes(needle));
  }, [connections, query]);

  return (
    <KeyboardFrame>
      <FlatList
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={false}
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View style={styles.header}><PageHeader eyebrow={`${connections.length} total`} title="Connections" />{error ? <Notice tone="error">{error}</Notice> : null}<TextInput style={styles.search} placeholder="Search people, email, mode, or event" placeholderTextColor="#929A96" value={query} onChangeText={setQuery} autoCapitalize="none" /></View>}
        ListEmptyComponent={<EmptyState icon="↗" title={query ? "No matches" : "Your next hello starts here"} copy={query ? "Try a different name, email, or mode." : "New contacts appear here as soon as they scan your card and connect."} />}
        renderItem={({ item }) => {
          const emailFollowup = getConnectionFollowupByChannel(item, "email");
          const smsFollowup = getConnectionFollowupByChannel(item, "sms");
          const emailStatus = statusFor(emailFollowup);
          const smsStatus = statusFor(smsFollowup);
          return (
            <View style={styles.connection}>
              <View style={styles.initial}><Text style={styles.initialText}>{item.first_name[0]}{item.last_name?.[0] ?? ""}</Text></View>
              <View style={styles.person}>
                <Text style={styles.name}>{connectionName(item.first_name, item.last_name)}</Text>
                <Text numberOfLines={1} style={styles.email}>{item.email}</Text>
                <Text style={styles.meta}>{item.event_name_snapshot ? `${item.event_name_snapshot} · ${item.event_location_snapshot || "Event"} · ${when(item.created_at)}` : `${item.mode_name_snapshot || "No mode"} · ${when(item.created_at)}`}</Text>
                {emailFollowup?.status === "failed" ? <Text style={styles.meta}>Email: {emailFollowup.error || "Check your email connection."}</Text> : null}
                {smsFollowup?.status === "failed" ? <Text style={styles.meta}>Text: {smsFollowup.error || "Check your texting setup."}</Text> : null}
              </View>
              <View style={styles.statusStack}>
                {emailStatus ? <View style={[styles.status, emailStatus.tone === "success" && styles.success, emailStatus.tone === "danger" && styles.danger, emailStatus.tone === "scheduled" && styles.scheduled]}><Text style={styles.channelLabel}>Email</Text><Text style={styles.statusText}>{emailStatus.label}</Text></View> : null}
                {smsStatus ? <View style={[styles.status, smsStatus.tone === "success" && styles.success, smsStatus.tone === "danger" && styles.danger, smsStatus.tone === "scheduled" && styles.scheduled]}><Text style={styles.channelLabel}>Text</Text><Text style={styles.statusText}>{smsStatus.label}</Text></View> : null}
                {!emailStatus && !smsStatus ? <View style={styles.status}><Text style={styles.statusText}>No follow-up</Text></View> : null}
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </KeyboardFrame>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: 20, paddingTop: 24, paddingBottom: 120 },
  header: { gap: 18, marginBottom: 20 },
  search: { height: 52, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.medium, paddingHorizontal: 16, color: colors.ink, fontSize: 15 },
  connection: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  initial: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  initialText: { color: colors.ink, fontWeight: "800", fontSize: 13 },
  person: { flex: 1, minWidth: 0 },
  name: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  email: { color: colors.muted, fontSize: 12, marginTop: 2 },
  meta: { color: "#8B938F", fontSize: 11, marginTop: 4 },
  statusStack: { gap: 5, alignItems: "flex-end" },
  status: { maxWidth: 110, borderRadius: 12, backgroundColor: colors.accentSoft, paddingVertical: 6, paddingHorizontal: 9 },
  success: { backgroundColor: colors.accentSoft },
  danger: { backgroundColor: colors.dangerSoft },
  scheduled: { backgroundColor: colors.warningSoft },
  channelLabel: { color: colors.muted, fontSize: 8, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" },
  statusText: { color: colors.ink, fontSize: 10, fontWeight: "700", textAlign: "center" },
  separator: { height: 1, backgroundColor: colors.line, marginLeft: 58 },
});
