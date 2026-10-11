import { composeNativeMessage, nativeMessagesAvailable } from "@/lib/native-messages";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, Notice, PageHeader, Screen, uiStyles } from "@/components/ui";
import { resolveWebUrl } from "@biz-card/core";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/session-provider";

type TextFollowup = {
  id: string;
  name: string;
  phone: string | null;
  message: string;
  send_at: string;
  status: "scheduled" | "sent" | "cancelled" | "failed" | "sending";
  sent_at: string | null;
  reminded_at: string | null;
};

export default function TextFollowupScreen() {
  const { followupId } = useLocalSearchParams<{ followupId: string }>();
  const { refresh } = useSession();
  const [data, setData] = useState<TextFollowup | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const launched = useRef(false);
  const base = resolveWebUrl(process.env.EXPO_PUBLIC_WEB_URL).replace(/\/$/, "");

  async function authHeaders() {
    const session = await supabase?.auth.getSession();
    if (!session?.data.session) throw new Error("Sign in again to send this follow-up.");
    return {
      Authorization: `Bearer ${session.data.session.access_token}`,
      "Content-Type": "application/json",
    };
  }

  async function load() {
    if (!followupId) {
      setError("This follow-up link is incomplete.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${base}/api/text-followups/${encodeURIComponent(followupId)}`, {
        headers: await authHeaders(),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) throw new Error(result?.error || "Could not load this follow-up.");
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this follow-up.");
    } finally {
      setLoading(false);
    }
  }

  async function markSent() {
    if (!followupId) return;
    const response = await fetch(`${base}/api/text-followups/${encodeURIComponent(followupId)}`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "sent" }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || "The text was sent, but KNCT could not update its status.");
    setData((current) => current ? { ...current, status: "sent", sent_at: result.sent_at ?? new Date().toISOString() } : current);
    await refresh();
  }

  async function openComposer() {
    if (!data?.phone || sending || data.status === "sent") return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      if (!nativeMessagesAvailable()) throw new Error("Messages is not available in this iOS build.");
      const result = await composeNativeMessage(data.phone, data.message);
      if (result === "sent") {
        await markSent();
        setNotice(`Follow-up to ${data.name} marked sent.`);
      } else if (result === "cancelled") {
        setNotice("Nothing was sent. Your follow-up is still ready whenever you are.");
      } else {
        setNotice("Messages could not send this follow-up. It remains pending.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open Messages.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => { void load(); }, [followupId]);

  useEffect(() => {
    if (!data || data.status !== "scheduled" || launched.current) return;
    launched.current = true;
    void openComposer();
  }, [data?.id, data?.status]);

  return (
    <Screen>
      <PageHeader eyebrow="Text follow-up" title={data?.name ? `Message ${data.name}` : "Message ready"} />
      {loading ? <Notice>Loading your follow-up…</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <Notice tone={data?.status === "sent" ? "success" : undefined}>{notice}</Notice> : null}

      {data ? (
        <Card>
          <Text style={uiStyles.sectionTitle}>{data.status === "sent" ? "Sent" : "Your message is ready"}</Text>
          {data.phone ? <Text style={uiStyles.small}>{data.phone}</Text> : null}
          <Text style={uiStyles.body}>{data.message}</Text>
          {data.status !== "sent" ? (
            <Button disabled={sending || !data.phone} loading={sending} onPress={() => void openComposer()}>
              Open Messages
            </Button>
          ) : null}
        </Card>
      ) : null}

      <View>
        <Button variant="secondary" onPress={() => router.replace("/(tabs)/connections")}>Back to connections</Button>
      </View>
    </Screen>
  );
}
