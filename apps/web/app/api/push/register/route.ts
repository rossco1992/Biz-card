import { ownerApiError, requireOwner } from "@/lib/owner-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validDeviceToken(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 16
    && value.length <= 512
    && /^[0-9a-f]+$/i.test(value);
}

export async function POST(request: Request) {
  try {
    const { db, profileId } = await requireOwner(request);
    const body = await request.json().catch(() => null);
    const token = typeof body?.device_token === "string" ? body.device_token.toLowerCase() : body?.device_token;
    const environment = body?.environment;

    if (!validDeviceToken(token) || !["development", "production"].includes(environment)) {
      return Response.json({ error: "Invalid Apple push device." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await db.from("push_devices").upsert({
      profile_id: profileId,
      device_token: token,
      provider: "apns",
      platform: "ios",
      environment,
      active: true,
      last_seen_at: now,
      updated_at: now,
    }, { onConflict: "device_token" });

    if (error) throw error;

    // If a due reminder was claimed before notifications were enabled, let the
    // scheduler try it once more now that this member has an active APNs device.
    await db.from("followups")
      .update({ reminded_at: null, error: null, updated_at: now })
      .eq("profile_id", profileId)
      .eq("channel", "sms")
      .eq("delivery_provider", "device")
      .eq("status", "scheduled")
      .lte("send_at", now)
      .not("error", "is", null);

    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return ownerApiError(error, "Could not register notifications.");
  }
}
