import { digest } from "./mailbox-crypto";
export type MailProvider = "google" | "microsoft";
export const isMailProvider = (value: unknown): value is MailProvider => value === "google" || value === "microsoft";
export const validEmail = (value: unknown): value is string => typeof value === "string" && /^[^\s<>(),;:\"\r\n]+@[^\s<>(),;:\"\r\n]+\.[^\s<>(),;:\"\r\n]+$/.test(value) && value.length <= 254;
export class ProviderFailure extends Error {
  reconnect: boolean;
  constructor(reconnect = false) { super("The email provider could not complete this request."); this.reconnect = reconnect; }
}
export function mailboxOrigin() {
  const url = new URL(process.env.MAILBOX_APP_URL || "");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) throw new Error("Mailbox URL must use HTTPS.");
  return url.origin;
}
export function providerConfig(provider: MailProvider) {
  const google = provider === "google";
  const clientId = process.env[google ? "GOOGLE_MAIL_CLIENT_ID" : "MICROSOFT_MAIL_CLIENT_ID"];
  const clientSecret = process.env[google ? "GOOGLE_MAIL_CLIENT_SECRET" : "MICROSOFT_MAIL_CLIENT_SECRET"];
  if (!clientId || !clientSecret) throw new Error("This email provider is not configured yet.");
  return {
    clientId, clientSecret,
    authorize: google ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    token: google ? "https://oauth2.googleapis.com/token" : "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: google ? "openid email https://www.googleapis.com/auth/gmail.send" : "openid email offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Send",
    redirectUri: `${mailboxOrigin()}/api/mailbox/callback/${provider}`,
  };
}
export function authorizationUrl(provider: MailProvider, state: string, verifier: string) {
  const c = providerConfig(provider);
  const url = new URL(c.authorize);
  url.search = new URLSearchParams({ client_id: c.clientId, redirect_uri: c.redirectUri, response_type: "code", scope: c.scopes,
    state, code_challenge: digest(verifier), code_challenge_method: "S256", prompt: provider === "google" ? "consent select_account" : "select_account",
    ...(provider === "google" ? { access_type: "offline" } : { response_mode: "query" }),
  }).toString();
  return url.toString();
}
export type TokenResult = { access_token: string; refresh_token?: string; scope?: string };
async function tokens(provider: MailProvider, params: Record<string, string>): Promise<TokenResult> {
  const c = providerConfig(provider);
  const response = await fetch(c.token, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...params }), signal: AbortSignal.timeout(15000), cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.access_token !== "string") throw new ProviderFailure(data.error === "invalid_grant" || data.error === "interaction_required");
  return data;
}
export const exchangeMailboxCode = (provider: MailProvider, code: string, verifier: string) => tokens(provider, {
  grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: providerConfig(provider).redirectUri,
});
export const refreshMailboxToken = (provider: MailProvider, refreshToken: string) => tokens(provider, { grant_type: "refresh_token", refresh_token: refreshToken });
export function hasSendScope(provider: MailProvider, scope = "") {
  const scopes = scope.toLowerCase().split(/\s+/);
  return scopes.includes(provider === "google" ? "https://www.googleapis.com/auth/gmail.send" : "mail.send") ||
    (provider === "microsoft" && scopes.includes("https://graph.microsoft.com/mail.send"));
}
export async function mailboxIdentity(provider: MailProvider, token: string) {
  const url = provider === "google" ? "https://openidconnect.googleapis.com/v1/userinfo" : "https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName";
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!response.ok) throw new ProviderFailure();
  const data = await response.json();
  const email = provider === "google" ? (data.email_verified === true ? data.email : null) : (data.mail || data.userPrincipalName);
  if (!validEmail(email)) throw new ProviderFailure();
  return email.toLowerCase();
}
export function gmailMessage(from: string, to: string, subject: string, text: string) {
  if (!validEmail(from) || !validEmail(to) || /[\r\n]/.test(subject)) throw new Error("Invalid email headers.");
  // Fold long encoded subjects and base64 body lines to stay within MIME limits.
  const chunks: string[] = [];
  let chunk = "";
  for (const char of subject) {
    if (Buffer.byteLength(chunk + char) > 42) { chunks.push(chunk); chunk = ""; }
    chunk += char;
  }
  if (chunk) chunks.push(chunk);
  const words = chunks.map(part => `=?UTF-8?B?${Buffer.from(part).toString("base64")}?=`).join("\r\n ");
  const body = Buffer.from(text).toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
  return Buffer.from([`From: ${from}`, `To: ${to}`, `Subject: ${words}`, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", body].join("\r\n")).toString("base64url");
}
export async function sendMailboxMessage(provider: MailProvider, token: string, message: { from: string; to: string; subject: string; text: string }): Promise<string | null> {
  if (!validEmail(message.from) || !validEmail(message.to) || /[\r\n]/.test(message.subject)) throw new Error("Invalid email headers.");
  const google = provider === "google";
  const body = google ? { raw: gmailMessage(message.from, message.to, message.subject, message.text) } : {
    message: { subject: message.subject, body: { contentType: "Text", content: message.text }, toRecipients: [{ emailAddress: { address: message.to } }] }, saveToSentItems: true,
  };
  const response = await fetch(google ? "https://gmail.googleapis.com/gmail/v1/users/me/messages/send" : "https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    // Gmail also uses 403 for quota/API configuration errors; reconnecting cannot fix those.
    const details = await response.json().catch(() => null);
    const permissionDenied = details?.error?.errors?.some((item: { reason?: string }) => item.reason === "insufficientPermissions" || item.reason === "authError") ||
      ["InvalidAuthenticationToken", "ErrorAccessDenied"].includes(details?.error?.code);
    throw new ProviderFailure(response.status === 401 || (response.status === 403 && Boolean(permissionDenied)));
  }
  // Graph returns 202 with no body. Accepted is not proof of delivery to an inbox.
  if (!google) return null;
  const data = await response.json();
  return typeof data.id === "string" ? data.id : null;
}
