-- Provider credentials are server-only. No policies/grants for application users.
create table public.mailboxes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  provider text not null check (provider in ('google', 'microsoft')),
  email text not null,
  refresh_token_encrypted text not null,
  status text not null default 'connected' check (status in ('connected', 'reconnect')),
  updated_at timestamptz not null default now()
);
create table public.mailbox_oauth_states (
  state_hash text primary key,
  launch_hash text unique,
  browser_hash text,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  platform text not null check (platform in ('web', 'mobile')),
  verifier_encrypted text not null,
  expires_at timestamptz not null,
  confirmation_hash text unique,
  pending_email text,
  pending_token_encrypted text,
  confirmed_mailbox_id uuid
);
alter table public.mailboxes enable row level security;
alter table public.mailbox_oauth_states enable row level security;
revoke all on public.mailboxes, public.mailbox_oauth_states from public, anon, authenticated;
grant all on public.mailboxes, public.mailbox_oauth_states to service_role;

-- Existing Resend schedules stay with Resend and its webhook. Never enqueue them again.
alter table public.followups add column delivery_provider text not null default 'resend'
  check (delivery_provider in ('resend', 'google', 'microsoft', 'unconnected'));
alter table public.followups add column mailbox_id uuid;

-- A claimed message is never automatically retried: a timeout might mean the provider
-- accepted it. One in-flight message per mailbox also serializes refresh-token rotation.
create function public.claim_mailbox_followups(batch_size integer default 10)
returns setof public.followups language plpgsql security definer set search_path = '' as $$
begin
  delete from public.mailbox_oauth_states where expires_at < now();
  update public.followups set status = 'failed', error = 'Delivery could not be confirmed. Check your Sent folder before sending again.', updated_at = now()
    where status = 'sending' and delivery_provider <> 'resend' and updated_at < now() - interval '15 minutes';
  return query
  with candidates as (
    select f.id from public.followups f
    where f.status = 'scheduled' and f.delivery_provider <> 'resend' and f.send_at <= now()
      and not exists (select 1 from public.followups busy where busy.profile_id = f.profile_id and busy.status = 'sending' and busy.delivery_provider <> 'resend')
      and f.id = (select oldest.id from public.followups oldest where oldest.profile_id = f.profile_id
        and oldest.status = 'scheduled' and oldest.delivery_provider <> 'resend' and oldest.send_at <= now()
        order by oldest.send_at, oldest.id limit 1)
    order by f.send_at, f.id limit greatest(1, least(batch_size, 20)) for update of f skip locked
  )
  update public.followups f set status = 'sending', updated_at = now()
    from candidates c where f.id = c.id returning f.*;
end;
$$;
revoke all on function public.claim_mailbox_followups(integer) from public, anon, authenticated;
grant execute on function public.claim_mailbox_followups(integer) to service_role;

-- Serialize finalize/disconnect against the owner's profile. A callback already exchanging
-- tokens cannot reconnect a mailbox after the owner disconnects it.
create function public.finish_mailbox_connection(p_confirmation_hash text, p_profile_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.mailbox_oauth_states; new_id uuid;
begin
  perform 1 from public.profiles where id = p_profile_id for update;
  select * into s from public.mailbox_oauth_states where confirmation_hash = p_confirmation_hash
    and profile_id = p_profile_id
    and expires_at > now() for update;
  if not found then raise exception 'Email connection expired'; end if;
  if s.confirmed_mailbox_id is not null then
    perform 1 from public.mailboxes where profile_id = p_profile_id and id = s.confirmed_mailbox_id;
    if not found then raise exception 'Email connection expired'; end if;
    return; -- Native browser callback and cold-start route may both confirm the same receipt.
  end if;
  if s.pending_email is null or s.pending_token_encrypted is null then raise exception 'Incomplete authorization'; end if;
  insert into public.mailboxes(profile_id,provider,email,refresh_token_encrypted)
    values(s.profile_id,s.provider,s.pending_email,s.pending_token_encrypted) returning id into new_id;
  update public.mailbox_oauth_states set confirmed_mailbox_id = new_id, pending_token_encrypted = null, pending_email = null,
    verifier_encrypted = '' where state_hash = s.state_hash;
  delete from public.mailbox_oauth_states where profile_id = s.profile_id and state_hash <> s.state_hash;
end;
$$;
create function public.disconnect_mailbox(p_profile_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profiles where id = p_profile_id for update;
  delete from public.mailbox_oauth_states where profile_id = p_profile_id;
  delete from public.mailboxes where profile_id = p_profile_id;
  update public.followups set status = 'cancelled', error = 'Email disconnected.', updated_at = now()
    where profile_id = p_profile_id and delivery_provider <> 'resend' and status = 'scheduled';
end;
$$;
revoke all on function public.finish_mailbox_connection(text,uuid), public.disconnect_mailbox(uuid) from public, anon, authenticated;
grant execute on function public.finish_mailbox_connection(text,uuid), public.disconnect_mailbox(uuid) to service_role;
