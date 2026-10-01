import { NextResponse } from "next/server";
import { appendSmsOptOut, normalizeNorthAmericanPhone } from "@biz-card/core";
import { smsError, smsOwner, SmsHttpError } from "@/lib/sms-server";
import { sendTwilioSms, twilioConfigured } from "@/lib/twilio-sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { db, profileId } = await smsOwner(request);
    if (!twilioConfigured()) throw new SmsHttpError("Text delivery is not configured yet.", 503);

    const [profile, sender, smsAccess] = await Promise.all([
      db.from("profiles").select("full_name,phone").eq("id", profileId).maybeSingle(),
      db.from("sms_senders").select().eq("profile_id", profileId).maybeSingle(),
      db.rpc("profile_has_sms", { p_profile_id: profileId }),
    ]);

    if (profile.error || sender.error || smsAccess.error) throw new SmsHttpError("Could not load your texting setup.", 503);
    if (smsAccess.data !== true) throw new SmsHttpError("Automatic text follow-ups are a KNCT Pro+ feature.", 403);

    const to = normalizeNorthAmericanPhone(profile.data?.phone);
    if (!to) throw new SmsHttpError("Add a valid mobile number to your KNCT profile before testing.", 409);

    if (
      sender.data?.status !== "approved"
      || !sender.data.phone_number
      || !sender.data.twilio_subaccount_sid
      || !sender.data.messaging_service_sid
    ) {
      throw new SmsHttpError("Your KNCT texting number is still waiting for carrier approval.", 409);
    }

    const body = appendSmsOptOut(
      `KNCT test: automatic text follow-ups are ready for ${profile.data?.full_name || "your account"}.`,
    );
    const message = await sendTwilioSms(sender.data, to, body);

    return NextResponse.json({
      ok: true,
      to,
      message_id: message.id,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return smsError(error);
  }
}
