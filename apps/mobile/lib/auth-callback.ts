export const MOBILE_AUTH_REDIRECT = "bizcard://auth/callback";
export const INVALID_LINK_MESSAGE = "This sign-in link is invalid or has expired. Please request a new link on this device.";

type SessionResult<T> = { data: { session: T | null }; error: unknown };
type AuthExchange<T> = {
  exchangeCodeForSession: (code: string) => Promise<SessionResult<T>>;
  setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<SessionResult<T>>;
};

/** Ignore unrelated deep links; never log the callback, which contains credentials. */
export async function completeAuthCallback<T>(url: string, auth: AuthExchange<T>): Promise<T | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "bizcard:" || parsed.hostname !== "auth" || parsed.pathname !== "/callback") return null;

  const params = new URLSearchParams(parsed.hash.slice(1));
  parsed.searchParams.forEach((value, key) => params.set(key, value));
  if (params.has("error") || params.has("error_code")) throw new Error(INVALID_LINK_MESSAGE);

  const code = params.get("code");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  let result: SessionResult<T>;
  if (code) result = await auth.exchangeCodeForSession(code);
  else if (accessToken && refreshToken) result = await auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  else throw new Error(INVALID_LINK_MESSAGE);

  // Supabase returns most errors in the result instead of throwing them.
  if (result.error || !result.data.session) throw new Error(INVALID_LINK_MESSAGE);
  return result.data.session;
}
