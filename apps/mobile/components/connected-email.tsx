import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, AppState, Text } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { DEFAULT_WEB_URL } from "@biz-card/core";
import type { MailboxStatus, MailProvider } from "@biz-card/types";
import { supabase } from "@/lib/supabase";
import { Button, Card, Notice, uiStyles } from "@/components/ui";

export function ConnectedEmail() {
  const [data, setData] = useState<MailboxStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const refreshVersion = useRef(0);
  const inFlight = useRef(false);
  const base = (process.env.EXPO_PUBLIC_WEB_URL || DEFAULT_WEB_URL).replace(/\/$/, "");
  const api = useCallback(async (path = "", method = "GET", body?: object) => {
    const session = await supabase?.auth.getSession();
    if (!session?.data.session) throw new Error("Sign in again to connect your email.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${base}/api/mailbox${path}`, { method, headers: { Authorization: `Bearer ${session.data.session.access_token}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) throw new Error(result?.error || "Email connections are unavailable. Please try again later.");
      return result;
    } finally { clearTimeout(timeout); }
  }, [base]);
  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    setRefreshing(true);
    try {
      const result = await api();
      if (version === refreshVersion.current) { setData(result); setLoadError(""); }
    } catch (cause) {
      if (version === refreshVersion.current) setLoadError("Could not load your email connection. Check your connection and tap Refresh connection.");
      throw cause;
    } finally {
      if (version === refreshVersion.current) setRefreshing(false);
    }
  }, [api]);
  useFocusEffect(useCallback(() => {
    void refresh().catch(() => {});
    const listener = AppState.addEventListener("change", state => {
      if (state === "active") void refresh().catch(() => {});
    });
    return () => listener.remove();
  }, [refresh]));
  async function connect(provider: MailProvider) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const { url } = await api("/connect", "POST", { provider, platform: "mobile" });
      const result = await WebBrowser.openAuthSessionAsync(url, "bizcard://email-connected");
      if (result.type === "success") {
        const status = new URL(result.url).searchParams.get("mailbox");
        if (status === "connected") await api("/confirm", "POST", { receipt: new URL(result.url).searchParams.get("receipt") });
        if (status !== "connected") setError(status === "cancelled" ? "Email connection cancelled." : "Could not connect. Please allow sending access and try again.");
      }
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not connect your email."); }
    finally { setBusy(false); inFlight.current = false; }
  }
  async function disconnect() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { await api("", "DELETE"); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not disconnect email."); }
    finally { setBusy(false); inFlight.current = false; }
  }
  const account = data?.mailbox;
  return <Card>
    <Text style={uiStyles.sectionTitle}>Send from your email</Text>
    <Text style={uiStyles.small}>Connect Gmail or Outlook to send automatic follow-ups from your own address. We request sending access and basic account details, not access to read your inbox.</Text>
    {account ? <>
      <Text style={uiStyles.body}>{account.email}</Text>
      <Text style={uiStyles.small}>{account.provider === "google" ? "Gmail" : "Outlook"} · {account.status === "connected" ? "Connected" : "Reconnect needed"}</Text>
      {account.status === "reconnect" ? <Notice tone="error">Email permission expired or was removed. Disconnect, then connect again. Failed messages are not resent automatically.</Notice> : null}
      <Button variant="secondary" disabled={busy} onPress={() => Alert.alert("Disconnect email?", "Pending follow-ups from this mailbox will be cancelled. A message already being sent may still arrive.", [
        { text: "Keep connected", style: "cancel" }, { text: "Disconnect", style: "destructive", onPress: () => void disconnect() },
      ])}>Disconnect email</Button>
    </> : <>
      <Text style={uiStyles.small}>Connections are saved, but follow-ups will not send until you connect an email account.</Text>
      <Button disabled={busy || !data?.providers.google} onPress={() => void connect("google")}>Connect Gmail</Button>
      <Button variant="secondary" disabled={busy || !data?.providers.microsoft} onPress={() => void connect("microsoft")}>Connect Outlook</Button>
      {!data && refreshing ? <Text accessibilityLiveRegion="polite" style={uiStyles.small}>Checking email connection options…</Text> : null}
      {data && (!data.providers.google || !data.providers.microsoft) ? <Notice>
        {!data.providers.google && !data.providers.microsoft ? "Gmail and Outlook connections are" : !data.providers.google ? "Gmail connection is" : "Outlook connection is"} temporarily unavailable. You don’t need to configure anything yourself. Try refreshing later; you can still save and share contacts.
      </Notice> : null}
    </>}
    {busy ? <Text style={uiStyles.small}>Updating your email connection…</Text> : null}
    {error || loadError ? <Notice tone="error">{error || loadError}</Notice> : null}
    <Button variant="secondary" disabled={busy || refreshing} loading={refreshing} onPress={() => { setError(""); void refresh().catch(() => {}); }}>Refresh connection</Button>
  </Card>;
}
