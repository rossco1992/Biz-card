# Biz Card

Biz Card is a mobile-first contact exchange and automated follow-up product.

The core loop is intentionally simple:

1. The card owner chooses an active mode such as Everyday or Event.
2. A new contact scans the owner's permanent QR code.
3. The contact shares their name, email, and optional phone number.
4. The contact downloads the owner's `.vcf` and adds it to their phone.
5. The system snapshots the active mode and schedules the matching follow-up.
6. A server-side worker sends the follow-up automatically.

## Stack

- Next.js + TypeScript
- Supabase for profiles, modes, connections, and follow-up state
- Resend for email delivery
- Vercel-compatible deployment

## Current V1 foundation

- Mobile owner dashboard with QR code
- Everyday/Event mode UX
- Public `/[slug]` contact-swap page
- Consent capture
- Dynamic native `.vcf` endpoint at `/api/vcard/[slug]`
- Connection API that snapshots the active mode
- Scheduled follow-up records
- Protected follow-up email worker
- Initial Supabase migration and row-level security policies
- Demo fallback so the front end can be previewed before credentials are configured

## Environment

Copy `.env.example` to `.env.local` and configure:

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
FOLLOWUP_FROM_EMAIL=
CRON_SECRET=
```

`FOLLOWUP_FROM_EMAIL` must be an address/domain verified with the email provider. Follow-ups use the card owner's actual email as the Reply-To address.

## Database

Run:

`supabase/migrations/0001_initial_schema.sql`

The public contact exchange writes through server-side APIs using the service-role key. The service-role key must never be exposed to the browser.

## Follow-up worker

`POST /api/cron/send-followups`

Send:

`Authorization: Bearer <CRON_SECRET>`

A scheduler will call this endpoint on a short interval in production.

## Next build slice

- Supabase Auth and onboarding
- Persist owner profile and active mode
- Mode/template editor
- Real connections dashboard
- Cancel/reschedule follow-up controls
- Deployment and end-to-end iPhone contact-save test
