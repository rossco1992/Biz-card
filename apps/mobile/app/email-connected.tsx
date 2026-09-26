import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_WEB_URL } from "@biz-card/core";
import { supabase } from "@/lib/supabase";
import { Button, Notice, Screen } from "@/components/ui";
// Cold-start fallback when no browser auth session is waiting to receive this deep link.
export default function EmailConnected() {
  const { receipt } = useLocalSearchParams<{ receipt?: string }>();
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    async function finish() {
      if (!receipt) throw new Error("Email connection was cancelled or expired.");
      const session = await supabase?.auth.getSession();
      if (!session?.data.session) throw new Error("Sign in to the Knct’d account that started this connection, then connect again.");
      const base = (process.env.EXPO_PUBLIC_WEB_URL || DEFAULT_WEB_URL).replace(/\/$/, "");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(`${base}/api/mailbox/confirm`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.data.session.access_token}` }, body: JSON.stringify({ receipt }), signal: controller.signal });
        if (!response.ok) throw new Error("Could not finish connecting email. Return to Automations and check your connection.");
        router.replace("/(tabs)/automations");
      } finally { clearTimeout(timer); }
    }
    void finish().catch(cause => setError(cause instanceof Error ? cause.message : "Could not finish connecting email."));
  }, [receipt]);
  return <Screen><Notice tone={error ? "error" : undefined}>{error || "Finishing your email connection…"}</Notice><Button onPress={() => router.replace("/(tabs)/automations")}>Back to Automations</Button></Screen>;
}
