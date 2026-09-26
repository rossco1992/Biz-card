# Knct’d

The professional follow-up app. Domain: https://www.getknctd.com.

## Visual identity

A copper handshake on textured forest green represents the connection. The wordmark uses a high-contrast serif with “ct’” in copper. Warm ivory backgrounds and restrained green controls keep the interface calm and professional.

| Token | Hex | Purpose |
| --- | --- | --- |
| Ivory | #F7F2E7 | Page backgrounds |
| Paper | #FFFCF6 | Cards and inputs |
| Ink | #13252B | Primary text |
| Forest | #344F45 | Actions and active states |
| Copper | #925A38 | Accessible wordmark accent |
| Decorative copper | #BE8A63 | Decorative accents only |
| Muted | #646C65 | Supporting text |
| Line | #E1D9CC | Borders |
| Soft green | #E4E9E1 | Status surfaces |

Display typography: Georgia (serif fallback on Android). Body and controls: platform system sans serif. Keep QR codes dark on white. Never use decorative copper for small text on ivory.

## Assets

The icon is adapted from the owner's supplied reference using image generation. The native icon is an opaque 1024px square; operating systems apply their own masks. The shared wordmark is rendered as text to stay sharp and accessible. No new font downloads are required.

Mobile theme: apps/mobile/constants/theme.ts. Web theme: apps/web/app/globals.css. Brand components live in each app's components/brand.tsx.

## Release checklist

Merge and deploy the web app. Rebuild the native app to pick up its display name, splash screen, icon, and permission copy. For an existing generated iOS project, synchronize Expo configuration with `npx expo prebuild --platform ios --no-install` before building; review any local native changes first. Do not use `--clean` on a locally configured signing project.

Keep the existing bundle identifiers, `bizcard` deep-link scheme, Expo project ID, and package names. These are stable technical identifiers, not customer-facing branding.

External dashboards are separate: App Store Connect/TestFlight app name and screenshots, Google/Microsoft consent branding, and Supabase email templates/sender display names still need review before launch. Changing this repository does not update them. The current physical-device disk-image mounting issue also needs resolving before testing this native build on the owner's phone.
