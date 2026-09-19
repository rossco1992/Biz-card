import { NextResponse } from "next/server";
import { digest, opaqueToken, seal } from "@/lib/mailbox-crypto";
import { isMailProvider, mailboxOrigin, providerConfig } from "@/lib/mailbox-providers";
import { mailboxError, MailboxHttpError, mailboxOwner } from "@/lib/mailbox-server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { db, profileId } = await mailboxOwner(request);
    const body = await request.json().catch(() => null);
    if (!isMailProvider(body?.provider) || !["web", "mobile"].includes(body?.platform)) throw new MailboxHttpError("Choose Gmail or Outlook.", 400);
    try { providerConfig(body.provider); } catch { throw new MailboxHttpError("This email provider is not available yet.", 503); }
    const current = await db.from("mailboxes").select("id").eq("profile_id", profileId).maybeSingle();
    if (current.error) throw current.error;
    if (current.data) throw new MailboxHttpError("Disconnect your current email before connecting another account.", 409);
    const state = opaqueToken();
    const launch = opaqueToken();
    const verifier = opaqueToken();
    // Replace abandoned attempts for this owner to bound storage and avoid stale callbacks.
    const { error: deleteError } = await db.from("mailbox_oauth_states").delete().eq("profile_id", profileId);
    if (deleteError) throw deleteError;
    const { error } = await db.from("mailbox_oauth_states").insert({ confirmed_mailbox_id: null, confirmation_hash: null, pending_email: null, pending_token_encrypted: null, state_hash: digest(state), launch_hash: digest(launch), browser_hash: null,
      profile_id: profileId, provider: body.provider, platform: body.platform, verifier_encrypted: seal(verifier, digest(state)),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    if (error) throw error;
    const url = new URL("/api/mailbox/launch", mailboxOrigin());
    url.searchParams.set("ticket", launch);
    url.searchParams.set("state", state);
    return NextResponse.json({ url: url.toString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return mailboxError(error); }
}
