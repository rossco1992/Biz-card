import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FOLLOWUP_FROM_EMAIL;

  if (!supabase || !resendKey || !fromEmail) {
    return NextResponse.json({ error: "Missing server configuration." }, { status: 500 });
  }

  const resend = new Resend(resendKey);
  const now = new Date().toISOString();

  const { data: due, error } = await supabase
    .from("followups")
    .select("id,profile_id,recipient_email,subject_snapshot,body_snapshot")
    .eq("status", "scheduled")
    .lte("send_at", now)
    .order("send_at", { ascending: true })
    .limit(25);

  if (error) {
    console.error("followup fetch failed", error);
    return NextResponse.json({ error: "Could not load scheduled follow-ups." }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const followup of due ?? []) {
    const { data: claimed } = await supabase
      .from("followups")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", followup.id)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();

    if (!claimed) continue;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name,email")
      .eq("id", followup.profile_id)
      .maybeSingle();

    if (!profile) {
      failed += 1;
      await supabase.from("followups").update({
        status: "failed",
        error: "Profile not found",
        updated_at: new Date().toISOString(),
      }).eq("id", followup.id);
      continue;
    }

    try {
      const result = await resend.emails.send({
        from: `${profile.full_name} via Biz Card <${fromEmail}>`,
        to: followup.recipient_email,
        replyTo: profile.email,
        subject: followup.subject_snapshot,
        text: followup.body_snapshot,
      });

      if (result.error) throw new Error(result.error.message);

      sent += 1;
      await supabase.from("followups").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: result.data?.id ?? null,
        error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", followup.id);
    } catch (err) {
      failed += 1;
      await supabase.from("followups").update({
        status: "failed",
        error: err instanceof Error ? err.message.slice(0, 1000) : "Unknown send error",
        updated_at: new Date().toISOString(),
      }).eq("id", followup.id);
    }
  }

  return NextResponse.json({ ok: true, processed: (due ?? []).length, sent, failed });
}
