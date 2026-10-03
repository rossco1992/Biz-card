-- Security hardening for public intake and profile tenant boundaries.

-- active_mode_id must never reference another owner's mode. The original FK only
-- enforced existence, while the application reads the active mode with server privileges.
update public.profiles p
set active_mode_id = null, updated_at = now()
where p.active_mode_id is not null
  and not exists (
    select 1
    from public.modes m
    where m.id = p.active_mode_id
      and m.profile_id = p.id
  );

create or replace function public.ensure_active_mode_owner()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.active_mode_id is not null and not exists (
    select 1
    from public.modes m
    where m.id = new.active_mode_id
      and m.profile_id = new.id
  ) then
    raise exception 'Active mode must belong to the same profile';
  end if;
  return new;
end;
$function$;

drop trigger if exists profiles_active_mode_owner on public.profiles;
create trigger profiles_active_mode_owner
before insert or update of active_mode_id on public.profiles
for each row execute function public.ensure_active_mode_owner();

-- Public connection submissions use a server-only fixed-window limiter. Only a
-- SHA-256 digest of the rate-limit key is stored; raw client IPs are never saved.
create table if not exists public.public_connection_rate_limits (
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now(),
  primary key (key_hash, window_start)
);

create index if not exists public_connection_rate_limits_window_idx
  on public.public_connection_rate_limits (window_start);

alter table public.public_connection_rate_limits enable row level security;
revoke all on public.public_connection_rate_limits from public, anon, authenticated;
grant all on public.public_connection_rate_limits to service_role;

create or replace function public.consume_public_connection_rate(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_window_start timestamptz;
  v_attempts integer;
begin
  if p_key_hash !~ '^[a-f0-9]{64}$'
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit parameters';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.public_connection_rate_limits (key_hash, window_start, attempts, updated_at)
  values (p_key_hash, v_window_start, 1, now())
  on conflict (key_hash, window_start)
  do update set
    attempts = public.public_connection_rate_limits.attempts + 1,
    updated_at = now()
  returning attempts into v_attempts;

  delete from public.public_connection_rate_limits
  where window_start < now() - interval '2 days';

  return v_attempts <= p_limit;
end;
$function$;

revoke all on function public.consume_public_connection_rate(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_public_connection_rate(text, integer, integer)
  to service_role;


-- Bound user-managed content at the database boundary. NOT VALID preserves any
-- legacy rows while enforcing the limits for all new or modified rows.
alter table public.profiles
  add constraint profiles_public_fields_size_check check (
    length(slug) <= 80
    and length(full_name) <= 200
    and length(company) <= 200
    and length(title) <= 200
    and length(email) <= 254
    and coalesce(length(phone), 0) <= 40
    and coalesce(length(website), 0) <= 2048
    and length(email_signature) <= 10000
    and coalesce(length(email_signature_html), 0) <= 120000
  ) not valid;

alter table public.modes
  add constraint modes_content_size_check check (
    length(name) <= 100
    and length(subject_template) <= 500
    and length(body_template) <= 20000
    and coalesce(length(sms_body_template), 0) <= 4000
  ) not valid;

alter table public.events
  add constraint events_content_size_check check (
    length(name) <= 200
    and length(location) <= 300
  ) not valid;
