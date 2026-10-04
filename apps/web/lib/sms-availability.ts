// SMS is deferred for the email-only launch. Re-enabling requires a coordinated
// app release, carrier provisioning, and a review of pending jobs.
export function smsAvailable(): boolean {
  return false;
}

export const SMS_UNAVAILABLE_MESSAGE = "Text follow-ups are not available in this release.";
