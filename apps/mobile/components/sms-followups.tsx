import { useCallback, useRef, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { Text } from "react-native";
import { resolveWebUrl } from "@biz-card/core";
import { supabase } from "@/lib/supabase";
import { Button, Card, Notice, uiStyles } from "@/components/ui";

type SmsStatus = {
  sender: {
    status: "requested" | "pending" | "approved" | "rejected" | "suspended";
    phone_number: string | null;
    status_detail: string | null;
    requested_at: string;
    approved_at: string | null;
  } | null;
  enabled: boolean;
  plan: "free" | "pro";
  provider_configured: boolean;
};

export function SmsFollowups() {
  const [data, setData] = useState<SmsStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const inFlight = useRef(false);
  const base = resolveWebUrl(process.env.EXPO_PUBLIC_WEB_URL).replace(/\/$/, "");

  const api = useCallback(async (method = "GET", body?: object) => {
    const session = await supabase?.auth.getSession();
    if (!session?.data.session) throw new Error("Sign in again to manage text follow-ups.");

    const response = await fetch(`${base}/api/sms`, {
      method,
      headers: {
        Authorization: `Bearer ${session.data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) {
      throw new Error(result?.error || "Text follow-ups are unavailable. Please try again.");
    }
    return result as SmsStatus;
  }, [base]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await api());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load text follow-ups.");
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  async function sendTest() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setTestMessage("");
    try {
      const session = await supabase?.auth.getSession();
      if (!session?.data.session) throw new Error("Sign in again to test texting.");
      const response = await fetch(`${base}/api/sms/test`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.data.session.access_token}`,
          "Content-Type": "application/json",
        },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) throw new Error(result?.error || "Could not send the test text.");
      setTestMessage(`Test text sent to ${result.to}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the test text.");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  async function act(action: "request" | "enable" | "disable") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      setData(await api("POST", { action }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update text follow-ups.");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const sender = data?.sender;

  return (
    <Card>
      <Text style={uiStyles.sectionTitle}>Automatic text follow-ups</Text>
      <Text style={uiStyles.small}>
        Send the same KNCT follow-up by SMS from a dedicated KNCT number. Recipients never need an account, and you never need a separate texting-service login.
      </Text>

      {data?.plan === "free" ? (
        <>
          <Notice>Text follow-ups are a KNCT Pro feature.</Notice>
          <Button onPress={() => router.push("/pro")}>Upgrade to Pro</Button>
        </>
      ) : null}

      {data?.plan === "pro" && !sender ? (
        <>
          <Text style={uiStyles.small}>
            Texting numbers require carrier registration before automatic messages can send. Start here and KNCT keeps the setup tied to your account.
          </Text>
          <Button disabled={busy} loading={busy} onPress={() => void act("request")}>Set up texting</Button>
        </>
      ) : null}

      {sender && ["requested", "pending"].includes(sender.status) ? (
        <Notice>
          {sender.status === "requested"
            ? "Texting setup requested. Your dedicated sender still needs carrier registration."
            : "Carrier registration is in progress. Text follow-ups will stay off until your number is approved."}
        </Notice>
      ) : null}

      {sender?.status === "approved" ? (
        <>
          <Notice tone="success">
            {data?.enabled ? "Automatic text follow-ups are on." : "Your texting number is approved and ready."}
          </Notice>
          {sender.phone_number ? <Text style={uiStyles.body}>{sender.phone_number}</Text> : null}
          <Button
            variant={data?.enabled ? "secondary" : "primary"}
            disabled={busy}
            loading={busy}
            onPress={() => void act(data?.enabled ? "disable" : "enable")}
          >
            {data?.enabled ? "Pause text follow-ups" : "Enable text follow-ups"}
          </Button>
          <Button variant="secondary" disabled={busy || data?.provider_configured === false} onPress={() => void sendTest()}>
            Send test text to me
          </Button>
        </>
      ) : null}

      {sender?.status === "rejected" ? (
        <Notice tone="error">{sender.status_detail || "Carrier registration needs corrected information before texting can be enabled."}</Notice>
      ) : null}
      {sender?.status === "suspended" ? (
        <Notice tone="error">{sender.status_detail || "Text follow-ups are paused for this account."}</Notice>
      ) : null}

      {data?.provider_configured === false && sender?.status === "approved" ? (
        <Notice>Text delivery is temporarily unavailable. Your number remains assigned to your KNCT account.</Notice>
      ) : null}

      {testMessage ? <Notice tone="success">{testMessage}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button variant="secondary" disabled={busy || refreshing} loading={refreshing} onPress={() => void refresh()}>
        Refresh texting status
      </Button>
    </Card>
  );
}
