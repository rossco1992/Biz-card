import type { SmsSender } from "@biz-card/types";

export type SmsDeliveryJob = {
  id: string;
  profile_id: string;
  recipient_phone: string;
  body_snapshot: string;
};

export type SmsDeliveryResult = {
  status: "sent" | "failed" | "cancelled";
  error: string | null;
  provider_message_id?: string | null;
  sent_at?: string;
};

export type SmsDeliveryDependencies = {
  load: (profileId: string) => Promise<{
    followupsEnabled: boolean;
    smsEnabled: boolean;
    hasPro: boolean;
    sender: SmsSender | null;
  }>;
  stillReady: (job: SmsDeliveryJob, sender: SmsSender) => Promise<boolean>;
  send: (sender: SmsSender, job: SmsDeliveryJob) => Promise<{ id: string }>;
};

export async function deliverSmsJob(
  job: SmsDeliveryJob,
  deps: SmsDeliveryDependencies,
): Promise<SmsDeliveryResult> {
  let sending = false;
  try {
    const state = await deps.load(job.profile_id);
    const sender = state.sender;

    if (!state.followupsEnabled || !state.smsEnabled) {
      return { status: "cancelled", error: "Automatic text follow-ups were paused before this message sent." };
    }

    if (!state.hasPro) {
      return { status: "cancelled", error: "Automatic text follow-ups require KNCT Pro." };
    }

    if (
      !sender
      || sender.status !== "approved"
      || !sender.phone_number
      || !sender.twilio_subaccount_sid
      || !sender.messaging_service_sid
    ) {
      return { status: "failed", error: "Your KNCT texting number is not approved for automatic messages." };
    }

    if (!await deps.stillReady(job, sender)) {
      return { status: "cancelled", error: "Text follow-up paused or the texting sender changed." };
    }

    sending = true;
    const message = await deps.send(sender, job);
    return {
      status: "sent",
      error: null,
      provider_message_id: message.id,
      sent_at: new Date().toISOString(),
    };
  } catch {
    return {
      status: "failed",
      error: sending
        ? "Text delivery could not be confirmed. Review Twilio message logs before sending again."
        : "Could not prepare this text. Check the KNCT texting setup before scheduling new messages.",
    };
  }
}
