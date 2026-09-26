import { NextResponse } from "next/server";
import { digest } from "@/lib/mailbox-crypto";
import { mailboxError, mailboxOwner, MailboxHttpError } from "@/lib/mailbox-server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { db, profileId } = await mailboxOwner(request);
    const body = await request.json().catch(() => null);
    if (typeof body?.receipt !== "string" || !/^[\w-]{43}$/.test(body.receipt)) throw new MailboxHttpError("This email connection expired. Please connect again.", 400);
    const { error } = await db.rpc("finish_mailbox_connection", { p_confirmation_hash: digest(body.receipt), p_profile_id: profileId });
    if (error) throw new MailboxHttpError("Could not finish connecting. Use the same Knct’d account that started the connection and try again.", 409);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return mailboxError(error); }
}
