import { Brand } from "@/components/brand";
import { ProfilePhoto } from "@/components/profile-photo";
import { notFound } from "next/navigation";
import { ConnectForm } from "@/components/connect-form";
import { getPublicProfile } from "@/lib/profile";

export default async function PublicCardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);

  if (!profile) notFound();

  const firstName = String(profile.full_name).split(" ")[0];
  // Only these explicitly public card fields cross the server/client boundary.
  // Do not pass follow-up templates, signatures, IDs, feature flags, or event data.
  const publicCard = {
    avatar_url: profile.avatar_url,
    slug: profile.slug,
    full_name: profile.full_name,
    company: profile.company,
    title: profile.title,
    email: profile.email,
  };

  return (
    <main className="shell">
      <div className="topbar">
        <Brand />
      </div>

      <div className="profileHeader">
        <ProfilePhoto name={profile.full_name} url={profile.avatar_url} />
        <div>
          <div className="profileName">{profile.full_name}</div>
          <div className="profileMeta">{profile.title} · {profile.company}</div>
        </div>
      </div>

      <div className="eyebrow">Instant contact exchange</div>
      <h1 className="heroTitle" style={{ fontSize: 42 }}>Swap contacts.</h1>
      <p className="heroCopy">Share your info with {firstName}. Right after, you can save {firstName} directly to your phone.</p>

      <ConnectForm profile={publicCard} />
      <footer className="publicFooter"><a href="/privacy">Privacy Policy</a></footer>
    </main>
  );
}
