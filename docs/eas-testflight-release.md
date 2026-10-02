# iOS TestFlight releases with EAS

KNCT uses Expo's generated-native-project workflow. The generated `apps/mobile/ios` directory is intentionally ignored and should not be committed.

Do **not** use the Xcode Cloud archive workflow that points at `apps/mobile/ios/BizCard.xcworkspace`. A clean Git checkout does not contain that workspace, so Xcode Cloud cannot archive it.

## One-time setup

1. Create an Expo access token for the Expo account that owns project `@rossco1992/biz-card`.
2. In GitHub, open **Settings → Secrets and variables → Actions**.
3. Add a repository secret named `EXPO_TOKEN`.
4. In EAS, make sure the production environment contains:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_WEB_URL`
   - `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
5. Make sure EAS has valid Apple distribution credentials for bundle ID `com.bizcard.mobile`.
6. For automatic TestFlight submission, make sure the Expo/EAS project is connected to the existing App Store Connect app and has submission credentials configured.

The repository never stores Expo tokens, Apple credentials, Supabase secrets, RevenueCat private keys, or App Store Connect API keys.

## Release from GitHub

1. Merge the release changes into `main`.
2. Open **GitHub → Actions → iOS TestFlight Release**.
3. Choose **Run workflow** on `main`.
4. Leave **Submit the successful EAS build to TestFlight** enabled to build and submit in one run.
5. Disable that option if you only want an EAS production build without submitting it.

The workflow:

- installs the monorepo from the root lockfile,
- runs TypeScript checks,
- runs the mobile sign-in regression tests,
- authenticates to Expo with `EXPO_TOKEN`,
- runs the EAS `production` iOS build from `apps/mobile`,
- optionally submits the newly completed production build to TestFlight.

## If the first non-interactive build cannot find Apple credentials

Run the production build once from a trusted local terminal so EAS can finish the interactive Apple credential setup:

```bash
cd apps/mobile
npx eas-cli build --platform ios --profile production
```

After those credentials are stored with EAS, rerun the GitHub workflow.

## Why this replaces Xcode Cloud

The Expo app uses Continuous Native Generation: `ios/` is generated from `app.json` and the installed Expo/native packages. EAS generates that native project during the remote build. Xcode Cloud previously tried to open a workspace that is not present in the Git repository, which caused the archive to fail before compilation.
