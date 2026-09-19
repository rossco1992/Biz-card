import type { Mailbox } from "@biz-card/types";
import { ProviderFailure } from "./mailbox-providers";
export type DeliveryJob = { id: string; profile_id: string; mailbox_id: string | null; delivery_provider: string; recipient_email: string; subject_snapshot: string; body_snapshot: string };
export type DeliveryResult = { status: "sent" | "failed" | "cancelled"; error: string | null; provider_message_id?: string | null; sent_at?: string };
export type DeliveryDependencies = {
  load: (profileId: string) => Promise<{ enabled: boolean; mailbox: Mailbox | null }>;
  refresh: (mailbox: Mailbox) => Promise<string>;
  stillConnected: (job: DeliveryJob, mailbox: Mailbox) => Promise<boolean>;
  send: (mailbox: Mailbox, token: string, job: DeliveryJob) => Promise<string | null>;
  reconnect: (mailbox: Mailbox) => Promise<void>;
};
export async function deliverMailboxJob(job: DeliveryJob, deps: DeliveryDependencies): Promise<DeliveryResult> {
  let mailbox: Mailbox | null = null;
  let sending = false;
  try {
    const loaded = await deps.load(job.profile_id);
    mailbox = loaded.mailbox;
    if (!loaded.enabled || !mailbox || mailbox.id !== job.mailbox_id || mailbox.provider !== job.delivery_provider) {
      return { status: "cancelled", error: "Follow-up paused or the connected email changed." };
    }
    if (mailbox.status !== "connected") return { status: "failed", error: "Reconnect your email before scheduling new follow-ups." };
    const accessToken = await deps.refresh(mailbox);
    // Recheck after network refresh: disconnect/replacement/pause may happen meanwhile.
    if (!await deps.stillConnected(job, mailbox)) return { status: "cancelled", error: "Follow-up paused or email disconnected." };
    sending = true;
    const messageId = await deps.send(mailbox, accessToken, job);
    return { status: "sent", error: null, provider_message_id: messageId, sent_at: new Date().toISOString() };
  } catch (error) {
    if (mailbox && error instanceof ProviderFailure && error.reconnect) {
      await deps.reconnect(mailbox);
      return { status: "failed", error: "Your email provider requires renewed permission. Reconnect your email." };
    }
    return { status: "failed", error: sending
      ? "Delivery could not be confirmed. Check your Sent folder before sending again."
      : "Could not prepare this email. Check your email connection before scheduling new follow-ups." };
  }
}
