"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MailboxStatus, MailProvider } from "@biz-card/types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
export function ConnectedEmail() {
  const [data, setData] = useState<MailboxStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const api = useCallback(async (path = "", method = "GET", body?: object) => {
    const { data: session } = await getSupabaseBrowserClient()!.auth.getSession();
    if (!session.session) throw new Error("Please sign in again.");
    const response = await fetch(`/api/mailbox${path}`, { method,
      headers: { Authorization: `Bearer ${session.session.access_token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) throw new Error(result?.error || "Email connections are unavailable. Please try again later.");
    return result;
  }, []);
  const refresh = useCallback(async () => { setData(await api()); }, [api]);
  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("mailbox");
    const receipt = url.searchParams.get("receipt");
    url.searchParams.delete("mailbox"); url.searchParams.delete("receipt");
    window.history.replaceState({}, "", url);
    if (status === "error" || status === "cancelled") setError(status === "cancelled" ? "Email connection cancelled." : "Could not connect. Please allow sending access and try again.");
    const complete = async () => {
      if (receipt) await api("/confirm", "POST", { receipt });
      await refresh();
    };
    void complete().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load your email connection."));
  }, [refresh, api]);
  async function action(provider?: MailProvider) {
    if (inFlight.current) return;
    if (!provider && !window.confirm("Disconnect this email and cancel its pending follow-ups? A message already being sent may still arrive.")) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      if (provider) {
        const result = await api("/connect", "POST", { provider, platform: "web" });
        window.location.assign(result.url);
      } else { await api("", "DELETE"); await refresh(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update email connection."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="card sectionGap stack">
    <h2>Send from your email</h2>
    <p>Connect Gmail or Outlook so automatic follow-ups come from your own address. We request sending access and basic account details, not access to read your inbox.</p>
    {data?.mailbox ? <>
      <strong>{data.mailbox.email}</strong>
      <p>{data.mailbox.provider === "google" ? "Gmail" : "Outlook"} · {data.mailbox.status === "connected" ? "Connected" : "Reconnect needed"}</p>
      {data.mailbox.status === "reconnect" && <p role="alert">Permission expired or was removed. Disconnect, then connect again. Failed messages are not resent automatically.</p>}
      <button className="secondaryButton" disabled={busy} onClick={() => void action()}>Disconnect email</button>
    </> : <>
      <p>Connections are saved, but follow-ups will not send until you connect an email account.</p>
      <button className="primaryButton" disabled={busy || !data?.providers.google} onClick={() => void action("google")}>Connect Gmail</button>
      <button className="secondaryButton" disabled={busy || !data?.providers.microsoft} onClick={() => void action("microsoft")}>Connect Outlook</button>
      {data && (!data.providers.google || !data.providers.microsoft) && <p>An unavailable provider is still being set up.</p>}
    </>}
    {error && <p role="alert">{error}</p>}
    <button className="secondaryButton" disabled={busy} onClick={() => { setError(""); void refresh().catch(() => setError("Could not refresh your email connection.")); }}>Refresh connection</button>
  </section>;
}
