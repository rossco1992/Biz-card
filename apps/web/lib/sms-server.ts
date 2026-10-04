import { smsAvailable, SMS_UNAVAILABLE_MESSAGE } from "./sms-availability";
import { getSupabaseAdmin } from "./supabase-admin";
import { NextResponse } from "next/server";

export class SmsHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function smsOwner(request: Request) {
  if (!smsAvailable()) throw new SmsHttpError(SMS_UNAVAILABLE_MESSAGE, 503);
  const db = getSupabaseAdmin();
  if (!db) throw new SmsHttpError("Text follow-ups are not available yet.", 503);

  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw new SmsHttpError("Please sign in again.", 401);

  const { data, error } = await db.auth.getUser(header.slice(7));
  if (error || !data.user) throw new SmsHttpError("Please sign in again.", 401);

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id,sms_followup_enabled")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (profileError) throw new SmsHttpError("Could not load your card.", 503);
  if (!profile) throw new SmsHttpError("Create your card before setting up texting.", 409);

  return { db, profileId: profile.id, smsEnabled: profile.sms_followup_enabled === true };
}

export function smsError(error: unknown) {
  return NextResponse.json(
    { error: error instanceof SmsHttpError ? error.message : "Could not update text follow-ups. Please try again." },
    {
      status: error instanceof SmsHttpError ? error.status : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
