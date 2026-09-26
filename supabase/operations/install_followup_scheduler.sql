-- Run as postgres only on production, after placing the existing Vercel
-- CRON_SECRET in Vault under the name knctd_followup_cron_secret.
-- This opt-in operation starts sending real due messages every minute.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists knctd_scheduler;
revoke all on schema knctd_scheduler from public, anon, authenticated;

create table if not exists knctd_scheduler.requests (
  request_id bigint primary key,
  requested_at timestamptz not null default now()
);
revoke all on knctd_scheduler.requests from public, anon, authenticated;

create or replace function knctd_scheduler.dispatch_followups()
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  bearer text;
  request_id bigint;
begin
  select decrypted_secret into bearer from vault.decrypted_secrets
    where name = 'knctd_followup_cron_secret';
  if bearer is null or length(bearer) < 32 then
    raise exception 'Follow-up scheduler secret is missing or invalid';
  end if;
  -- Fixed production destination prevents a configurable URL leaking the secret.
  select net.http_get(
    url := 'https://www.getknctd.com/api/jobs/followups',
    headers := jsonb_build_object('Authorization', 'Bearer ' || bearer),
    timeout_milliseconds := 65000
  ) into request_id;
  insert into knctd_scheduler.requests(request_id) values (request_id);
  delete from knctd_scheduler.requests where requested_at < now() - interval '7 days';
  return request_id;
end;
$$;
revoke all on function knctd_scheduler.dispatch_followups() from public, anon, authenticated;

-- Validate before activating. No HTTP request is issued by this block.
do $$ begin
  if not exists (select 1 from vault.decrypted_secrets
    where name = 'knctd_followup_cron_secret' and length(decrypted_secret) >= 32) then
    raise exception 'Store the production CRON_SECRET in Vault before installing';
  end if;
end $$;

-- Named schedule is updated in place when this script is rerun.
select cron.schedule('knctd-send-followups', '* * * * *',
  'select knctd_scheduler.dispatch_followups();');
commit;
