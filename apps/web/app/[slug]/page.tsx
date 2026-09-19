import { ProfilePhoto } from "@/components/profile-photo";
import { notFound } from "next/navigation";
import { ConnectForm } from "@/components/connect-form";
import { getPublicProfile } from "@/lib/profile";

export default async function PublicCardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);

  if (!profile) notFound();

  const firstName = String(profile.full_name).split(" ")[0];

  return (
    <main className="shell">
      <div className="topbar">
        <div className="brand">Biz Card</div>
      </div>

      <div className="profileHeader">
        <ProfilePhoto name={profile.full_name} url={"avatar_url" in profile ? profile.avatar_url : null} />
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
