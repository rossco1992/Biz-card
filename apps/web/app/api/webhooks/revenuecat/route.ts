import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sameSecret } from "@/lib/mailbox-crypto";
import { readJsonBody, RequestBodyError } from "@/lib/http-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isoFromMillis(value: unknown) {
  const ms = typeof value === "number" ? value : Number(value);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
}

export async function POST(request: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_AUTH;
  const authorization = request.headers.get("authorization") || "";

  if (!secret || !sameSecret(authorization, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await readJsonBody(request, 256 * 1024);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: status === 413 ? "Webhook payload is too large." : "Invalid RevenueCat event." }, { status });
  }
  const event = payload.event as Record<string, unknown> | undefined;
  const appUserId = typeof event?.app_user_id === "string" ? event.app_user_id : "";
  const eventType = typeof event?.type === "string" ? event.type : "";
  if (!event || !appUserId || !eventType) {
    return NextResponse.json({ error: "Invalid RevenueCat event." }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Billing sync is unavailable." }, { status: 503 });

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id")
    .eq("user_id", appUserId)
    .maybeSingle();

  if (profileError) {
    console.error("RevenueCat profile lookup failed", profileError);
    return NextResponse.json({ error: "Could not sync subscriber." }, { status: 503 });
  }

  // RevenueCat can send events for anonymous/pre-login users. We only sell Pro
  // after KNCT authentication, so an unknown app_user_id is safe to acknowledge.
  if (!profile) return NextResponse.json({ ok: true, ignored: "unknown_subscriber" });

  const expiration = isoFromMillis(event.expiration_at_ms);
  const entitlementIds = Array.isArray(event.entitlement_ids) ? event.entitlement_ids.filter((id: unknown): id is string => typeof id === "string") : [];
  const trial = String(event.period_type || "").toUpperCase() === "TRIAL";
  const type = eventType.toUpperCase();

  let status: "inactive" | "trialing" | "active" | "cancelled" | "billing_issue" | "expired" | "refunded" | null = null;

  if (["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION", "REFUND_REVERSED"].includes(type)) {
    status = trial ? "trialing" : "active";
  } else if (type === "CANCELLATION") {
    status = "cancelled";
  } else if (type === "BILLING_ISSUE") {
    status = "billing_issue";
  } else if (type === "EXPIRATION") {
    status = "expired";
  } else if (type === "REFUND") {
    status = "refunded";
  }

  if (!status) return NextResponse.json({ ok: true, ignored: type });

  const { error } = await db.from("profile_entitlements").upsert({
    profile_id: profile.id,
    revenuecat_status: status,
    revenuecat_expires_at: expiration,
    revenuecat_product_id: event.product_id ?? null,
    revenuecat_provider: event.store ?? null,
    revenuecat_entitlement_ids: entitlementIds,
    updated_at: new Date().toISOString(),
  } as never, { onConflict: "profile_id" });

  if (error) {
    console.error("RevenueCat entitlement update failed", error);
    return NextResponse.json({ error: "Could not sync subscription." }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
