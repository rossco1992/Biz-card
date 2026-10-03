import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { readRequestText, RequestBodyError } from "@/lib/http-security";

type ResendWebhookEvent = {
  type?: string;
  data?: {
    email_id?: string;
  };
};

export async function POST(request: Request) {
  const resendKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const supabase = getSupabaseAdmin();

  if (!resendKey || !webhookSecret || !supabase) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 500 });
  }

  let payload: string;
  try {
    payload = await readRequestText(request, 256 * 1024);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: status === 413 ? "Webhook payload is too large." : "Invalid webhook payload." }, { status });
  }
  const resend = new Resend(resendKey);

  let event: ResendWebhookEvent;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret,
    }) as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const providerMessageId = event.data?.email_id;
  if (!providerMessageId) return NextResponse.json({ ok: true });

  if (event.type === "email.sent" || event.type === "email.delivered") {
    await supabase
      .from("followups")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("provider_message_id", providerMessageId).eq("delivery_provider", "resend");
  }

  if (event.type === "email.bounced" || event.type === "email.failed") {
    await supabase
      .from("followups")
      .update({
        status: "failed",
        error: `Resend reported ${event.type}`,
        updated_at: new Date().toISOString(),
      })
      .eq("provider_message_id", providerMessageId).eq("delivery_provider", "resend");
  }

  return NextResponse.json({ ok: true });
}
