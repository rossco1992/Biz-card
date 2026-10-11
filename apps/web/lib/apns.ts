import { createPrivateKey, sign } from "node:crypto";
import { connect } from "node:http2";

type ApnsEnvironment = "development" | "production";

export type ApnsResult = {
  accepted: boolean;
  apnsId: string | null;
  invalidToken: boolean;
  reason: string | null;
};

let cachedJwt: { value: string; issuedAt: number } | null = null;

function configured() {
  return Boolean(
    process.env.APNS_TEAM_ID
      && process.env.APNS_KEY_ID
      && process.env.APNS_PRIVATE_KEY
      && process.env.APNS_BUNDLE_ID,
  );
}

function base64url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function providerToken() {
  if (!configured()) throw new Error("APNs is not configured.");

  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.issuedAt < 45 * 60) return cachedJwt.value;

  const keyId = process.env.APNS_KEY_ID!;
  const teamId = process.env.APNS_TEAM_ID!;
  const privateKey = process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: now }));
  const input = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(input), {
    key: createPrivateKey(privateKey),
    dsaEncoding: "ieee-p1363",
  });
  const value = `${input}.${base64url(signature)}`;
  cachedJwt = { value, issuedAt: now };
  return value;
}

export function apnsConfigured() {
  return configured();
}

export async function sendApnsNotification(
  deviceToken: string,
  environment: ApnsEnvironment,
  notification: { title: string; body: string; data: Record<string, string> },
): Promise<ApnsResult> {
  if (!configured()) {
    return { accepted: false, apnsId: null, invalidToken: false, reason: "APNs is not configured." };
  }

  const host = environment === "development"
    ? "https://api.development.push.apple.com"
    : "https://api.push.apple.com";
  const client = connect(host);
  const bundleId = process.env.APNS_BUNDLE_ID!;

  return await new Promise<ApnsResult>((resolve) => {
    let settled = false;
    const finish = (result: ApnsResult) => {
      if (settled) return;
      settled = true;
      client.close();
      resolve(result);
    };

    client.once("error", () => finish({
      accepted: false,
      apnsId: null,
      invalidToken: false,
      reason: "APNs connection failed.",
    }));

    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken()}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    let status = 0;
    let apnsId: string | null = null;
    let responseBody = "";

    request.on("response", (headers) => {
      status = Number(headers[":status"] || 0);
      apnsId = typeof headers["apns-id"] === "string" ? headers["apns-id"] : null;
    });
    request.setEncoding("utf8");
    request.on("data", (chunk) => { responseBody += chunk; });
    request.on("error", () => finish({
      accepted: false,
      apnsId,
      invalidToken: false,
      reason: "APNs request failed.",
    }));
    request.on("end", () => {
      let reason: string | null = null;
      try {
        reason = responseBody ? JSON.parse(responseBody)?.reason ?? null : null;
      } catch {
        reason = null;
      }
      finish({
        accepted: status === 200,
        apnsId,
        invalidToken: status === 410 || reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic",
        reason,
      });
    });

    request.end(JSON.stringify({
      aps: {
        alert: {
          title: notification.title,
          body: notification.body,
        },
        sound: "default",
      },
      ...notification.data,
    }));
  });
}
