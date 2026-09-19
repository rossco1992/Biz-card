import { NextResponse } from "next/server";
import { mailboxError, mailboxOwner } from "@/lib/mailbox-server";
import { providerConfig } from "@/lib/mailbox-providers";
import { seal } from "@/lib/mailbox-crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db, profileId } = await mailboxOwner(request);
    const { data, error } = await db.from("mailboxes").select("id,provider,email,status").eq("profile_id", profileId).maybeSingle();
    if (error) throw error;
    const available = (provider: "google" | "microsoft") => { try { providerConfig(provider); seal("check", "check"); return true; } catch { return false; } };
    return NextResponse.json({ mailbox: data, providers: { google: available("google"), microsoft: available("microsoft") } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return mailboxError(error); }
}
export async function DELETE(request: Request) {
  try {
    const { db, profileId } = await mailboxOwner(request);
    const { error } = await db.rpc("disconnect_mailbox", { p_profile_id: profileId });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) { return mailboxError(error); }
}
