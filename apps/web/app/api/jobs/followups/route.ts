import { smsAvailable, SMS_UNAVAILABLE_MESSAGE } from "@/lib/sms-availability";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sameSecret, seal, unseal } from "@/lib/mailbox-crypto";
import { refreshMailboxToken, sendMailboxMessage } from "@/lib/mailbox-providers";
import { deliverMailboxJob } from "@/lib/mailbox-delivery";
import { deliverSmsJob } from "@/lib/sms-delivery";
import { sendTwilioSms } from "@/lib/twilio-sms";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Scheduler is not configured." }, { status: 503 });
  if (!sameSecret(request.headers.get("authorization") || "", `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  try {
    const [{ data: jobs, error }, { data: smsJobs, error: smsClaimError }] = await Promise.all([
      db.rpc("claim_mailbox_followups", { batch_size: 4 }),
      db.rpc("claim_sms_followups", { batch_size: 4 }),
    ]);
    if (error || smsClaimError) throw error || smsClaimError;

    const results = await Promise.all((jobs || []).map(async job => {
      if (!job.recipient_email) {
        const result = { status: "failed" as const, error: "Email recipient is missing." };
        const { error: saveError } = await db.from("followups").update({ ...result, updated_at: new Date().toISOString() }).eq("id", job.id).eq("status", "sending");
        if (saveError) throw saveError;
        return result.status;
      }

      const result = await deliverMailboxJob({ ...job, recipient_email: job.recipient_email, mailbox_id: job.mailbox_id ?? null }, {
        async load(profileId) {
          const [profile, mailbox] = await Promise.all([
            db.from("profiles").select("followup_enabled").eq("id", profileId).maybeSingle(),
            db.from("mailboxes").select().eq("profile_id", profileId).maybeSingle(),
          ]);
          if (profile.error || mailbox.error) throw new Error("Database unavailable");
          return { enabled: profile.data?.followup_enabled === true, mailbox: mailbox.data };
        },
        async refresh(mailbox) {
          const context = `${mailbox.profile_id}:${mailbox.provider}`;
          const token = await refreshMailboxToken(mailbox.provider, unseal(mailbox.refresh_token_encrypted, context));
          if (token.refresh_token) {
            const { data, error } = await db.from("mailboxes").update({ refresh_token_encrypted: seal(token.refresh_token, context), updated_at: new Date().toISOString() })
              .eq("profile_id", mailbox.profile_id).eq("id", mailbox.id).select("id").maybeSingle();
            if (error || !data) throw new Error("Mailbox changed");
          }
          return token.access_token;
        },
        async stillConnected(job, mailbox) {
          const [current, profile] = await Promise.all([
            db.from("mailboxes").select("id,status").eq("profile_id", mailbox.profile_id).maybeSingle(),
            db.from("profiles").select("followup_enabled").eq("id", job.profile_id).maybeSingle(),
          ]);
          if (current.error || profile.error) throw new Error("Database unavailable");
          return current.data?.id === mailbox.id && current.data.status === "connected" && profile.data?.followup_enabled === true;
        },
        async send(mailbox, token, job) {
          return sendMailboxMessage(mailbox.provider, token, { from: mailbox.email, to: job.recipient_email, subject: job.subject_snapshot, text: job.body_snapshot, html: job.body_html_snapshot });
        },
        async reconnect(mailbox) {
          const { error } = await db.from("mailboxes").update({ status: "reconnect", updated_at: new Date().toISOString() }).eq("profile_id", mailbox.profile_id).eq("id", mailbox.id);
          if (error) throw error;
        },
      });
      const { error: saveError } = await db.from("followups").update({ ...result, updated_at: new Date().toISOString() }).eq("id", job.id).eq("status", "sending");
      // If this write fails after delivery, leave 'sending' for reconciliation, never retry.
      if (saveError) throw saveError;
      return result.status;
    }));
    const smsResults = await Promise.all((smsJobs || []).map(async job => {
      if (!smsAvailable()) {
        const { error: saveError } = await db.from("followups")
          .update({ status: "cancelled", error: SMS_UNAVAILABLE_MESSAGE, updated_at: new Date().toISOString() })
          .eq("id", job.id).eq("status", "sending");
        if (saveError) throw saveError;
        return "cancelled";
      }
      if (!job.recipient_phone) {
        const result = { status: "failed" as const, error: "Text recipient is missing." };
        const { error: saveError } = await db.from("followups").update({ ...result, updated_at: new Date().toISOString() }).eq("id", job.id).eq("status", "sending");
        if (saveError) throw saveError;
        return result.status;
      }

      const smsJob = {
        id: job.id,
        profile_id: job.profile_id,
        recipient_phone: job.recipient_phone,
        body_snapshot: job.body_snapshot,
      };

      const result = await deliverSmsJob(smsJob, {
        async load(profileId) {
          const [profile, sender, smsAccess] = await Promise.all([
            db.from("profiles").select("followup_enabled,sms_followup_enabled").eq("id", profileId).maybeSingle(),
            db.from("sms_senders").select().eq("profile_id", profileId).maybeSingle(),
            db.rpc("profile_has_sms", { p_profile_id: profileId }),
          ]);
          if (profile.error || sender.error || smsAccess.error) throw new Error("Database unavailable");
          return {
            followupsEnabled: profile.data?.followup_enabled === true,
            smsEnabled: profile.data?.sms_followup_enabled === true,
            hasSmsAccess: smsAccess.data === true,
            sender: sender.data,
          };
        },
        async stillReady(currentJob, sender) {
          const [profile, currentSender, smsAccess] = await Promise.all([
            db.from("profiles").select("followup_enabled,sms_followup_enabled").eq("id", currentJob.profile_id).maybeSingle(),
            db.from("sms_senders").select("id,status,phone_number,twilio_subaccount_sid,messaging_service_sid").eq("profile_id", currentJob.profile_id).maybeSingle(),
            db.rpc("profile_has_sms", { p_profile_id: currentJob.profile_id }),
          ]);
          if (profile.error || currentSender.error || smsAccess.error) throw new Error("Database unavailable");
          return profile.data?.followup_enabled === true
            && profile.data?.sms_followup_enabled === true
            && smsAccess.data === true
            && currentSender.data?.id === sender.id
            && currentSender.data.status === "approved"
            && currentSender.data.phone_number === sender.phone_number
            && currentSender.data.twilio_subaccount_sid === sender.twilio_subaccount_sid
            && currentSender.data.messaging_service_sid === sender.messaging_service_sid;
        },
        async send(sender, currentJob) {
          return sendTwilioSms(sender, currentJob.recipient_phone, currentJob.body_snapshot);
        },
      });

      const { error: saveError } = await db.from("followups").update({ ...result, updated_at: new Date().toISOString() }).eq("id", job.id).eq("status", "sending");
      if (saveError) throw saveError;
      return result.status;
    }));

    const all = [...results, ...smsResults];
    return NextResponse.json({
      processed: all.length,
      sent: all.filter(s => s === "sent").length,
      failed: all.filter(s => s === "failed").length,
      cancelled: all.filter(s => s === "cancelled").length,
      email: {
        processed: results.length,
        sent: results.filter(s => s === "sent").length,
      },
      sms: {
        processed: smsResults.length,
        sent: smsResults.filter(s => s === "sent").length,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Follow-up processing needs attention. Inspect the queue before retrying individual messages." }, { status: 503 }); }
}
