/** Returns only fixed setting names. Never return values or raw SDK errors. */
export function missingTestEmailSettings(env: Record<string, string | undefined>): string[] {
  const missing: string[] = [];
  // Match the precedence used by getSupabaseAdmin.
  if (!(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL)?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)");
  }
  if (!(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY)?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)");
  }
  if (!env.RESEND_API_KEY?.trim()) missing.push("RESEND_API_KEY");
  if (!env.FOLLOWUP_FROM_EMAIL?.trim()) missing.push("FOLLOWUP_FROM_EMAIL");
  return missing;
}

export function testEmailConfigError(env: Record<string, string | undefined>): string | null {
  const missing = missingTestEmailSettings(env);
  return missing.length
    ? `Test email is unavailable. Missing or blank on this web deployment: ${missing.join(", ")}. Check these settings on the Vercel project serving this URL, then redeploy.`
    : null;
}
