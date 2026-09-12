# Biz Card

Biz Card is a native-first contact exchange and automatic follow-up product. Card owners use the Expo app on iOS or Android. People scanning a card land on a fast public web page and do not need an account or app.

## Product surfaces

- **Native app (`apps/mobile`)** — owner sign-in, onboarding, QR card, mode switching, connections, automations, and settings.
- **Web app (`apps/web`)** — web admin fallback, public card pages, contact capture, vCard downloads, and server-side Resend integration.
- **Shared packages (`packages/*`)** — Supabase schema types, client/query helpers, and product logic used by both clients.

```text
apps/
  mobile/       Expo + React Native + Expo Router
  web/          Next.js admin, public pages, and API routes
packages/
  core/         URLs, slugs, templates, and shared defaults
  supabase/     Typed Supabase client and owner workspace query
  types/        Database and product contracts
supabase/
  migrations/   Existing database schema and owner policies
```

## What works in the native first pass

- Passwordless email authentication with mobile deep-link return
- Three-step first-run card setup
- Permanent QR pointing to the existing public web card
- Native share sheet and in-app card preview
- Fast active-mode switching
- Searchable, refreshable connections with delivery status
- Enable/pause automatic follow-ups
- Create and edit unlimited follow-up modes
- Profile editing and sign-out
- Loading, empty, success, and error states

The existing public contact form, `.vcf` download, Supabase storage, Resend scheduling, and Resend webhook status updates remain in the web app.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- A Supabase project with the migrations in `supabase/migrations` applied
- Resend and Vercel for production web follow-ups
- Xcode for the iOS simulator or Android Studio for the Android emulator

## Install

From the repository root:

```bash
npm install
```

The root is an npm workspace. Do not install dependencies separately in each app.

## Native app setup

Create `apps/mobile/.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
EXPO_PUBLIC_WEB_URL=https://bizcard-nu.vercel.app
```

Start the app:

```bash
npm run dev:mobile
npm run ios
npm run android
```

For production-like authentication, use an Expo development build. Add this redirect to the Supabase Auth URL allow list:

```text
bizcard://auth/callback
```

The app uses PKCE, stores its session in native async storage, refreshes credentials while active, and handles both cold-start and already-open deep links.

### EAS / TestFlight

`apps/mobile/eas.json` includes development, internal preview, and production profiles. Before the first store build, replace the placeholder iOS bundle identifier and Android package in `apps/mobile/app.json` if those identifiers are not available, then run:

```bash
cd apps/mobile
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

Configure the three `EXPO_PUBLIC_*` values as EAS environment variables for preview and production builds.

## Web app setup

Create `apps/web/.env.local` (or configure the same values in Vercel):

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
FOLLOWUP_FROM_EMAIL=
NEXT_PUBLIC_APP_URL=
```

`FOLLOWUP_FROM_EMAIL` must use a domain verified in Resend. Replies use the card owner's email as `Reply-To`.

Run the web app:

```bash
npm run dev:web
```

The root `vercel.json` keeps the existing Vercel project building the Next.js workspace and serving `apps/web/.next`.

## Supabase and Resend

Apply the migrations in order:

```text
supabase/migrations/0001_initial_schema.sql
supabase/migrations/0002_owner_onboarding.sql
```

Enable email auth. Add both the deployed web URL and `bizcard://auth/callback` to allowed auth redirects.

Point the Resend webhook at:

```text
https://YOUR_DOMAIN/api/webhooks/resend
```

Subscribe to `email.sent`, `email.delivered`, and `email.bounced`. Follow-up delays are capped at 72 hours to match the current direct Resend scheduling approach.

## Checks

```bash
npm run typecheck
npm run build
```

Before inviting testers, complete one real-device flow: sign in, create a card, switch modes, scan the QR from a second phone, submit contact details, save the vCard, and confirm the scheduled follow-up appears in Connections.
