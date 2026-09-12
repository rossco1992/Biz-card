export const DEFAULT_WEB_URL = "https://bizcard-nu.vercel.app";

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
  },
  {
    profile_id: profileId,
    name: "Event",
    kind: "event" as const,
    delay_hours: 48,
    subject_template: "Great meeting you at the event",
    body_template:
      "Hey {{first_name}} — it was great meeting you at the event. I wanted to follow up while our conversation was still fresh. If you'd like to keep talking, happy to find some time.",
  },
];
