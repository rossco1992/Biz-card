import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sameSecret } from "@/lib/mailbox-crypto";
import type { SmsSenderStatus } from "@biz-card/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const token = process.env.KNCT_ADMIN_TOKEN;
  return Boolean(token && sameSecret(request.headers.get("authorization") || "", `Bearer ${token}`));
}

function clean(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Admin access is unavailable." }, { status: 503 });

  const { data: senders, error: senderError } = await db
    .from("sms_senders")
    .select("profile_id,status,phone_number,status_detail,requested_at,approved_at,updated_at,twilio_subaccount_sid,messaging_service_sid,phone_number_sid,brand_sid,campaign_sid")
    .order("requested_at", { ascending: true });

  if (senderError) return NextResponse.json({ error: "Could not load texting setup requests." }, { status: 503 });

  const profileIds = (senders || []).map((sender) => sender.profile_id);
  const { data: profiles, error: profileError } = profileIds.length
    ? await db.from("profiles").select("id,slug,full_name,email").in("id", profileIds)
    : { data: [], error: null };

  if (profileError) return NextResponse.json({ error: "Could not load KNCT account details." }, { status: 503 });

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return NextResponse.json({
    senders: (senders || []).map((sender) => ({
      ...sender,
      profile: profileById.get(sender.profile_id) || null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Admin access is unavailable." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const slug = clean(body?.slug, 80).toLowerCase();
  const nextStatus = clean(body?.status, 30) as SmsSenderStatus;
  const allowed = new Set<SmsSenderStatus>(["requested", "pending", "approved", "rejected", "suspended"]);
  if (!slug || !allowed.has(nextStatus)) {
    return NextResponse.json({ error: "Provide a KNCT slug and a valid sender status." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id,slug,full_name")
    .eq("slug", slug)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: "Could not find that KNCT account." }, { status: 503 });
  if (!profile) return NextResponse.json({ error: "KNCT account not found." }, { status: 404 });

  const sender = {
    profile_id: profile.id,
    status: nextStatus,
    phone_number: clean(body?.phone_number, 30) || null,
    twilio_subaccount_sid: clean(body?.twilio_subaccount_sid, 50) || null,
    messaging_service_sid: clean(body?.messaging_service_sid, 50) || null,
    phone_number_sid: clean(body?.phone_number_sid, 50) || null,
    brand_sid: clean(body?.brand_sid, 80) || null,
    campaign_sid: clean(body?.campaign_sid, 80) || null,
    status_detail: clean(body?.status_detail, 500) || null,
    approved_at: nextStatus === "approved" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  if (
    nextStatus === "approved"
    && (!sender.phone_number || !sender.twilio_subaccount_sid || !sender.messaging_service_sid)
  ) {
    return NextResponse.json({
      error: "Approved senders require phone_number, twilio_subaccount_sid, and messaging_service_sid.",
    }, { status: 400 });
  }

  const { error } = await db
    .from("sms_senders")
    .upsert(sender, { onConflict: "profile_id" });
  if (error) {
    console.error("SMS sender provisioning save failed", error);
    return NextResponse.json({ error: "Could not save sender provisioning." }, { status: 503 });
  }

  if (nextStatus !== "approved") {
    await db
      .from("profiles")
      .update({ sms_followup_enabled: false, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
  }

  return NextResponse.json({
    ok: true,
    slug: profile.slug,
    name: profile.full_name,
    sender: { ...sender, profile_id: undefined },
  });
}
