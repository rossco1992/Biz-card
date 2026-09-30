import { NextResponse } from "next/server";
import { smsError, smsOwner, SmsHttpError } from "@/lib/sms-server";
import { twilioConfigured } from "@/lib/twilio-sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function status(db: any, profileId: string, smsEnabled: boolean) {
  const [{ data: sender, error: senderError }, { data: hasSms, error: smsAccessError }] = await Promise.all([
    db
      .from("sms_senders")
      .select("status,phone_number,status_detail,requested_at,approved_at")
      .eq("profile_id", profileId)
      .maybeSingle(),
    db.rpc("profile_has_sms", { p_profile_id: profileId }),
  ]);

  if (senderError || smsAccessError) throw new SmsHttpError("Could not load text follow-up status.", 503);

  return {
    sender,
    enabled: smsEnabled,
    plan: hasSms ? "pro_plus" : "pro",
    provider_configured: twilioConfigured(),
  };
}

export async function GET(request: Request) {
  try {
    const { db, profileId, smsEnabled } = await smsOwner(request);
    return NextResponse.json(await status(db, profileId, smsEnabled), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return smsError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { db, profileId, smsEnabled } = await smsOwner(request);
    const body = await request.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action : "";
    const { data: hasSms, error: smsAccessError } = await db.rpc("profile_has_sms", { p_profile_id: profileId });
    if (smsAccessError) throw new SmsHttpError("Could not verify your membership.", 503);

    if (action === "request") {
      if (!hasSms) throw new SmsHttpError("Automatic text follow-ups are a KNCT Pro+ feature.", 403);
      const { data: current, error: currentError } = await db
        .from("sms_senders")
        .select("status")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (currentError) throw currentError;

      if (!current) {
        const { error } = await db.from("sms_senders").insert({
          profile_id: profileId,
          status: "requested",
          status_detail: "Texting setup requested. KNCT will activate your dedicated sender after carrier registration.",
        });
        if (error) throw error;
      }
    } else if (action === "enable") {
      if (!hasSms) throw new SmsHttpError("Automatic text follow-ups are a KNCT Pro+ feature.", 403);
      const { data: sender, error } = await db
        .from("sms_senders")
        .select("status,twilio_subaccount_sid,messaging_service_sid,phone_number")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (error) throw error;
      if (
        sender?.status !== "approved"
        || !sender.twilio_subaccount_sid
        || !sender.messaging_service_sid
        || !sender.phone_number
      ) {
        throw new SmsHttpError("Your texting number is still waiting for carrier approval.", 409);
      }

      const { error: updateError } = await db
        .from("profiles")
        .update({ sms_followup_enabled: true, updated_at: new Date().toISOString() })
        .eq("id", profileId);
      if (updateError) throw updateError;
    } else if (action === "disable") {
      const { error: updateError } = await db
        .from("profiles")
        .update({ sms_followup_enabled: false, updated_at: new Date().toISOString() })
        .eq("id", profileId);
      if (updateError) throw updateError;
    } else {
      throw new SmsHttpError("Unknown texting action.", 400);
    }

    const nextEnabled = action === "enable" ? true : action === "disable" ? false : smsEnabled;
    return NextResponse.json(await status(db, profileId, nextEnabled), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return smsError(error);
  }
}
