import { NextResponse } from "next/server";
import { mailboxOwner, MailboxHttpError } from "@/lib/mailbox-server";
import { importSignature } from "@/lib/email-signature";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { db, profileId } = await mailboxOwner(request);
    // Bound the streamed request before parsing; JSON escaping adds overhead.
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Choose an HTML file." }, { status: 400 });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 700000) { await reader.cancel(); return NextResponse.json({ error: "File is too large." }, { status: 413 }); }
      chunks.push(value);
    }
    let input;
    try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { return NextResponse.json({ error: "Invalid signature file." }, { status: 400 }); }
    let signature;
    try { signature = importSignature(input?.html); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid signature." }, { status: 400 }); }
    if (input.save === true) {
      const { error } = await db.from("profiles").update({ email_signature_html: signature.html, email_signature: signature.text, updated_at: new Date().toISOString() }).eq("id", profileId);
      if (error) return NextResponse.json({ error: "Could not save your signature. Please try again." }, { status: 503 });
    }
    return NextResponse.json(signature, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof MailboxHttpError ? error.message : "Signature import is unavailable. Please try again." }, { status: error instanceof MailboxHttpError ? error.status : 503 });
  }
}
