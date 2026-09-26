# Knct’d TestFlight readiness

Gmail and Outlook are both required for the first external beta. This checklist records evidence, not assumptions. Last audited: 2026-09-26, starting from main `a8836af`.

## Verified baseline

- PRs #15 (connected email), #16 (profile photos), and #17 (scheduled sender) are merged. No open PRs at the start of this audit.
- Workspace type checks and all nine mailbox tests pass. Provider HTTP responses in those tests are mocked; this does not establish live Outlook readiness.
- `https://getknctd.com` responds over HTTPS and redirects to `https://www.getknctd.com/`, which serves the Biz Card application. Vercel confirms this domain belongs to the production bizcard project. OAuth domain cutover is prepared but not yet saved.
- Google connection and one scheduled send were previously confirmed. Repeat on the final TestFlight build.
- Microsoft has an existing KNCT registration supporting all Microsoft account users. The dashboard now lists delegated User.Read, Mail.Send, openid, email and offline_access. Production client credentials are saved and deployed; the Microsoft secret expires March 25, 2027. The old Vercel callback remains active. Registration is not equivalent to a working Outlook connection.
- The code has provider-specific OAuth, encrypted tokens, sender identity, queue processing, and profile-photo controls. No AI drafting or voice transcription implementation was found.

## Release gates

| # | Gate | Current status | Required evidence |
| --- | --- | --- | --- |
| 1 | Current code and deployment | Code verified; deployment identity pending | Match production release to a commit; record final mobile build |
| 2 | Domain | HTTPS and bizcard project association verified | Domain belongs to bizcard project, correct production deployment, email DNS preserved |
| 3 | URLs and redirects | Code prepared; authentication settings awaiting confirmation | Coordinated provider, Supabase, server, scheduler and mobile configuration; return to installed app |
| 4 | Gmail | Partial live proof | Tester access, connect/cancel/reconnect, token refresh and send from final build |
| 5 | Outlook | Credentials/permissions deployed; live tests pending | Delegated permissions, server credentials, callbacks; personal Outlook and Microsoft 365 live tests |
| 6 | Database and photos | Production verification pending | Required tables/RPCs, avatar_url, bucket and owner-only upload/delete policies |
| 7 | Onboarding | Device validation pending | New user creates card and connects either provider without developer setup |
| 8 | Meeting context | Implementation audit needed | Owner can save a short meeting note; decide whether voice capture belongs in beta |
| 9 | AI follow-up draft | Not implemented | Draft uses meeting context, owner reviews/controls sending, failures are clear |
| 10 | Scheduler | One Google send previously passed | Both providers; overdue jobs, cancellation, revoked access, duplicate prevention |
| 11 | Card/contact/photo flow | Device validation pending | QR, guest exchange, contact save, photo upload/replace/remove |
| 12 | Knct’d branding | Direction not finalized | Approved assets applied to app/public pages; preserve existing bundle ID and URL scheme |
| 13 | Privacy and support | Pending | Published policy and working support address; verify account deletion and provider disconnect |
| 14 | Real-device release QA | Pending | Full fresh-account flow and recovery paths for both providers |
| 15 | Apple signing/app record | Verify existing setup | Developer membership, App Store Connect record, matching bundle ID and distribution signing |
| 16 | Archive/upload | Pending | Processed build, required export-compliance answers |
| 17 | Internal TestFlight | Pending | Install exact uploaded build and repeat both provider flows |
| 18 | External TestFlight | Pending | Review information, access for review, beta approval and tester invitations |
| 19 | Feedback | Pending | 5–10 testers, crash/connection/send feedback, blocker triage |

## Domain cutover order

Use the final non-redirecting origin (currently `https://www.getknctd.com`) consistently. Do not change only the mobile URL or only an OAuth callback.

1. Verify domain/project association and live API routes. Keep existing Vercel URLs available.
2. Add the exact new Google and Microsoft callback URIs to the existing provider clients, retaining old callbacks during transition.
3. Preserve MAILBOX_ENCRYPTION_KEY and existing credentials. Update MAILBOX_APP_URL only after callback registration. Finish in-progress authorizations before cutover or have users restart them.
4. Redeploy and verify live connection flows. OAuth launch and callback must use the same host for browser-cookie validation.
5. Update the GitHub scheduler MAILBOX_APP_URL to the same origin; do not automatically dispatch a send as part of a configuration check.
6. Update EXPO_PUBLIC_WEB_URL in the release build. Preserve `bizcard://auth/callback` and `bizcard://email-connected` for installed-app returns.
7. Verify Supabase email links and allowed redirects, public card links, and login email sender separately. Mailbox sending credentials do not configure Supabase login emails.

## Provider setup blockers

Microsoft registration currently uses the old callback `/api/mailbox/callback/microsoft` on bizcard-nu.vercel.app. Delegated Mail.Send, openid, email, offline_access and User.Read are saved. No inbox-reading or application-wide mailbox permission is needed. Client credentials are stored only on the web server. Do not grant tenant-wide consent as a substitute for testing individual user consent.

The Entra dashboard also flags publisher verification for multitenant consent. Verify actual personal-account and work-account consent behavior; record any organization-admin approval requirement before inviting testers. Do not weaken tenant security policy to bypass it.

Google is currently configured as an external Testing application. Add beta testers and test expiration/reconnection behavior before invitations.

## Validation commands

From the repository root:

```sh
npm run typecheck
npm run test:mailbox --workspace=@biz-card/web
node --test tests/profile-photo-storage.test.mjs
npm run build
```

Automated checks do not replace final device tests or prove production settings are present. Record the tested commit/build and provider for each manual result. Send test emails only to explicitly selected test recipients with their consent.

## Domain change prepared (2026-09-26)

- Mobile default URL and onboarding link preview use `https://www.getknctd.com`; the local iPhone build environment has the same override. An already-installed release still needs rebuilding to update its embedded URL and QR links.
- New provider callbacks and Supabase web redirects are staged, awaiting authentication-setting confirmation. Server MAILBOX_APP_URL and GitHub scheduler still use the previous origin until that save succeeds.
- Production callback routes are reachable on www; unauthenticated checks correctly reject access. Live connect/send remains a separate device test.
