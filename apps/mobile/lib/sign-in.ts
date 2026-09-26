/** A lightweight format check; Supabase remains the authority on deliverability. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function getSignInErrorMessage(cause: unknown): string {
  const error = cause && typeof cause === "object"
    ? cause as { code?: unknown; status?: unknown; message?: unknown; name?: unknown }
    : {};
  const code = typeof error.code === "string" ? error.code : "";
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

  if (code === "native_build_required") {
    return "Open the installed Knct’d app to sign in. Email links cannot return to this Expo Go preview.";
  }

  // Older Auth responses may omit codes or wrap rate limits in delivery errors.
  if (["over_email_send_rate_limit", "over_request_rate_limit"].includes(code)
    || error.status === 429 || /rate.?limit|too many requests|too many emails|for security purposes.*seconds/.test(message)) {
    return "Too many sign-in links have been requested. Please wait a while before trying again, and check your inbox for an earlier link.";
  }
  if (code === "email_address_invalid" || /invalid email|email.*invalid/.test(message)) {
    return "That email address couldn't be used. Check the address and try again.";
  }
  if (code === "email_address_not_authorized"
    || /(?:error|failed|failure).*send.*(?:confirmation|magic.?link|email)/.test(message)) {
    return "We couldn't deliver your sign-in email right now. Please try again later. If this keeps happening, contact support.";
  }
  if (["otp_disabled", "email_provider_disabled", "signup_disabled"].includes(code)
    || message.includes("supabase is not configured")) {
    return "Email sign-in is temporarily unavailable. Please try again later or contact support.";
  }
  if (code === "request_timeout" || error.name === "AuthRetryableFetchError"
    || /network request failed|failed to fetch|fetch failed|network.*error|timed? ?out/.test(message)) {
    return "We couldn't connect to the sign-in service. Check your internet connection and try again.";
  }
  return "We couldn't send your sign-in link right now. Please try again later.";
}
