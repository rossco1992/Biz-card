-- SMS follow-ups share the existing scheduler while keeping each KNCT sender isolated.
-- Automatic SMS is Pro-only at the API layer and only schedules for approved senders.

alter table public.profiles
  add column if not exists sms_followup_enabled boolean not null default false;

alter table public.modes
  add column if not exists sms_enabled boolean not null default false,
  add column if not exists sms_body_template text;

create table if not exists public.sms_senders (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  status text not null default 'requested'
    check (status in ('requested', 'pending', 'approved', 'rejected', 'suspended')),
  phone_number text,
  twilio_subaccount_sid text unique,
  messaging_service_sid text unique,
  phone_number_sid text unique,
  brand_sid text,
  campaign_sid text,
  status_detail text,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.sms_senders enable row level security;
revoke all on public.sms_senders from public, anon, authenticated;
grant all on public.sms_senders to service_role;

-- Existing rows are email. A connection can now have one email and one SMS follow-up.
alter table public.followups drop constraint if exists followups_connection_id_key;
alter table public.followups add column if not exists channel text not null default 'email';
alter table public.followups add column if not exists recipient_phone text;
alter table public.followups alter column recipient_email drop not null;

alter table public.followups drop constraint if exists followups_channel_check;
alter table public.followups
  add constraint followups_channel_check check (channel in ('email', 'sms'));

alter table public.followups drop constraint if exists followups_delivery_provider_check;
alter table public.followups
  add constraint followups_delivery_provider_check
  check (delivery_provider in ('resend', 'google', 'microsoft', 'unconnected', 'twilio'));

alter table public.followups drop constraint if exists followups_recipient_for_channel_check;
alter table public.followups
  add constraint followups_recipient_for_channel_check check (
    (channel = 'email' and recipient_email is not null)
    or (channel = 'sms' and recipient_phone is not null)
  );

create unique index if not exists followups_connection_channel_unique
  on public.followups (connection_id, channel);
create index if not exists followups_channel_due_idx
  on public.followups (channel, status, send_at);

-- Keep mailbox claims strictly email-only now that Twilio is another delivery provider.
create or replace function public.claim_mailbox_followups(batch_size integer default 10)
returns setof public.followups language plpgsql security definer set search_path = '' as $$
begin
  delete from public.mailbox_oauth_states where expires_at < now();
  update public.followups
    set status = 'failed',
        error = 'Delivery could not be confirmed. Check your Sent folder before sending again.',
        updated_at = now()
    where status = 'sending'
      and channel = 'email'
      and delivery_provider in ('google', 'microsoft')
      and updated_at < now() - interval '15 minutes';

  return query
  with candidates as (
    select f.id
    from public.followups f
    where f.channel = 'email'
      and f.status = 'scheduled'
      and f.delivery_provider in ('google', 'microsoft')
      and f.send_at <= now()
      and not exists (
        select 1 from public.followups busy
        where busy.profile_id = f.profile_id
          and busy.channel = 'email'
          and busy.status = 'sending'
          and busy.delivery_provider in ('google', 'microsoft')
      )
      and f.id = (
        select oldest.id
        from public.followups oldest
        where oldest.profile_id = f.profile_id
          and oldest.channel = 'email'
          and oldest.status = 'scheduled'
          and oldest.delivery_provider in ('google', 'microsoft')
          and oldest.send_at <= now()
        order by oldest.send_at, oldest.id
        limit 1
      )
    order by f.send_at, f.id
    limit greatest(1, least(batch_size, 20))
    for update of f skip locked
  )
  update public.followups f
    set status = 'sending', updated_at = now()
    from candidates c
    where f.id = c.id
  returning f.*;
end;
$$;

revoke all on function public.claim_mailbox_followups(integer) from public, anon, authenticated;
grant execute on function public.claim_mailbox_followups(integer) to service_role;

create or replace function public.claim_sms_followups(batch_size integer default 10)
returns setof public.followups language plpgsql security definer set search_path = '' as $$
begin
  update public.followups
    set status = 'failed',
        error = 'Text delivery could not be confirmed. Review Twilio delivery logs before sending again.',
        updated_at = now()
    where status = 'sending'
      and channel = 'sms'
      and delivery_provider = 'twilio'
      and updated_at < now() - interval '15 minutes';

  return query
  with candidates as (
    select f.id
    from public.followups f
    where f.channel = 'sms'
      and f.status = 'scheduled'
      and f.delivery_provider = 'twilio'
      and f.send_at <= now()
      and not exists (
        select 1 from public.followups busy
        where busy.profile_id = f.profile_id
          and busy.channel = 'sms'
          and busy.status = 'sending'
      )
      and f.id = (
        select oldest.id
        from public.followups oldest
        where oldest.profile_id = f.profile_id
          and oldest.channel = 'sms'
          and oldest.status = 'scheduled'
          and oldest.delivery_provider = 'twilio'
          and oldest.send_at <= now()
        order by oldest.send_at, oldest.id
        limit 1
      )
    order by f.send_at, f.id
    limit greatest(1, least(batch_size, 20))
    for update of f skip locked
  )
  update public.followups f
    set status = 'sending', updated_at = now()
    from candidates c
    where f.id = c.id
  returning f.*;
end;
$$;

revoke all on function public.claim_sms_followups(integer) from public, anon, authenticated;
grant execute on function public.claim_sms_followups(integer) to service_role;

-- Disconnecting email must never cancel text jobs.
create or replace function public.disconnect_mailbox(p_profile_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profiles where id = p_profile_id for update;
  delete from public.mailbox_oauth_states where profile_id = p_profile_id;
  delete from public.mailboxes where profile_id = p_profile_id;
  update public.followups
    set status = 'cancelled', error = 'Email disconnected.', updated_at = now()
    where profile_id = p_profile_id
      and channel = 'email'
      and delivery_provider in ('google', 'microsoft', 'unconnected')
      and status = 'scheduled';
end;
$$;

revoke all on function public.disconnect_mailbox(uuid) from public, anon, authenticated;
grant execute on function public.disconnect_mailbox(uuid) to service_role;
