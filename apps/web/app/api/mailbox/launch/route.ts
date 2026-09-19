import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { digest, opaqueToken, unseal } from "@/lib/mailbox-crypto";
import { authorizationUrl } from "@/lib/mailbox-providers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const ticket = url.searchParams.get("ticket") || "";
    const state = url.searchParams.get("state") || "";
    if (!/^[\w-]{43}$/.test(ticket) || !/^[\w-]{43}$/.test(state)) throw new Error("Invalid link");
    const db = getSupabaseAdmin();
    if (!db) throw new Error("Not configured");
    const browser = opaqueToken();
    // Claim handoff once and bind the callback to the browser that opened it.
    const { data, error } = await db.from("mailbox_oauth_states").update({ launch_hash: null, browser_hash: digest(browser) })
      .eq("launch_hash", digest(ticket)).eq("state_hash", digest(state)).gt("expires_at", new Date().toISOString()).select().maybeSingle();
    if (error || !data) throw new Error("Expired link");
    const response = NextResponse.redirect(authorizationUrl(data.provider, state, unseal(data.verifier_encrypted, data.state_hash)));
    response.cookies.set(`mailbox_${data.state_hash}`, browser, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/api/mailbox/callback", maxAge: 600 });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return new Response("This email connection link expired. Return to Biz Card and try again.", { status: 400, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  }
}
