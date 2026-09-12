import { NextResponse } from "next/server";
import { Resend } from "resend";
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

  if (!/^\S+@\S+\.\S+$/.test(email)) {
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
    // Resend's scheduled email API currently supports up to 72 hours ahead.
    const delayHours = Math.min(72, Math.max(1, mode.delay_hours ?? 24));
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
        status: "scheduled",
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

    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FOLLOWUP_FROM_EMAIL;

    if (!resendKey || !fromEmail) {
      await supabase.from("followups").update({
        status: "failed",
        error: "Resend is not configured",
        updated_at: new Date().toISOString(),
      }).eq("id", followup.id);
      followupStatus = "failed";
    } else {
      const resend = new Resend(resendKey);
      const result = await resend.emails.send({
        from: `${profile.full_name} via Biz Card <${fromEmail}>`,
        to: email,
        replyTo: profile.email,
        subject,
        text,
        scheduledAt,
      });

      if (result.error || !result.data?.id) {
        console.error("resend schedule failed", result.error);
        await supabase.from("followups").update({
          status: "failed",
          error: result.error?.message?.slice(0, 1000) || "Unknown Resend scheduling error",
          updated_at: new Date().toISOString(),
        }).eq("id", followup.id);
        followupStatus = "failed";
      } else {
        await supabase.from("followups").update({
          provider_message_id: result.data.id,
          error: null,
          updated_at: new Date().toISOString(),
        }).eq("id", followup.id);
        followupStatus = "scheduled";
      }
    }
  }

  return NextResponse.json({
    ok: true,
    scheduled_at: scheduledAt,
    followup_status: followupStatus,
  }, { status: 201 });
}
