-- Device text reminders keep the actual SMS/iMessage send on the member's phone.
-- The scheduler only delivers a push notification; the member confirms Send in Messages.

alter table public.followups
  add column if not exists reminded_at timestamptz;

alter table public.followups drop constraint if exists followups_delivery_provider_check;
alter table public.followups
  add constraint followups_delivery_provider_check
  check (delivery_provider in ('resend', 'google', 'microsoft', 'unconnected', 'twilio', 'device'));

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_devices_profile_active_idx
  on public.push_devices (profile_id, active);

alter table public.push_devices enable row level security;
revoke all on public.push_devices from public, anon, authenticated;
grant all on public.push_devices to service_role;

create index if not exists followups_device_sms_due_idx
  on public.followups (send_at, id)
  where channel = 'sms'
    and delivery_provider = 'device'
    and status = 'scheduled'
    and reminded_at is null;

create or replace function public.claim_device_sms_reminders(batch_size integer default 10)
returns setof public.followups language plpgsql security definer set search_path = '' as $$
begin
  return query
  with candidates as (
    select f.id
    from public.followups f
    where f.channel = 'sms'
      and f.delivery_provider = 'device'
      and f.status = 'scheduled'
      and f.send_at <= now()
      and f.reminded_at is null
    order by f.send_at, f.id
    limit greatest(1, least(batch_size, 20))
    for update of f skip locked
  )
  update public.followups f
    set reminded_at = now(), updated_at = now()
    from candidates c
    where f.id = c.id
  returning f.*;
end;
$$;

revoke all on function public.claim_device_sms_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_device_sms_reminders(integer) to service_role;
