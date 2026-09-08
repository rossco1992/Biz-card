# Biz Card

Biz Card is a mobile-first contact exchange and automatic follow-up product.

## Pilot flow

1. Card owner signs in with an email magic link.
2. One-time onboarding creates their public card plus Everyday and Event modes.
3. Owner chooses the active mode and shows one permanent QR code.
4. A new contact scans, shares name/email/phone, and consents to one follow-up.
5. The contact downloads the owner's `.vcf` and saves it with the native phone contact flow.
6. Biz Card snapshots the active mode, stores the connection, and schedules the personalized follow-up directly with Resend.
7. Resend webhooks update the follow-up status in the owner's Connections list.

## Stack

- Next.js + TypeScript
- Supabase Auth + Postgres
- Resend scheduled email + webhooks
- Vercel-compatible deployment

## Environment

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
FOLLOWUP_FROM_EMAIL=
NEXT_PUBLIC_APP_URL=
```

`FOLLOWUP_FROM_EMAIL` must be on a domain verified in Resend. Messages use the card owner's email as `Reply-To` so replies go directly to the person who made the connection.

## Supabase

Run these migrations in order:

```text
supabase/migrations/0001_initial_schema.sql
supabase/migrations/0002_owner_onboarding.sql
```

Enable email auth in Supabase. Add the deployed site URL as an allowed auth redirect URL so magic-link sign in returns to the app.

## Resend

The app schedules each follow-up with Resend as soon as the contact swap is submitted. This means there is no polling job or cron worker to maintain.

Create a webhook pointing to:

```text
https://YOUR_DOMAIN/api/webhooks/resend
```

Subscribe to at least `email.sent`, `email.delivered`, and `email.bounced`, then put the webhook signing secret in `RESEND_WEBHOOK_SECRET`.

For the pilot, follow-up delays are limited to 72 hours because the scheduled-email API is the simplest reliable way to support per-user messages, per-mode timing, and future cancellation without another scheduler.

## What the tester can do

- Sign in without a password
- Create their own card
- Set name/company/title/email/phone/website
- Toggle Everyday vs Event mode
- Rename the Event mode for a specific conference
- Edit subject, message, and delay
- Pause automatic follow-up
- Show a permanent QR code
- Receive real contact submissions
- Let the other person save a native `.vcf`
- See recent connections and follow-up status

## Before inviting the first tester

- Apply both Supabase migrations
- Configure the Supabase auth redirect URL
- Verify the sending domain in Resend
- Add all environment variables in Vercel
- Register the Resend webhook
- Perform one end-to-end iPhone test using a real email address
