import { getSupabaseAdmin } from "./supabase-admin";

export class OwnerApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireOwner(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) throw new OwnerApiError("Service unavailable.", 503);

  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw new OwnerApiError("Please sign in again.", 401);

  const { data, error } = await db.auth.getUser(header.slice(7));
  if (error || !data.user) throw new OwnerApiError("Please sign in again.", 401);

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (profileError) throw new OwnerApiError("Could not load your card.", 503);
  if (!profile) throw new OwnerApiError("Create your card first.", 409);

  return { db, profileId: profile.id };
}

export function ownerApiError(error: unknown, fallback = "Something went wrong. Please try again.") {
  const status = error instanceof OwnerApiError ? error.status : 503;
  const message = error instanceof OwnerApiError ? error.message : fallback;
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
