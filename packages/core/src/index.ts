export const DEFAULT_WEB_URL = "https://www.getknctd.com";

/** Retire the original hosting address while preserving development overrides. */
export function resolveWebUrl(configured?: string): string {
  const value = configured?.trim() || DEFAULT_WEB_URL;
  try {
    const url = new URL(value);
    if (url.hostname === "bizcard-nu.vercel.app") return DEFAULT_WEB_URL;
    if (!["https:", "http:"].includes(url.protocol)) return DEFAULT_WEB_URL;
    return value.replace(/\/+$/, "");
  } catch {
    return DEFAULT_WEB_URL;
  }
}

/** Unique connection_id makes this a to-one join; tolerate older array payloads. */
export function getConnectionFollowup<T extends object>(
  connection: { followups?: T | T[] | null },
): T | undefined {
  const value = connection.followups;
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function publicCardUrl(slug: string, baseUrl = DEFAULT_WEB_URL) {
  return `${baseUrl.replace(/\/$/, "")}/${slugify(slug)}`;
}

export function mergeTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template,
  );
}

export function firstNameFromFullName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || "";
}

export function buildEventContext(name?: string | null, location?: string | null) {
  const eventName = name?.trim() || "the event";
  const eventLocation = location?.trim();
  return eventLocation ? `${eventName} in ${eventLocation}` : eventName;
}

export function appendEmailSignature(body: string, signature?: string | null, include = true) {
  const cleanBody = body.trim();
  const cleanSignature = signature?.trim() || "";
  if (!include || !cleanSignature) return cleanBody;
  return `${cleanBody}\n\n${cleanSignature}`;
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function connectionName(firstName: string, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

export const defaultModes = (profileId: string) => [
  {
    profile_id: profileId,
    name: "Everyday",
    kind: "everyday" as const,
    delay_hours: 24,
    subject_template: "Great meeting you",
    body_template:
      "Hey {{first_name}} — great meeting you. Wanted to follow up while our conversation was still fresh. If it'd be useful to keep talking, happy to find some time.",
    include_signature: true,
  },
  {
    profile_id: profileId,
    name: "Event",
    kind: "event" as const,
    delay_hours: 48,
    subject_template: "{{my_first_name}} from {{event_name}} — great meeting you",
    body_template:
      "Hey {{first_name}} — {{my_first_name}} here. It was great meeting you at {{event_context}}. I wanted to follow up while our conversation was still fresh. Would love to stay connected.",
    include_signature: true,
  },
];

/** Calendar dates stay in UTC for formatting so they never shift a day. */
export function validEventDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function formatEventDate(value?: string | null): string {
  if (!value || !validEventDate(value)) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}
