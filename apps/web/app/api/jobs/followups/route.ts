import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sameSecret, seal, unseal } from "@/lib/mailbox-crypto";
import { refreshMailboxToken, sendMailboxMessage } from "@/lib/mailbox-providers";
import { deliverMailboxJob } from "@/lib/mailbox-delivery";
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
    const { data: jobs, error } = await db.rpc("claim_mailbox_followups", { batch_size: 4 });
    if (error) throw error;
    const results = await Promise.all((jobs || []).map(async job => {
      const result = await deliverMailboxJob({ ...job, mailbox_id: job.mailbox_id ?? null }, {
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
          return sendMailboxMessage(mailbox.provider, token, { from: mailbox.email, to: job.recipient_email, subject: job.subject_snapshot, text: job.body_snapshot });
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
    return NextResponse.json({ processed: results.length, sent: results.filter(s => s === "sent").length, failed: results.filter(s => s === "failed").length }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Follow-up processing needs attention. Inspect the queue before retrying individual messages." }, { status: 503 }); }
}
