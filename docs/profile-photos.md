# Profile photos

Owners choose, replace, or remove a photo in mobile Settings. The photo appears on My Card, the public card header, and the contact-swap completion card. Initials remain when no photo is set or the image fails to load. Choosing a photo immediately saves it independently of the contact-details form.

## Rollout

1. Apply `supabase/migrations/0004_profile_photos.sql` once before deploying this branch. It adds a nullable profile field and a public JPEG storage bucket with a 2 MB limit. Existing profiles keep their initials. Public photo downloads are intentional: the app explains this before selection. Authenticated upload and deletion are restricted to each user's own folder.
2. Deploy the web/API build after the migration. The public profile query requires the new column.
3. Rebuild/install the iPhone app with Xcode/Expo because this change adds native image-picker and image-manipulator modules. Updating JavaScript alone in an older installed build is insufficient. Run `npx expo run:ios --device --configuration Release` from `apps/mobile` in this branch with the existing environment and signing setup.

The system photo picker selects an image; the app crops/resizes and re-encodes it to a 512px square JPEG before uploading. Each replacement uses a fresh URL to avoid stale image caches. The previous managed image is deleted only after the profile update succeeds. Failed cleanup can leave an unused object; it does not remove the selected photo. Removal does not retract copies a visitor has already downloaded or cached.

## Verification

- `npm run typecheck`
- `node --test tests/profile-photo-storage.test.mjs` checks owner/cross-owner storage policies in PostgreSQL (PGlite). Actual Storage MIME/size enforcement requires the live service.
- `npm run build --workspace=@biz-card/web`
- From mobile: `npx expo export --platform ios --output-dir /tmp/bizcard-profile-photo-ios`
- On a rebuilt iPhone: select/crop a photo, cancel selection, replace it, remove it, and try an offline upload. Confirm public header and successful contact swap use the same image, and existing contact edits survive a photo update.

Device picker interaction and production migration are not covered by the automated checks. This change does not embed photos in downloaded vCards.
