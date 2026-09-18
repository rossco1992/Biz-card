import { Resend } from "resend";
import { mergeTemplate } from "@biz-card/core";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { handleTestEmail } from "@/lib/test-email";

export async function POST(request: Request) {
  const db = getSupabaseAdmin();
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FOLLOWUP_FROM_EMAIL;
  if (!db || !key || !from) {
    return Response.json({ error: "Test email is unavailable. Configure Supabase, RESEND_API_KEY, and FOLLOWUP_FROM_EMAIL on the web server." }, { status: 503 });
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
        ...message, from: `Biz Card test <${from}>`,
      }, { idempotencyKey });
      return !error && Boolean(data?.id);
    },
  });
}
