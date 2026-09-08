"use client";

import { FormEvent, useState } from "react";

type Profile = {
  slug: string;
  full_name: string;
  company: string;
  title: string;
  email: string;
};

export function ConnectForm({ profile }: { profile: Profile }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      slug: profile.slug,
      first_name: String(form.get("first_name") || "").trim(),
      last_name: String(form.get("last_name") || "").trim(),
      email: String(form.get("email") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      consent: form.get("consent") === "on",
    };

    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Could not save your contact information.");
      }

      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div>
        <div className="successBadge">✓</div>
        <div className="center">
          <div className="eyebrow">Contact swap complete</div>
          <h1 className="heroTitle" style={{ fontSize: 40 }}>You're connected.</h1>
          <p className="heroCopy" style={{ marginInline: "auto" }}>Your information was shared. Now add {profile.full_name} to your phone.</p>
        </div>

        <section className="card sectionGap stack">
          <div className="contactCard">
            <div className="profileMark">{profile.full_name.split(" ").map((part) => part[0]).slice(0,2).join("")}</div>
            <div>
              <div className="profileName">{profile.full_name}</div>
              <div className="profileMeta">{profile.title} · {profile.company}</div>
              <div className="profileMeta">{profile.email}</div>
            </div>
          </div>
          <a className="primaryButton" href={`/api/vcard/${profile.slug}`}>Save {profile.full_name.split(" ")[0]} to contacts</a>
        </section>

        <div className="toast">That's it. The follow-up is handled automatically based on the card owner's active mode.</div>
      </div>
    );
  }

  return (
    <form className="card sectionGap stack" onSubmit={submit}>
      <div className="field">
        <label htmlFor="first_name">First name</label>
        <input className="input" id="first_name" name="first_name" autoComplete="given-name" required />
      </div>
      <div className="field">
        <label htmlFor="last_name">Last name</label>
        <input className="input" id="last_name" name="last_name" autoComplete="family-name" />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" inputMode="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="phone">Phone <span style={{ color: "#92979d", fontWeight: 600 }}>(optional)</span></label>
        <input className="input" id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" />
      </div>
      <label className="consent">
        <input name="consent" type="checkbox" required />
        <span>By connecting, you agree to share this information with {profile.full_name} and receive one follow-up message related to this introduction.</span>
      </label>
      <button className="primaryButton" type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Connecting…" : "Swap contacts"}
      </button>
      {status === "error" && <div className="toast error">{error}</div>}
      <div className="helper">No account required.</div>
    </form>
  );
}
