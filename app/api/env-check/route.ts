import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    supabase: {
      hasNextPublicUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      hasPublishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      hasServerPublishableKey: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
    },
  });
}
