# Production follow-up scheduler

GitHub's five-minute schedule was observed firing hours apart on September 26, 2026. Use Supabase Cron to call the existing authenticated production worker every minute. The worker claims due email and SMS jobs; it does not retry ambiguous sends or failed messages. No phone rebuild is required for scheduler changes.

## Activate once, as the app owner

1. Store the existing production Vercel `CRON_SECRET` in Supabase Vault as `knctd_followup_cron_secret`. Never commit the value or paste it into a saved SQL query. This is an app-wide setup, never an end-user task.
2. Run `supabase/operations/install_followup_scheduler.sql` as postgres in the production Supabase SQL editor. This enables pg_cron/pg_net, installs a private invoker function and request history, and activates the named one-minute job. It is intentionally an opt-in operation rather than a migration that could accidentally enable sending in staging.
3. After a minute, run `supabase/operations/check_followup_scheduler.sql`. Confirm both the cron execution and HTTP 200 response, including delivery counts. Observe a second automatic run before considering the timer verified.
4. Set GitHub repository variable `MAILBOX_SCHEDULER_ENABLED=false` to retire the unreliable timer only after the new timer is healthy. The existing manual workflow can be re-enabled temporarily for recovery. Overlapping calls use the existing atomic queue claim, but keeping one timer reduces unnecessary requests.

Each tick handles up to four due email jobs and four due SMS jobs, with at most one oldest due job per owner/channel. High-volume queues need a separate capacity review; this cadence is for the prototype. A due time means eligible for the next run, not a guaranteed delivery time. Provider delivery and spam filtering are separate from API acceptance.

## Troubleshooting

- Cron failures: inspect cron job history.
- HTTP 401: Vault value must match Vercel production CRON_SECRET.
- HTTP 503: inspect server/queue health before retrying.
- HTTP 200 with failed > 0: inspect message status, including reconnect instructions.
- HTTP 200 with sent > 0: the provider accepted one or more sends. The response includes separate `email` and `sms` counts.
- SMS is only claimed after the owner is Pro, automatic texting is enabled, and the sender is approved. A Twilio timeout/ambiguous send is failed for manual reconciliation and is never automatically retried.
- Never reschedule `sending` or failed rows without reconciling provider delivery first.

HTTP response records are retained briefly by pg_net; request IDs are kept for seven days. The private schema is not exposed to app users. Credentials are resolved from Vault at runtime, not embedded in cron job text. The destination is fixed to the production www domain.

## Pause / rollback

`select cron.alter_job((select jobid from cron.job where jobname = 'knctd-send-followups'), active := false);`

Then, if needed, re-enable the GitHub variable as a temporary fallback. Do not uninstall pg_cron, which could remove unrelated jobs.

References: https://supabase.com/docs/guides/cron and https://supabase.com/docs/guides/database/extensions/pg_net
