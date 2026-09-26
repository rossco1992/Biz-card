import { Resend } from "resend";
import { mergeTemplate } from "@biz-card/core";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { handleTestEmail } from "@/lib/test-email";
import { testEmailConfigError } from "@/lib/test-email-config";

export async function POST(request: Request) {
  const configError = testEmailConfigError({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    FOLLOWUP_FROM_EMAIL: process.env.FOLLOWUP_FROM_EMAIL,
  });
  if (configError) {
    return Response.json({ error: configError }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  let db: ReturnType<typeof getSupabaseAdmin>;
  try {
    db = getSupabaseAdmin();
  } catch {
    // SDK errors can contain configuration values; never forward them.
    return Response.json({ error: "Supabase settings are present, but the server client could not initialize. Check the Supabase URL and server key values privately in Vercel." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FOLLOWUP_FROM_EMAIL;
  if (!db || !key || !from) {
    return Response.json({ error: "Test email configuration changed during this request. Retry after redeploying the web server." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const resend = new Resend(key);
  return handleTestEmail(request, {
    getUser: async (token) => {
      const { data, error } = await db.auth.getUser(token);
      return error ? null : data.user;
    },
    getProfile: async (userId) => {
      const { data, error } = await db.from("profiles").select("id,full_name,email").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
    getMode: async (profileId, modeId) => {
      const { data, error } = await db.from("modes").select("id,subject_template,body_template").eq("profile_id", profileId).eq("id", modeId).maybeSingle();
      if (error) throw error;
      return data;
    },
    render: mergeTemplate,
    send: async (message, idempotencyKey) => {
      const { data, error } = await resend.emails.send({
        ...message, from: `Knct’d test <${from}>`,
      }, { idempotencyKey });
      return !error && Boolean(data?.id);
    },
  });
}
