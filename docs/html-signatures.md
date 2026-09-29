# HTML signature import

Settings → Email signature → Import HTML signature accepts UTF-8 .html/.htm files up to 100 KB. The authenticated server sanitizes the file before preview; Use this signature saves both the sanitized HTML and a plain-text fallback. Cancel does not save. Saving the plain-text signature clears the rich version.

Supports email-style tables, basic inline formatting, links, and publicly hosted HTTPS images. Scripts, event handlers, forms, frames, embedded stylesheets, and unsafe URL schemes are removed. Local, cid, and data images are not imported. Outlook exports with a companion images folder must use hosted HTTPS image URLs instead. Rendering can differ between email clients.

Newly scheduled follow-ups snapshot both formats. The mode's Include my signature toggle still controls inclusion. Gmail sends multipart/alternative; Outlook sends HTML when present. Previously scheduled plain-text messages retain their original contents. Sanitization is also applied at scheduling and sending, so direct database edits cannot bypass it.

Rollout:
1. Apply supabase/migrations/0007_html_signatures.sql before deploying the web changes.
2. Deploy the web backend with /api/signature and updated scheduling/delivery.
3. Refresh iOS pods for the new Expo document picker and React Native WebView dependencies. Keep the existing native workspace and signing settings.
4. Include the mobile changes in the next planned archive; use the production EXPO_PUBLIC_WEB_URL.
5. On a device, import a real signature, cancel once to verify no save, then import/save and reopen the preview. Send a newly scheduled follow-up to Gmail and Outlook. Confirm logo, links, formatting, and the Include my signature toggle.

Validation: mobile/web TypeScript, email-signature.test.mjs, and existing mailbox.test.mjs. Automated tests do not replace the device picker and real inbox check. No deployment, production migration, or archive is performed by implementing this change.
