import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sameSecret } from "@/lib/mailbox-crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const token = process.env.KNCT_ADMIN_TOKEN;
  return Boolean(token && sameSecret(request.headers.get("authorization") || "", `Bearer ${token}`));
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Admin access is unavailable." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const days = Number(body?.days);
  const lifetime = body?.lifetime === true;
  const plan = body?.plan === "pro_plus" ? "pro_plus" : "pro";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 300) : `Complimentary KNCT ${plan === "pro_plus" ? "Pro+" : "Pro"}`;

  if (!slug || (!lifetime && (!Number.isFinite(days) || days < 1 || days > 3650))) {
    return NextResponse.json({ error: "Provide a KNCT slug and either lifetime=true or days between 1 and 3650." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await db.from("profiles").select("id,slug,full_name").eq("slug", slug).maybeSingle();
  if (profileError) return NextResponse.json({ error: "Could not find that KNCT account." }, { status: 503 });
  if (!profile) return NextResponse.json({ error: "KNCT account not found." }, { status: 404 });

  const expiresAt = lifetime ? null : new Date(Date.now() + days * 86400000).toISOString();
  const { error } = await db.from("profile_entitlements").upsert({
    profile_id: profile.id,
    admin_lifetime: lifetime,
    admin_expires_at: expiresAt,
    admin_note: note,
    sms_admin_lifetime: plan === "pro_plus" ? lifetime : false,
    sms_admin_expires_at: plan === "pro_plus" ? expiresAt : null,
    sms_admin_note: plan === "pro_plus" ? note : null,
    updated_at: new Date().toISOString(),
  } as never, { onConflict: "profile_id" });

  if (error) {
    console.error("complimentary Pro grant failed", error);
    return NextResponse.json({ error: "Could not grant Pro access." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    slug: profile.slug,
    name: profile.full_name,
    plan,
    source: "admin",
    lifetime,
    expires_at: expiresAt,
  });
}

export async function DELETE(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Admin access is unavailable." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!slug) return NextResponse.json({ error: "Provide a KNCT slug." }, { status: 400 });

  const { data: profile } = await db.from("profiles").select("id").eq("slug", slug).maybeSingle();
  if (!profile) return NextResponse.json({ error: "KNCT account not found." }, { status: 404 });

  const { error } = await db.from("profile_entitlements").update({
    admin_lifetime: false,
    admin_expires_at: null,
    admin_note: null,
    sms_admin_lifetime: false,
    sms_admin_expires_at: null,
    sms_admin_note: null,
    updated_at: new Date().toISOString(),
  } as never).eq("profile_id", profile.id);

  if (error) return NextResponse.json({ error: "Could not revoke complimentary Pro." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
