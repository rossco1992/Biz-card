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
  if (!profile) return { profile: null, modes: [], events: [], connections: [], subscription: null };

  const [modesResult, eventsResult, connectionsResult, subscriptionResult] = await Promise.all([
    client.from("modes").select("*").eq("profile_id", profile.id).order("created_at"),
    client.from("events").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }),
    client
      .from("connections")
      .select("*,followups(id,channel,status,send_at,sent_at,reminded_at,delivery_provider,error)")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(100),
    client.rpc("my_subscription_access"),
  ]);

  if (modesResult.error) throw modesResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (connectionsResult.error) throw connectionsResult.error;

  return {
    profile,
    modes: modesResult.data ?? [],
    events: eventsResult.data ?? [],
    connections: connectionsResult.data ?? [],
    subscription: subscriptionResult.error
      ? { plan: "free", source: "free", sms_access: false, expires_at: null, revenuecat_status: "inactive", product_id: null, used: 0, limit: 5 }
      : subscriptionResult.data ?? null,
  };
}
