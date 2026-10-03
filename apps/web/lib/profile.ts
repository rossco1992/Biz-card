import { demoProfile } from "./demo-profile";
import { getSupabaseAdmin } from "./supabase-admin";

function safeAvatarUrl(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!configured) return null;

  try {
    const expected = new URL(configured);
    const actual = new URL(value);
    const prefix = "/storage/v1/object/public/profile-photos/";
    if (actual.protocol !== "https:" || actual.origin !== expected.origin || !actual.pathname.startsWith(prefix)) {
      return null;
    }
    return actual.toString();
  } catch {
    return null;
  }
}

export async function getPublicProfile(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{1,80}$/.test(normalizedSlug)) return null;

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return normalizedSlug === demoProfile.slug ? { ...demoProfile, avatar_url: null } : null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,slug,avatar_url,full_name,company,title,email,phone,website,followup_enabled,sms_followup_enabled,active_mode_id,active_event_id,email_signature,email_signature_html")
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (error || !profile) return null;

  let activeMode = null;
  if (profile.active_mode_id) {
    const { data } = await supabase
      .from("modes")
      .select("id,name,kind,delay_hours,subject_template,body_template,include_signature,sms_enabled,sms_body_template")
      .eq("id", profile.active_mode_id)
      .eq("profile_id", profile.id)
      .maybeSingle();
    activeMode = data;
  }

  let activeEvent = null;
  if (profile.active_event_id) {
    const { data } = await supabase
      .from("events")
      .select("id,name,location,event_date")
      .eq("id", profile.active_event_id)
      .eq("profile_id", profile.id)
      .maybeSingle();
    activeEvent = data;
  }

  return {
    ...profile,
    avatar_url: safeAvatarUrl(profile.avatar_url),
    active_mode: activeMode,
    active_event: activeEvent,
  };
}
