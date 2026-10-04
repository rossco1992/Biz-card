import { smsAvailable, SMS_UNAVAILABLE_MESSAGE } from "./sms-availability";
type TwilioSender = {
  twilio_subaccount_sid: string | null;
  messaging_service_sid: string | null;
};

function config() {
  if (!smsAvailable()) throw new Error(SMS_UNAVAILABLE_MESSAGE);
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken) throw new Error("Twilio is not configured.");
  return { accountSid, authToken };
}

export function twilioConfigured() {
  try {
    config();
    return true;
  } catch {
    return false;
  }
}

export async function sendTwilioSms(sender: TwilioSender, to: string, body: string) {
  const { accountSid, authToken } = config();
  if (!sender.twilio_subaccount_sid || !sender.messaging_service_sid) {
    throw new Error("This texting sender is not fully provisioned.");
  }

  const params = new URLSearchParams({
    To: to,
    Body: body,
    MessagingServiceSid: sender.messaging_service_sid,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sender.twilio_subaccount_sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    },
  );

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.sid) {
    const detail = typeof result?.message === "string" ? result.message : "Twilio rejected the message.";
    throw new Error(detail);
  }

  return { id: String(result.sid) };
}
