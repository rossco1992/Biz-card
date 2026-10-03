import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const forbiddenEnv = files.filter((path) =>
  /(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith(".env.example"),
);

const patterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["Stripe live key", /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/],
  ["OpenAI-style secret", /\bsk-[A-Za-z0-9_-]{32,}\b/],
  ["Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
  ["committed environment secret", /^(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|RESEND_API_KEY|RESEND_WEBHOOK_SECRET|MAILBOX_ENCRYPTION_KEY|GOOGLE_MAIL_CLIENT_SECRET|MICROSOFT_MAIL_CLIENT_SECRET|CRON_SECRET|TWILIO_AUTH_TOKEN|REVENUECAT_WEBHOOK_AUTH|KNCT_ADMIN_TOKEN)=\S+/m],
];

const findings = [];
for (const path of files) {
  if (path === "package-lock.json") continue;
  let body;
  try {
    body = readFileSync(path);
  } catch {
    continue;
  }
  if (body.includes(0)) continue;
  const text = body.toString("utf8");
  for (const [label, pattern] of patterns) {
    if (pattern.test(text)) findings.push(`${path}: ${label}`);
  }
}

if (forbiddenEnv.length || findings.length) {
  console.error("Security scan failed.");
  for (const path of forbiddenEnv) console.error(`${path}: tracked environment file`);
  for (const finding of findings) console.error(finding);
  process.exit(1);
}

console.log(`Security scan passed across ${files.length} tracked files.`);
