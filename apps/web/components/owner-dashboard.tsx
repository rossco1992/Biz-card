"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Session } from "@supabase/supabase-js";
import { defaultModes, slugify } from "@biz-card/core";
import type { Connection, Mode, Profile } from "@biz-card/types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

function formatWhen(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function OwnerDashboard() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [modes, setModes] = useState<Mode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [editingMode, setEditingMode] = useState<Mode | null>(null);
  const [origin, setOrigin] = useState("");

  const loadOwnerData = useCallback(async (userId: string) => {
    if (!supabase) return;

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id,user_id,slug,full_name,company,title,email,phone,website,followup_enabled,active_mode_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profileData) {
      setProfile(null);
      setModes([]);
      setConnections([]);
      return;
    }

    const ownerProfile = profileData as Profile;
    setProfile(ownerProfile);

    const [{ data: modeData, error: modeError }, { data: connectionData, error: connectionError }] = await Promise.all([
      supabase
        .from("modes")
        .select("id,profile_id,name,kind,delay_hours,subject_template,body_template")
        .eq("profile_id", ownerProfile.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("connections")
        .select("id,first_name,last_name,email,mode_name_snapshot,created_at,followups(status,send_at,sent_at)")
        .eq("profile_id", ownerProfile.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (modeError) throw modeError;
    if (connectionError) throw connectionError;

    const ownerModes = (modeData ?? []) as unknown as Mode[];
    setModes(ownerModes);
    setConnections((connectionData ?? []) as unknown as Connection[]);

    const active = ownerModes.find((mode) => mode.id === ownerProfile.active_mode_id) ?? ownerModes[0] ?? null;
    setEditingMode(active);
  }, [supabase]);

  useEffect(() => {
    setOrigin(window.location.origin);
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user?.id) {
        try {
          await loadOwnerData(data.session.user.id);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not load your card.");
        }
      }
      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setModes([]);
        setConnections([]);
      } else {
        void loadOwnerData(nextSession.user.id).catch((err) => {
          setError(err instanceof Error ? err.message : "Could not load your card.");
        });
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadOwnerData, supabase]);

  const activeMode = modes.find((mode) => mode.id === profile?.active_mode_id) ?? modes[0] ?? null;
  const publicUrl = profile && origin ? `${origin}/${profile.slug}` : "";

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true);
    setError("");
    setMessage("");

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: { emailRedirectTo: window.location.origin },
    });

    setAuthBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setMessage("Check your email for the sign-in link.");
  }

  async function createCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session) return;
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("full_name") || "").trim();
    const slug = slugify(String(form.get("slug") || fullName));
    const email = String(form.get("email") || session.user.email || "").trim().toLowerCase();

    if (!fullName || !slug || !email) {
      setError("Name, card URL, and email are required.");
      return;
    }

    const { data: insertedProfile, error: insertProfileError } = await supabase
      .from("profiles")
      .insert({
        user_id: session.user.id,
        slug,
        full_name: fullName,
        company: String(form.get("company") || "").trim(),
        title: String(form.get("title") || "").trim(),
        email,
        phone: String(form.get("phone") || "").trim() || null,
        website: String(form.get("website") || "").trim() || null,
        followup_enabled: true,
      })
      .select("id")
      .single();

    if (insertProfileError || !insertedProfile) {
      setError(insertProfileError?.message || "Could not create your card.");
      return;
    }

    const { data: insertedModes, error: insertModeError } = await supabase
      .from("modes")
      .insert(defaultModes(insertedProfile.id))
      .select("id,kind");

    if (insertModeError || !insertedModes) {
      setError(insertModeError?.message || "Your card was created, but the default modes failed.");
      return;
    }

    const everyday = insertedModes.find((mode) => mode.kind === "everyday");
    if (everyday) {
      await supabase.from("profiles").update({ active_mode_id: everyday.id }).eq("id", insertedProfile.id);
    }

    await loadOwnerData(session.user.id);
    setMessage("Your card is ready.");
  }

  async function activateMode(modeId: string) {
    if (!supabase || !profile) return;
    setError("");
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ active_mode_id: modeId, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const next = { ...profile, active_mode_id: modeId };
    setProfile(next);
    setEditingMode(modes.find((mode) => mode.id === modeId) ?? null);
  }

  async function toggleFollowup() {
    if (!supabase || !profile) return;
    const nextValue = !profile.followup_enabled;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ followup_enabled: nextValue, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setProfile({ ...profile, followup_enabled: nextValue });
  }

  async function saveMode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !editingMode) return;
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const delay = Math.min(72, Math.max(1, Number(form.get("delay_hours")) || 24));
    const updates = {
      name: String(form.get("name") || editingMode.name).trim(),
      delay_hours: delay,
      subject_template: String(form.get("subject_template") || "").trim(),
      body_template: String(form.get("body_template") || "").trim(),
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase.from("modes").update(updates).eq("id", editingMode.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    const nextMode = { ...editingMode, ...updates };
    setModes((current) => current.map((mode) => mode.id === nextMode.id ? nextMode : mode));
    setEditingMode(nextMode);
    setMessage("Follow-up mode saved.");
  }

  if (loading) {
    return <main className="shell"><div className="brand">Biz Card</div><div className="toast sectionGap">Loading…</div></main>;
  }

  if (!supabase) {
    return (
      <main className="shell">
        <div className="brand">Biz Card</div>
        <h1 className="heroTitle sectionGap">Almost ready.</h1>
        <p className="heroCopy">Connect Supabase and add the public URL + anon key to enable real accounts. The public card demo still works at <a href="/ross">/ross</a>.</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="shell">
        <div className="topbar"><div className="brand">Biz Card</div></div>
        <div className="eyebrow">Private pilot</div>
        <h1 className="heroTitle">Your card.<br />Your follow-up.</h1>
        <p className="heroCopy">Sign in with your email. No password required.</p>
        <form className="card sectionGap stack" onSubmit={sendMagicLink}>
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input id="auth-email" className="input" type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} required autoComplete="email" />
          </div>
          <button className="primaryButton" disabled={authBusy}>{authBusy ? "Sending…" : "Email me a sign-in link"}</button>
          {message && <div className="toast">{message}</div>}
          {error && <div className="toast error">{error}</div>}
        </form>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="shell">
        <div className="topbar"><div className="brand">Biz Card</div><button className="textButton" style={{ width: "auto" }} onClick={() => void supabase.auth.signOut()}>Sign out</button></div>
        <div className="eyebrow">One-time setup</div>
        <h1 className="heroTitle">Create your card.</h1>
        <p className="heroCopy">This takes about a minute. You can change the follow-up messages afterward.</p>
        <form className="card sectionGap stack" onSubmit={createCard}>
          <div className="field"><label htmlFor="full_name">Full name</label><input className="input" id="full_name" name="full_name" required /></div>
          <div className="field"><label htmlFor="slug">Card URL</label><input className="input" id="slug" name="slug" placeholder="jane-smith" required /></div>
          <div className="field"><label htmlFor="company">Company</label><input className="input" id="company" name="company" /></div>
          <div className="field"><label htmlFor="title">Title</label><input className="input" id="title" name="title" /></div>
          <div className="field"><label htmlFor="owner-email">Email</label><input className="input" id="owner-email" name="email" type="email" defaultValue={session.user.email ?? ""} required /></div>
          <div className="field"><label htmlFor="phone">Phone</label><input className="input" id="phone" name="phone" type="tel" /></div>
          <div className="field"><label htmlFor="website">Website</label><input className="input" id="website" name="website" type="url" placeholder="https://" /></div>
          <button className="primaryButton">Create my card</button>
          {error && <div className="toast error">{error}</div>}
        </form>
      </main>
    );
  }

  const initials = profile.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  return (
    <main className="shell">
      <div className="topbar">
        <div className="brand">Biz Card</div>
        <button className="avatar" title="Sign out" onClick={() => void supabase.auth.signOut()}>{initials}</button>
      </div>

      <div className="eyebrow">Your smart card</div>
      <h1 className="heroTitle">Meet once.<br />Follow up automatically.</h1>
      <p className="heroCopy">The QR stays the same. Change the active mode whenever your context changes.</p>

      <section className="card sectionGap stack">
        <div>
          <div className="miniLabel">Current mode</div>
          <div className="modeTabs" style={{ marginTop: 10 }}>
            {modes.map((mode) => (
              <button key={mode.id} className={`modeTab ${activeMode?.id === mode.id ? "active" : ""}`} onClick={() => void activateMode(mode.id)}>
                {mode.kind === "everyday" ? "Everyday" : "Event"}
              </button>
            ))}
          </div>
        </div>

        {publicUrl && (
          <div className="qrWrap"><QRCodeSVG value={publicUrl} level="M" marginSize={1} /></div>
        )}

        <div className="statusPill">
          <span className="statusDot" />
          {profile.followup_enabled && activeMode ? `${activeMode.name} · follow-up in ${activeMode.delay_hours}h` : "Automatic follow-up paused"}
        </div>
        <div className="helper">Have them scan this. They share their info, then save yours.</div>
        <a className="primaryButton" href={`/${profile.slug}`}>Open my public card</a>
        <button className="secondaryButton" onClick={() => void toggleFollowup()}>{profile.followup_enabled ? "Pause automatic follow-up" : "Turn automatic follow-up on"}</button>
      </section>

      {activeMode && (
        <form className="card sectionGap stack" onSubmit={saveMode} key={editingMode?.id ?? activeMode.id}>
          <div className="miniLabel">Edit {editingMode?.kind === "event" ? "event" : "everyday"} follow-up</div>
          <div className="field"><label htmlFor="mode-name">Mode name</label><input className="input" id="mode-name" name="name" defaultValue={editingMode?.name ?? activeMode.name} /></div>
          <div className="field"><label htmlFor="delay-hours">Send after</label><input className="input" id="delay-hours" name="delay_hours" type="number" min="1" max="72" defaultValue={editingMode?.delay_hours ?? activeMode.delay_hours} /></div>
          <div className="field"><label htmlFor="subject-template">Subject</label><input className="input" id="subject-template" name="subject_template" defaultValue={editingMode?.subject_template ?? activeMode.subject_template} required /></div>
          <div className="field"><label htmlFor="body-template">Message</label><textarea className="textarea" id="body-template" name="body_template" defaultValue={editingMode?.body_template ?? activeMode.body_template} required /></div>
          <div className="helper" style={{ textAlign: "left", marginTop: 0 }}>Use <strong>{"{{first_name}}"}</strong> to personalize the message.</div>
          <button className="secondaryButton">Save mode</button>
        </form>
      )}

      {(message || error) && <div className={`toast sectionGap ${error ? "error" : ""}`}>{error || message}</div>}

      <section className="card sectionGap">
        <div className="miniLabel">Recent connections</div>
        {connections.length === 0 && <div className="helper" style={{ textAlign: "left", padding: "12px 0" }}>No scans yet. Your first connection will show up here.</div>}
        {connections.map((connection) => {
          const followup = connection.followups?.[0];
          const name = [connection.first_name, connection.last_name].filter(Boolean).join(" ");
          const status = followup?.status === "sent"
            ? "✓ Sent"
            : followup?.status === "failed"
              ? "Needs attention"
              : followup?.send_at
                ? `Sends ${formatWhen(followup.send_at)}`
                : "No follow-up";

          return (
            <div className="connectionRow" key={connection.id}>
              <div>
                <div className="connectionName">{name}</div>
                <div className="connectionMeta">{connection.mode_name_snapshot || "No mode"} · {formatWhen(connection.created_at)}</div>
              </div>
              <div className="connectionStatus">{status}</div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
