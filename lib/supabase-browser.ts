import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  interface Window {
    __BIZCARD_SUPABASE__?: {
      url?: string;
      anonKey?: string;
    };
  }
}

let client: SupabaseClient | undefined;

export function getSupabaseBrowserClient() {
  if (client) return client;

  const runtimeConfig =
    typeof window !== "undefined" ? window.__BIZCARD_SUPABASE__ : undefined;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    runtimeConfig?.url;

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    runtimeConfig?.anonKey;

  if (!url || !anonKey) {
    return null;
  }

  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}
