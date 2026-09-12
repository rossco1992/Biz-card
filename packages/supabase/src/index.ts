import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";
import type { Database } from "@biz-card/types";

export type BizCardSupabaseClient = SupabaseClient<Database>;

export function createBizCardClient(
  url: string,
  key: string,
  options?: SupabaseClientOptions<"public">,
) {
  return createClient<Database>(url, key, options);
}

export async function loadOwnerWorkspace(client: BizCardSupabaseClient, userId: string) {
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) return { profile: null, modes: [], connections: [] };

  const [modesResult, connectionsResult] = await Promise.all([
    client.from("modes").select("*").eq("profile_id", profile.id).order("created_at"),
    client
      .from("connections")
      .select("*,followups(status,send_at,sent_at,error)")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (modesResult.error) throw modesResult.error;
  if (connectionsResult.error) throw connectionsResult.error;

  return {
    profile,
    modes: modesResult.data ?? [],
    connections: connectionsResult.data ?? [],
  };
}
