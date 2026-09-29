import { demoProfile } from "./demo-profile";
import { getSupabaseAdmin } from "./supabase-admin";

export async function getPublicProfile(slug: string) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return slug === demoProfile.slug ? demoProfile : null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,slug,avatar_url,full_name,company,title,email,phone,website,followup_enabled,active_mode_id,active_event_id,email_signature,email_signature_html")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !profile) return null;

  let activeMode = null;
  if (profile.active_mode_id) {
    const { data } = await supabase
      .from("modes")
      .select("id,name,kind,delay_hours,subject_template,body_template,include_signature")
      .eq("id", profile.active_mode_id)
      .maybeSingle();
    activeMode = data;
  }

  let activeEvent = null;
  if (profile.active_event_id) {
    const { data } = await supabase
      .from("events")
      .select("id,name,location,event_date")
      .eq("id", profile.active_event_id)
      .maybeSingle();
    activeEvent = data;
  }

  return {
    ...profile,
    active_mode: activeMode,
    active_event: activeEvent,
  };
}
