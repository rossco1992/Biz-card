import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { digest, opaqueToken, seal, unseal } from "@/lib/mailbox-crypto";
import { exchangeMailboxCode, hasSendScope, isMailProvider, mailboxIdentity, mailboxOrigin } from "@/lib/mailbox-providers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  let platform: "web" | "mobile" = "web";
  let cookieName = "";
  let outcome = "error";
  let receipt = "";
  try {
    const { provider } = await context.params;
    const state = request.nextUrl.searchParams.get("state") || "";
    if (!isMailProvider(provider) || !/^[\w-]{43}$/.test(state)) throw new Error("Invalid callback");
    cookieName = `mailbox_${digest(state)}`;
    const browser = request.cookies.get(cookieName)?.value;
    const db = getSupabaseAdmin();
    if (!db || !browser) throw new Error("No browser binding");
    // Clear the browser binding to claim once. Finalize later consumes the state in a transaction.
    const { data, error } = await db.from("mailbox_oauth_states").update({ browser_hash: null }).eq("state_hash", digest(state))
      .eq("browser_hash", digest(browser)).eq("provider", provider).gt("expires_at", new Date().toISOString()).select().maybeSingle();
    if (error || !data) throw new Error("Expired callback");
    platform = data.platform;
    if (request.nextUrl.searchParams.has("error")) outcome = "cancelled";
    else {
      const code = request.nextUrl.searchParams.get("code");
      if (!code) throw new Error("Missing code");
      const token = await exchangeMailboxCode(provider, code, unseal(data.verifier_encrypted, data.state_hash));
      if (!token.refresh_token || !hasSendScope(provider, token.scope)) throw new Error("Sending permission required");
      const email = await mailboxIdentity(provider, token.access_token);
      receipt = opaqueToken();
      // The callback alone never attaches a mailbox. The original app must present the
      // receipt with its authenticated session, preventing account-linking CSRF via shared URLs.
      const { data: saved, error: saveError } = await db.from("mailbox_oauth_states").update({
        confirmation_hash: digest(receipt), pending_email: email,
        pending_token_encrypted: seal(token.refresh_token, `${data.profile_id}:${provider}`),
      }).eq("state_hash", data.state_hash).gt("expires_at", new Date().toISOString()).select("state_hash").maybeSingle();
      if (saveError || !saved) throw new Error("Expired authorization");
      outcome = "connected";
    }
  } catch { /* Never expose provider errors, tokens or callback query strings. */ }
  const destination = platform === "mobile" ? new URL("bizcard://email-connected") : new URL("/", mailboxOrigin());
  destination.searchParams.set("mailbox", outcome);
  if (outcome === "connected") destination.searchParams.set("receipt", receipt);
  const response = NextResponse.redirect(destination.toString());
  if (cookieName) response.cookies.set(cookieName, "", { path: "/api/mailbox/callback", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
