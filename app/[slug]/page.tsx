import { notFound } from "next/navigation";
import { ConnectForm } from "@/components/connect-form";
import { getPublicProfile } from "@/lib/profile";

export default async function PublicCardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);

  if (!profile) notFound();

  const initials = String(profile.full_name)
    .split(" ")
    .map((part: string) => part[0])
    .slice(0, 2)
    .join("");

  const firstName = String(profile.full_name).split(" ")[0];

  return (
    <main className="shell">
      <div className="topbar">
        <div className="brand">Biz Card</div>
      </div>

      <div className="profileHeader">
        <div className="profileMark">{initials}</div>
        <div>
          <div className="profileName">{profile.full_name}</div>
          <div className="profileMeta">{profile.title} · {profile.company}</div>
        </div>
      </div>

      <div className="eyebrow">Instant contact exchange</div>
      <h1 className="heroTitle" style={{ fontSize: 42 }}>Swap contacts.</h1>
      <p className="heroCopy">Share your info with {firstName}. Right after, you can save {firstName} directly to your phone.</p>

      <ConnectForm profile={profile} />
    </main>
  );
}
