# iPhone prototype

Use the installed internal preview build, not Expo Go. The preview bundles the app and runs without Metro. The mobile callback is `bizcard://auth/callback`, registered by the `bizcard` scheme in `apps/mobile/app.json`.

## One-time setup

- Supabase project: `nhlyccirwpmsfgktgxix`. Add the exact `bizcard://auth/callback` URL under Authentication → URL Configuration → Redirect URLs. Leave the website Site URL intact.
- Keep the confirmation and magic-link templates using `{{ .ConfirmationURL }}`.
- Expo project: `@rossco1992/biz-card`, ID `71ffaec9-ff46-453e-b978-6493b29fb365`.
- The EAS `preview` environment needs `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_WEB_URL`. Use the public anon/publishable key, never a service-role key. These values are compiled into the app.
- Sign in to the Apple Developer team and register the iPhone for internal distribution. Handle Apple credentials and verification codes directly in the EAS prompts.

## Build and install

From `apps/mobile`, while on the prototype branch:

```sh
eas device:create
eas build --platform ios --profile preview
```

Register the iPhone when prompted, then open the successful build's installation link on that registered phone. Launch **Biz Card** from the home screen. No App Store submission or Vercel deployment is involved.

## Acceptance checks on the installed build

1. Request one fresh email on the iPhone; check spam if necessary. Its generated link must contain the mobile callback as `redirect_to`.
2. Open the newest email on the same iPhone. Confirm it opens Biz Card and completes sign-in.
3. For a new user, finish onboarding and open the card; for an existing user, confirm the saved card loads.
4. Close and reopen Biz Card and confirm the session persists.
5. Repeat sign-in with Biz Card initially closed and then with it in the background.
6. Open an expired/used link. Confirm a retry message appears rather than an endless spinner.
7. Disconnect networking during sign-in and confirm the callback offers a way back to sign-in.

Automated checks do not replace these device checks. Do not describe the prototype as verified until these pass. A new email must be requested from the installed app: a link requested from Expo Go will use a different callback and PKCE verifier.
