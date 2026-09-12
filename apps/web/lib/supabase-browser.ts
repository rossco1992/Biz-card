import { createBizCardClient, type BizCardSupabaseClient } from "@biz-card/supabase";

let client: BizCardSupabaseClient | null | undefined;

export function getSupabaseBrowserClient() {
  if (client !== undefined) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    client = null;
    return client;
  }

  client = createBizCardClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}
