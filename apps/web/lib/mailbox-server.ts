import { getSupabaseAdmin } from "./supabase-admin";
import { NextResponse } from "next/server";

export class MailboxHttpError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export async function mailboxOwner(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) throw new MailboxHttpError("Email connections are not available yet.", 503);
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw new MailboxHttpError("Please sign in again.", 401);
  const { data, error } = await db.auth.getUser(header.slice(7));
  if (error || !data.user) throw new MailboxHttpError("Please sign in again.", 401);
  const { data: profile, error: profileError } = await db.from("profiles").select("id").eq("user_id", data.user.id).maybeSingle();
  if (profileError) throw new MailboxHttpError("Could not load your card.", 503);
  if (!profile) throw new MailboxHttpError("Create your card before connecting email.", 409);
  return { db, profileId: profile.id };
}
export function mailboxError(error: unknown) {
  return NextResponse.json({ error: error instanceof MailboxHttpError ? error.message : "Could not update your email connection. Please try again." },
    { status: error instanceof MailboxHttpError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
}
