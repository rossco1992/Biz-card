# Automatic SMS follow-ups

KNCT owns the texting integration. End users do **not** create a Twilio account, copy API keys, or leave the KNCT app.

## Runtime model

1. A Pro user requests texting from Automations.
2. KNCT records a private `sms_senders` provisioning request.
3. After carrier/Twilio approval, KNCT provisions that user with a dedicated Twilio subaccount + Messaging Service + sender number and marks the sender approved.
4. The user enables automatic texting in KNCT.
5. A public-card visitor separately consents to the email follow-up and, optionally, to one introduction-related text. Supplying a phone number by itself never authorizes SMS.
6. The active mode may schedule email, SMS, or both.
7. The existing authenticated follow-up worker claims due jobs every minute.
8. SMS sends use the approved user's Messaging Service. Twilio's accepted Message SID is stored in `followups.provider_message_id`.

Twilio Messaging Services choose the actual sender from their sender pool. For U.S. application-to-person traffic, the sender must complete the applicable carrier registration before KNCT marks it approved.

## Production prerequisites

- Apply `supabase/migrations/0009_sms_followups.sql`.
- Run `supabase/operations/check_sms_followups.sql` and confirm all migration checks return true.
- Add server-only Vercel environment variables:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
- Keep the existing `CRON_SECRET` / Supabase scheduler enabled.
- Provision each approved KNCT sender into `sms_senders` using the protected admin endpoint until automated ISV provisioning is enabled.

Never expose Twilio credentials through `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`.

## Provision an approved sender

The protected endpoint is `POST /api/admin/sms` with `Authorization: Bearer <KNCT_ADMIN_TOKEN>`.

Approved sender payload:

```json
{
  "slug": "user-slug",
  "status": "approved",
  "phone_number": "+17325550123",
  "twilio_subaccount_sid": "AC...",
  "messaging_service_sid": "MG...",
  "phone_number_sid": "PN...",
  "brand_sid": "BN...",
  "campaign_sid": "QE...",
  "status_detail": "Approved for KNCT automatic introduction follow-ups."
}
```

Until approved, the KNCT app shows requested/pending state and will not schedule real SMS sends.

## Delivery guarantees

KNCT treats a successful Twilio Message create response as provider acceptance, not handset delivery. The Message SID is retained for reconciliation. A timeout or otherwise ambiguous provider attempt is marked failed and is never automatically retried; this prevents accidental duplicate texts.

The first SMS includes `Reply STOP to opt out.` automatically. Messaging Services should also have Twilio's standard opt-out handling enabled.

## Rollback

Turn off `profiles.sms_followup_enabled` for the affected profile or set the sender status to `suspended`. Existing scheduled SMS will be cancelled/failed when the worker next validates sender readiness; email remains independent.
