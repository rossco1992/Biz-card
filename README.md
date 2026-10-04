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

`apps/mobile/eas.json` includes development, internal preview, and production profiles. Production iOS releases use EAS rather than Xcode Cloud because `apps/mobile/ios` is generated and intentionally not committed.

The repository includes a manual **iOS TestFlight Release** GitHub Actions workflow. Configure the repository secret `EXPO_TOKEN`, keep the production `EXPO_PUBLIC_*` and RevenueCat iOS key in the EAS production environment, then run the workflow from `main`. It can build only or build and submit directly to TestFlight.

For a local release:

```bash
cd apps/mobile
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production --latest
```

Keep the existing iOS bundle identifier `com.bizcard.mobile` so releases continue targeting the same App Store Connect app. See `docs/eas-testflight-release.md` for the one-time credential setup and release procedure.

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


## Free / Pro subscriptions

KNCT uses a server-enforced Free/Pro entitlement model.

- **Free** — digital card, contact exchange, saved connections, and 5 automatic follow-ups per UTC calendar month.
- **Pro** — unlimited automatic follow-ups.
- **Target App Store / Play pricing** — $9.99 monthly or $79.99 annually.
- **Trial** — configure a 7-day introductory free trial on both subscription products in App Store Connect / Google Play. RevenueCat automatically uses the store's eligible introductory offer when the user purchases.
- **RevenueCat entitlement** — `pro`.
- **RevenueCat offering** — create a current/default offering containing monthly and annual packages.

Mobile builds need:

```bash
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
```

The web deployment needs:

```bash
REVENUECAT_WEBHOOK_AUTH=
KNCT_ADMIN_TOKEN=
```

Configure a RevenueCat webhook to:

```text
https://YOUR_DOMAIN/api/webhooks/revenuecat
```

and set its Authorization header to `Bearer <REVENUECAT_WEBHOOK_AUTH>`.

### Complimentary Pro

For founders, testers, advisors, or friends who should receive Pro without purchasing, grant access through the protected admin endpoint. Example:

```bash
curl -X POST https://YOUR_DOMAIN/api/admin/pro \
  -H "Authorization: Bearer $KNCT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"their-knct-slug","days":365,"note":"Founding tester"}'
```

For permanent access use `"lifetime": true` instead of `days`. Send `DELETE` to the same endpoint with `{"slug":"their-knct-slug"}` to revoke the complimentary grant.

On iOS the Pro screen also exposes Apple's native subscription offer-code redemption sheet. Create the actual offer codes in App Store Connect; purchases and redemptions sync back through RevenueCat.

### Billing source of truth

Store purchases are validated by RevenueCat and synced into `profile_entitlements`. The public connection API checks the entitlement server-side before scheduling each follow-up, so the Free limit cannot be bypassed by modifying the mobile client.
