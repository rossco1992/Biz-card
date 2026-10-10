import { ownerApiError, OwnerApiError, requireOwner } from "@/lib/owner-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadFollowup(request: Request, id: string) {
  const { db, profileId } = await requireOwner(request);
  const { data, error } = await db
    .from("followups")
    .select("id,connection_id,recipient_phone,body_snapshot,send_at,status,sent_at,reminded_at,delivery_provider")
    .eq("id", id)
    .eq("profile_id", profileId)
    .eq("channel", "sms")
    .eq("delivery_provider", "device")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new OwnerApiError("Text follow-up not found.", 404);

  const { data: connection, error: connectionError } = await db
    .from("connections")
    .select("first_name,last_name")
    .eq("id", data.connection_id)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (connectionError) throw connectionError;

  return {
    db,
    profileId,
    followup: data,
    name: [connection?.first_name, connection?.last_name].filter(Boolean).join(" ") || "this connection",
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { followup, name } = await loadFollowup(request, id);
    return Response.json({
      id: followup.id,
      name,
      phone: followup.recipient_phone,
      message: followup.body_snapshot,
      send_at: followup.send_at,
      status: followup.status,
      sent_at: followup.sent_at,
      reminded_at: followup.reminded_at,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return ownerApiError(error, "Could not load this text follow-up.");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { db, profileId, followup } = await loadFollowup(request, id);
    const body = await request.json().catch(() => null);
    if (body?.action !== "sent") throw new OwnerApiError("Unknown action.", 400);

    if (followup.status === "sent") {
      return Response.json({ ok: true, status: "sent", sent_at: followup.sent_at });
    }
    if (followup.status !== "scheduled") throw new OwnerApiError("This follow-up is no longer pending.", 409);

    const now = new Date().toISOString();
    const { data, error } = await db.from("followups")
      .update({ status: "sent", sent_at: now, error: null, updated_at: now })
      .eq("id", followup.id)
      .eq("profile_id", profileId)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new OwnerApiError("This follow-up changed. Refresh and try again.", 409);

    return Response.json({ ok: true, status: "sent", sent_at: now });
  } catch (error) {
    return ownerApiError(error, "Could not update this text follow-up.");
  }
}
