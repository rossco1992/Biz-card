-- Convert the reminder infrastructure introduced in 0012 to native Apple Push Notification service tokens.
-- This migration is intentionally additive/migration-safe because 0012 may already be applied in production.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'push_devices'
      and column_name = 'expo_push_token'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'push_devices'
      and column_name = 'device_token'
  ) then
    alter table public.push_devices rename column expo_push_token to device_token;
  end if;
end $$;

alter table public.push_devices
  add column if not exists provider text not null default 'apns',
  add column if not exists environment text not null default 'production';

alter table public.push_devices drop constraint if exists push_devices_provider_check;
alter table public.push_devices
  add constraint push_devices_provider_check
  check (provider in ('apns'));

alter table public.push_devices drop constraint if exists push_devices_environment_check;
alter table public.push_devices
  add constraint push_devices_environment_check
  check (environment in ('development', 'production'));

-- 0012 stored a different token format. No released native APNs client should rely on
-- those rows, so deactivate them rather than deleting history or guessing that they
-- are valid APNs tokens. A real device re-registers and reactivates its APNs token.
update public.push_devices
set active = false,
    updated_at = now()
where provider = 'apns';

-- APNs device tokens are opaque and Apple explicitly warns not to hard-code their size.
-- The app serializes the bytes as lowercase hexadecimal before registration.
alter table public.push_devices drop constraint if exists push_devices_device_token_format_check;
alter table public.push_devices
  add constraint push_devices_device_token_format_check
  check (device_token ~ '^[0-9A-Fa-f]+$' and length(device_token) between 16 and 512);

create index if not exists push_devices_profile_provider_active_idx
  on public.push_devices (profile_id, provider, active);

-- Keep the 0012 queue function and followups.reminded_at column. They are provider-
-- agnostic and remain correct for native APNs reminders.
