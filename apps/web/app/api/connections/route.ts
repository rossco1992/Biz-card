import { NextResponse } from "next/server";
import { validEmail } from "@/lib/mailbox-providers";
import { appendSmsOptOut, buildEventContext, formatEventDate, firstNameFromFullName, mergeTemplate, normalizeNorthAmericanPhone } from "@biz-card/core";
import { getPublicProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

import { renderSignedEmail } from "@/lib/email-signature";

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
  const event = mode?.kind === "event" ? profile.active_event : null;
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
      event_id: event?.id ?? null,
      event_name_snapshot: event?.name ?? null,
      event_location_snapshot: event?.location ?? null,
    })
    .select("id,created_at")
    .single();

  if (connectionError || !connection) {
    console.error("connection insert failed", connectionError);
    return NextResponse.json({ error: "Could not save this connection." }, { status: 500 });
  }

  let scheduledAt: string | null = null;
  let followupStatus: "paused" | "scheduled" | "failed" | "limit_reached" = "paused";

  if (profile.followup_enabled && mode) {
    const { data: mailbox, error: mailboxError } = await supabase.from("mailboxes").select("id,provider,status").eq("profile_id", profile.id).maybeSingle();
    if (mailboxError) return NextResponse.json({ error: "Connection saved, but email scheduling is unavailable." }, { status: 503 });
    const ready = mailbox?.status === "connected";

    if (ready) {
      const { data: allowance, error: allowanceError } = await supabase.rpc("consume_followup_allowance", { p_profile_id: profile.id });
      if (allowanceError) {
        // Keep existing follow-ups working during the deploy window before
        // migration 0006 is applied. Once installed, the server enforces Free limits.
        console.error("follow-up allowance check unavailable; continuing without quota enforcement", allowanceError);
      } else if (!allowance?.allowed) {
        return NextResponse.json({
          ok: true,
          scheduled_at: null,
          followup_status: "limit_reached",
          followup_limit: allowance?.limit ?? 5,
          followup_used: allowance?.used ?? 5,
        }, { status: 201 });
      }
    }

    const delayHours = Math.min(336, Math.max(1, mode.delay_hours ?? 24));
    scheduledAt = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();
    const values = {
      first_name: firstName,
      last_name: lastName,
      full_name: [firstName, lastName].filter(Boolean).join(" "),
      my_first_name: firstNameFromFullName(profile.full_name),
      event_name: event?.name ?? "the event",
      event_location: event?.location ?? "",
      event_date: formatEventDate(event?.event_date),
      event_context: buildEventContext(event?.name, event?.location),
    };
    const subject = mergeTemplate(mode.subject_template, values);
    const body = mergeTemplate(mode.body_template, values);
    const { text, html } = renderSignedEmail(body, profile.email_signature, profile.email_signature_html, mode.include_signature);

    const { data: followup, error: followupError } = await supabase
      .from("followups")
      .insert({
        connection_id: connection.id,
        profile_id: profile.id,
        channel: "email",
        mode_id: mode.id,
        send_at: scheduledAt,
        status: ready ? "scheduled" : "failed",
        delivery_provider: mailbox?.provider ?? "unconnected",
        mailbox_id: mailbox?.id ?? null,
        error: ready ? null : "Connect your Gmail or Outlook account to send follow-ups.",
        subject_snapshot: subject,
        body_snapshot: text,
        body_html_snapshot: html,
        recipient_email: email,
        recipient_phone: null,
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

  let smsScheduledAt: string | null = null;
  let smsFollowupStatus: "paused" | "scheduled" | "failed" = "paused";

  if (profile.followup_enabled && profile.sms_followup_enabled && mode?.sms_enabled && phone) {
    const recipientPhone = normalizeNorthAmericanPhone(phone);
    if (recipientPhone) {
      const [{ data: hasPro, error: proError }, { data: sender, error: senderError }] = await Promise.all([
        supabase.rpc("profile_has_pro", { p_profile_id: profile.id }),
        supabase
          .from("sms_senders")
          .select("status,twilio_subaccount_sid,messaging_service_sid,phone_number")
          .eq("profile_id", profile.id)
          .maybeSingle(),
      ]);

      if (proError || senderError) {
        return NextResponse.json({ error: "Connection saved, but text scheduling is unavailable." }, { status: 503 });
      }

      const smsReady = Boolean(
        hasPro
        && sender?.status === "approved"
        && sender.twilio_subaccount_sid
        && sender.messaging_service_sid
        && sender.phone_number,
      );

      const delayHours = Math.min(336, Math.max(1, mode.delay_hours ?? 24));
      smsScheduledAt = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();
      const values = {
        first_name: firstName,
        last_name: lastName,
        full_name: [firstName, lastName].filter(Boolean).join(" "),
        my_first_name: firstNameFromFullName(profile.full_name),
        event_name: event?.name ?? "the event",
        event_location: event?.location ?? "",
        event_date: formatEventDate(event?.event_date),
        event_context: buildEventContext(event?.name, event?.location),
      };
      const smsBody = appendSmsOptOut(mergeTemplate(mode.sms_body_template || mode.body_template, values));

      const { error: smsError } = await supabase
        .from("followups")
        .insert({
          connection_id: connection.id,
          profile_id: profile.id,
          channel: "sms",
          mode_id: mode.id,
          send_at: smsScheduledAt,
          status: smsReady ? "scheduled" : "failed",
          delivery_provider: "twilio",
          mailbox_id: null,
          error: smsReady ? null : "Your KNCT texting number is not currently approved for automatic messages.",
          subject_snapshot: "SMS follow-up",
          body_snapshot: smsBody,
          body_html_snapshot: null,
          recipient_email: null,
          recipient_phone: recipientPhone,
        });

      if (smsError) {
        console.error("SMS followup insert failed", smsError);
        return NextResponse.json({ error: "Connection saved, but text scheduling failed." }, { status: 500 });
      }

      smsFollowupStatus = smsReady ? "scheduled" : "failed";
      if (!smsReady) smsScheduledAt = null;
    }
  }

  return NextResponse.json({
    ok: true,
    scheduled_at: scheduledAt,
    followup_status: followupStatus,
    sms_scheduled_at: smsScheduledAt,
    sms_followup_status: smsFollowupStatus,
  }, { status: 201 });
}
