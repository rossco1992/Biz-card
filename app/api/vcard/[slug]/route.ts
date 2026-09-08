import { getPublicProfile } from "@/lib/profile";

function escapeVCard(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);

  if (!profile) {
    return new Response("Card not found", { status: 404 });
  }

  const nameParts = profile.full_name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCard(profile.full_name)}`,
    `N:${escapeVCard(lastName)};${escapeVCard(firstName)};;;`,
    profile.company ? `ORG:${escapeVCard(profile.company)}` : null,
    profile.title ? `TITLE:${escapeVCard(profile.title)}` : null,
    profile.email ? `EMAIL;TYPE=INTERNET:${escapeVCard(profile.email)}` : null,
    profile.phone ? `TEL;TYPE=CELL:${escapeVCard(profile.phone)}` : null,
    profile.website ? `URL:${escapeVCard(profile.website)}` : null,
    "END:VCARD",
  ].filter(Boolean);

  const fileName = `${profile.full_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "contact"}.vcf`;

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
