-- Read-only verification after applying 0009_sms_followups.sql.
-- Safe to run repeatedly in Supabase SQL Editor.

select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'sms_followup_enabled'
  ) as profiles_sms_enabled,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'modes' and column_name = 'sms_enabled'
  ) as modes_sms_enabled,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'modes' and column_name = 'sms_body_template'
  ) as modes_sms_template,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'connections' and column_name = 'sms_consent_at'
  ) as connections_sms_consent,
  to_regclass('public.sms_senders') is not null as sms_senders_table,
  to_regprocedure('public.claim_sms_followups(integer)') is not null as sms_claim_function;

select
  status,
  count(*) as senders
from public.sms_senders
group by status
order by status;

select
  channel,
  status,
  count(*) as followups
from public.followups
group by channel, status
order by channel, status;
