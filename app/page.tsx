import { OwnerDashboard } from "@/components/owner-dashboard";

export default function Home() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    "";

  const publicConfig = JSON.stringify({ url, anonKey }).replace(/</g, "\\u003c");

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__BIZCARD_SUPABASE__ = ${publicConfig};`,
        }}
      />
      <OwnerDashboard />
    </>
  );
}
