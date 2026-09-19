import { NextResponse } from "next/server";
import { validEmail } from "@/lib/mailbox-providers";
import { mergeTemplate } from "@biz-card/core";
import { getPublicProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function clean(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const slug = clean(body.slug, 80).toLowerCase();
  const firstName = clean(body.first_name, 80);
  const lastName = clean(body.last_name, 80);
  const email = clean(body.email, 180).toLowerCase();
  const phone = clean(body.phone, 40);
  const consent = body.consent === true;

  if (!slug || !firstName || !email || !consent) {
    return NextResponse.json({ error: "First name, email, and consent are required." }, { status: 400 });
  }

  if (!validEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const profile = await getPublicProfile(slug);
  if (!profile) return NextResponse.json({ error: "Card not found." }, { status: 404 });

  const supabase = getSupabaseAdmin();

  // Demo mode lets the public UX be previewed before the backend is connected.
  if (!supabase || String(profile.id).startsWith("demo-")) {
    const delayHours = profile.active_mode?.delay_hours ?? 24;
    return NextResponse.json({
      ok: true,
      demo: true,
      scheduled_at: new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString(),
    }, { status: 201 });
  }

  const mode = profile.active_mode;
  const { data: connection, error: connectionError } = await supabase
    .from("connections")
    .insert({
      profile_id: profile.id,
      mode_id: mode?.id ?? null,
      first_name: firstName,
      last_name: lastName || null,
      email,
      phone: phone || null,
      consent_at: new Date().toISOString(),
      mode_name_snapshot: mode?.name ?? null,
    })
    .select("id,created_at")
    .single();

  if (connectionError || !connection) {
    console.error("connection insert failed", connectionError);
    return NextResponse.json({ error: "Could not save this connection." }, { status: 500 });
  }

  let scheduledAt: string | null = null;
  let followupStatus: "paused" | "scheduled" | "failed" = "paused";

  if (profile.followup_enabled && mode) {
    const { data: mailbox, error: mailboxError } = await supabase.from("mailboxes").select("id,provider,status").eq("profile_id", profile.id).maybeSingle();
    if (mailboxError) return NextResponse.json({ error: "Connection saved, but email scheduling is unavailable." }, { status: 503 });
    const ready = mailbox?.status === "connected";
    const delayHours = Math.min(336, Math.max(1, mode.delay_hours ?? 24));
    scheduledAt = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();
    const values = {
      first_name: firstName,
      last_name: lastName,
      full_name: [firstName, lastName].filter(Boolean).join(" "),
    };
    const subject = mergeTemplate(mode.subject_template, values);
    const text = mergeTemplate(mode.body_template, values);

    const { data: followup, error: followupError } = await supabase
      .from("followups")
      .insert({
        connection_id: connection.id,
        profile_id: profile.id,
        mode_id: mode.id,
        send_at: scheduledAt,
        status: ready ? "scheduled" : "failed",
        delivery_provider: mailbox?.provider ?? "unconnected",
        mailbox_id: mailbox?.id ?? null,
        error: ready ? null : "Connect your Gmail or Outlook account to send follow-ups.",
        subject_snapshot: subject,
        body_snapshot: text,
        recipient_email: email,
      })
      .select("id")
      .single();

    if (followupError || !followup) {
      console.error("followup insert failed", followupError);
      return NextResponse.json({ error: "Connection saved, but follow-up scheduling failed." }, { status: 500 });
    }

    followupStatus = ready ? "scheduled" : "failed";
    if (!ready) scheduledAt = null;
  }

  return NextResponse.json({
    ok: true,
    scheduled_at: scheduledAt,
    followup_status: followupStatus,
  }, { status: 201 });
}
