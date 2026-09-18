// Temporary self-test only: never accepts a recipient or writes a connection.
type Profile = { id: string; full_name: string; email: string };
type Mode = { id: string; subject_template: string; body_template: string };
type Dependencies = {
  getUser: (token: string) => Promise<{ id: string; email?: string; email_confirmed_at?: string } | null>;
  getProfile: (userId: string) => Promise<Profile | null>;
  getMode: (profileId: string, modeId: string) => Promise<Mode | null>;
  render: (template: string, values: Record<string, string>) => string;
  send: (message: { to: string; replyTo: string; subject: string; text: string }, key: string) => Promise<boolean>;
};

export async function handleTestEmail(request: Request, deps: Dependencies) {
  const reply = (body: object, status: number) => Response.json(body, { status });
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return reply({ error: "Sign in to send a test email." }, 401);
  try {
    const user = await deps.getUser(token);
    if (!user?.email || !user.email_confirmed_at) return reply({ error: "Sign in with a verified email address." }, 401);
    const body = await request.json().catch(() => null);
    if (typeof body?.mode_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.mode_id)) {
      return reply({ error: "Choose a saved mode first." }, 400);
    }
    const profile = await deps.getProfile(user.id);
    if (!profile) return reply({ error: "Card not found." }, 404);
    const mode = await deps.getMode(profile.id, body.mode_id);
    if (!mode) return reply({ error: "Mode not found." }, 404);
    const parts = profile.full_name.trim().split(/\s+/);
    const values = { first_name: parts[0] || "there", last_name: parts.slice(1).join(" "), full_name: profile.full_name };
    // Provider deduplication bounds repeated taps per account/mode/minute.
    const key = `test-email/${user.id}/${mode.id}/${Math.floor(Date.now() / 60000)}`;
    const accepted = await deps.send({
      to: user.email,
      replyTo: profile.email,
      subject: "[Test] " + deps.render(mode.subject_template, values),
      text: deps.render(mode.body_template, values),
    }, key);
    if (!accepted) return reply({ error: "The email provider rejected this test. Check Resend logs and the verified sending domain." }, 502);
    return reply({ ok: true, recipient: user.email }, 200);
  } catch {
    return reply({ error: "Could not send the test email. Check server configuration and try again." }, 500);
  }
}
