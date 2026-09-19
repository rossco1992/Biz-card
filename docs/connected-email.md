# Gmail and Outlook follow-ups

Users connect a sending account in mobile **Automations → Send from your email** or the web dashboard. This is separate from Supabase sign-in: it does not replace login, request inbox-reading access, or ask users for email passwords. One mailbox per card is supported. Disconnect before changing accounts.

## Enable the feature

1. Apply `supabase/migrations/0003_connected_email.sql` to the existing project before deploying this code. It preserves existing data, adds server-only credential/state tables, and adds queue RPCs restricted to `service_role`. Do not expose either credential table through client policies or views.
2. Set the server environment values below on the **web/API** deployment. Redeploy it, and install/update the mobile app so it includes the new connection controls. `EXPO_PUBLIC_WEB_URL` must point at that same deployment. Keep `bizcard` as the installed app scheme. Expo Go cannot handle this stable callback.
3. Register both OAuth applications as described below. Each user's browser asks the provider for consent. Connecting does not send an email.
4. Enable the scheduled sender after the migration and deployment are healthy. It does send real queued follow-ups. Never point a preview deployment's worker at production data.

| Server variable | Value |
| --- | --- |
| `MAILBOX_APP_URL` | Exact HTTPS web origin; no path/trailing slash. Use a stable domain, not changing preview URLs. |
| `MAILBOX_ENCRYPTION_KEY` | Base64 encoding of 32 random bytes (`openssl rand -base64 32`). Store securely and retain across deployments. Changing/loss of the key requires every mailbox to reconnect. |
| `GOOGLE_MAIL_CLIENT_ID`, `GOOGLE_MAIL_CLIENT_SECRET` | Google Web Application OAuth credentials |
| `MICROSOFT_MAIL_CLIENT_ID`, `MICROSOFT_MAIL_CLIENT_SECRET` | Microsoft application/client ID and client secret **value**, not the secret ID |
| `CRON_SECRET` | Long random scheduler bearer secret (`openssl rand -hex 32`) |
| Existing Supabase URL and service-role/secret key | Server database access; these remain required |

No client secret, encryption key, refresh token or service-role key belongs in a `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` variable. Provider tokens never travel through the mobile app. Refresh tokens are AES-256-GCM encrypted with owner/provider-bound authenticated data; access tokens exist only during server requests.

### Google

In Google Cloud, create/select a project, enable the **Gmail API**, and configure Google Auth Platform branding, audience and data access. Create an OAuth client of type **Web application**.

Authorized redirect URI:

`https://YOUR-WEB-HOST/api/mailbox/callback/google`

Requested scopes: `openid`, `email`, and `https://www.googleapis.com/auth/gmail.send`. The server uses offline access and explicit consent so scheduled messages can send after the app closes. Users must grant sending permission; partial consent is rejected. A Gmail-enabled Google account is required.

For a prototype in Testing, add your testers to the consent-screen test-user list. Google generally expires refresh tokens after seven days for external Testing apps requesting these scopes; the UI then asks the owner to reconnect. Public launch requires the applicable Google sensitive-scope verification and accurate privacy/consent documentation. Do not request `mail.google.com`, `gmail.modify` or inbox-reading scopes for this feature.

References: [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes).

### Microsoft / Outlook

In Microsoft Entra **App registrations**, register a **Web** application supporting **accounts in any organizational directory and personal Microsoft accounts**. This matches the implementation's `common` authority. Create a client secret and store its value on the server.

Web redirect URI:

`https://YOUR-WEB-HOST/api/mailbox/callback/microsoft`

Use **delegated** Microsoft Graph permissions `Mail.Send` and `User.Read`, plus `openid`, `email`, and `offline_access`. `User.Read` is used only to identify the connected account's email address. Do not enable application-wide mailbox permissions. Some organizations require an administrator to approve consent. The account must have an Outlook/Exchange mailbox; government/national-cloud authorities are not implemented.

References: [Microsoft authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [Graph sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0).

Both providers return to the server first. After the server stores a short-lived, encrypted pending authorization, the browser returns a one-use receipt to the web app or `bizcard://email-connected`. Finalization requires the original signed-in Biz Card account and that receipt. A provider callback alone cannot attach a mailbox to someone else's account. Keep callback/launch query strings and receipts out of analytics and access-log exports. They contain temporary authorization material.

## Scheduled sending

Gmail/Graph do not schedule these messages themselves. New contact submissions snapshot the recipient, subject, body, due time and mailbox ID in `followups`. Existing Resend rows keep `delivery_provider = 'resend'`; the new worker never claims them, and the existing Resend webhook still processes their status. Keep the old Resend configuration/webhook until those already submitted schedules have drained. Supabase's authentication SMTP is independent and may still use Resend.

The included `docs/send-followups.workflow.yml` is a ready-to-copy GitHub Actions template. A repository owner (or credential with the `workflow` scope) must add it as `.github/workflows/send-followups.yml`. Once added, it runs on the default branch every five minutes and can be manually dispatched. It is disabled until configured:

- Repository Actions variable `MAILBOX_SCHEDULER_ENABLED` = `true`.
- Repository Actions variable `MAILBOX_APP_URL` = the production web origin.
- Repository Actions secret `CRON_SECRET` = the same value as on the web server.

GitHub cron is best effort and can be delayed or disabled for inactive public repositories. For tighter timing, use a reliable external scheduler calling `GET /api/jobs/followups` every minute with `Authorization: Bearer <CRON_SECRET>` instead. Use one scheduler. This PR does not add a paid Vercel cron requirement. The route requires a deployment capable of running up to 60 seconds.

Each invocation claims up to four due messages, at most one per mailbox. SQL row locks prevent overlapping workers from claiming the same message. Keep an eye on backlog; higher-volume use needs a dedicated queue/worker. A five-minute schedule means normal follow-up timing is approximate, and multiple messages for one owner drain one per run.

Token refresh, including Microsoft refresh-token rotation, happens before sending. Permissions errors mark the mailbox `reconnect`. Missing/disconnected/replaced mailboxes and paused follow-ups are cancelled; messages already submitted to a provider cannot be recalled. Disconnect removes stored credentials and cancels pending mailbox jobs in a transaction. It does not revoke the provider's consent grant; users can also remove Biz Card under Google/Microsoft account permissions.

If a request times out after it may have been accepted, do **not** automatically resend. Mark it failed with a check-your-Sent-folder message. A worker that crashes leaves `sending` until a later invocation marks it uncertain after 15 minutes; it never requeues that email. Review failures with the owner before any manual resend. `sent` records provider acceptance, **not inbox delivery**; Graph's 202 response has no message ID. Mailbox providers do not provide the old Resend delivery/bounce webhook here.

No connected mailbox means the contact is saved with a failed follow-up and a clear owner-facing explanation. Connecting later does not retroactively send those old failed messages. This avoids surprising recipients. The temporary Resend test button was removed from mobile; the old server diagnostic route is not the connected-mailbox test path.

## Verification

Run from the repository root:

```
npm ci
npm run typecheck
npm run test:mailbox --workspace=@biz-card/web
npm run build
```

The mailbox suite runs production OAuth handlers against the migration in PGlite (PostgreSQL compiled to WASM), with provider HTTP responses mocked. It covers identity/receipt ownership, expired/replayed state, token confidentiality, permissions, queue claiming, stale sends, disconnect, provider payloads and error handling. This is not a substitute for a staging Supabase migration and live provider consent tests. PGlite does not test distributed-worker concurrency across separate database connections.

Before enabling production scheduling:

1. Apply migration to staging, configure separate provider credentials/server secrets, and deploy. Verify unavailable providers show disabled buttons rather than a broken consent page.
2. On both web and the installed mobile app, connect Gmail and then Outlook (disconnect between tests). Check the sender address displayed. Cancel consent, deny sending scope, and try returning while signed into a different Biz Card account; none should attach credentials.
3. Submit a contact with explicit consent using an address you control. Run the scheduler only once the job is due; confirm the email comes from the connected mailbox and appears in its Sent folder. Confirm Graph acceptance is not presented as proof of inbox delivery.
4. Verify an expired access token refreshes, then revoke provider permission and verify reconnect UI appears without exposing secrets.
5. Disconnect/pause with a future queued job, run the scheduler when due, and verify no new email is sent. Reconnect to a different mailbox and verify old jobs do not switch sender.
6. Run overlapping worker requests in staging, simulate a timeout/crash, and verify no automatic duplicate sends. Confirm old Resend schedules are ignored by the new worker.

Live Google/Microsoft consent, sending, production migration and mobile device validation require configured provider applications and are not performed by the automated suite.
