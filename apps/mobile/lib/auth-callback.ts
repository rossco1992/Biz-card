export const MOBILE_AUTH_REDIRECT = "bizcard://auth/callback";
export const INVALID_LINK_MESSAGE = "This sign-in link is invalid or has expired. Please request a new link on this device.";

type SessionResult<T> = { data: { session: T | null }; error: unknown };
type AuthExchange<T> = {
  exchangeCodeForSession: (code: string) => Promise<SessionResult<T>>;
};

/**
 * Only PKCE authorization codes are accepted. Access and refresh tokens must never
 * be accepted directly from a deep-link URL.
 */
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
  if (!code || !/^[A-Za-z0-9._~-]{1,2048}$/.test(code)) throw new Error(INVALID_LINK_MESSAGE);

  const result = await auth.exchangeCodeForSession(code);
  if (result.error || !result.data.session) throw new Error(INVALID_LINK_MESSAGE);
  return result.data.session;
}
