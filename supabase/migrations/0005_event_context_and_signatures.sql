-- Event context + reusable email signatures for KNCT follow-ups.

alter table public.profiles
  add column email_signature text not null default '';

alter table public.modes
  add column include_signature boolean not null default true;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  location text not null check (length(trim(location)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_profile_idx on public.events (profile_id, created_at desc);

alter table public.events enable row level security;
grant select, insert, update, delete on public.events to authenticated;

create policy "owners can manage own events"
on public.events for all
using (profile_id in (select id from public.profiles where user_id = auth.uid()))
with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

alter table public.profiles
  add column active_event_id uuid;

alter table public.profiles
  add constraint profiles_active_event_fk
  foreign key (active_event_id) references public.events(id) on delete set null;

create function public.ensure_active_event_owner()
returns trigger language plpgsql set search_path = '' as $
begin
  if new.active_event_id is not null and not exists (
    select 1 from public.events e where e.id = new.active_event_id and e.profile_id = new.id
  ) then
    raise exception 'Active event must belong to the same profile';
  end if;
  return new;
end;
$;

create trigger profiles_active_event_owner
before insert or update of active_event_id on public.profiles
for each row execute function public.ensure_active_event_owner();

alter table public.connections
  add column event_id uuid references public.events(id) on delete set null,
  add column event_name_snapshot text,
  add column event_location_snapshot text;

create index connections_event_idx on public.connections (event_id);

-- Preserve the event someone actually met at even if the owner later edits or deletes it.
-- Existing generic event modes are upgraded only when they still match the untouched defaults.
update public.modes
set
  subject_template = '{{my_first_name}} from {{event_name}} — great meeting you',
  body_template = 'Hey {{first_name}} — {{my_first_name}} here. It was great meeting you at {{event_context}}. I wanted to follow up while our conversation was still fresh. Would love to stay connected.',
  updated_at = now()
where kind = 'event'
  and subject_template = 'Great meeting you at the event'
  and body_template = 'Hey {{first_name}} — it was great meeting you at the event. I wanted to follow up while our conversation was still fresh. If you''d like to keep talking, happy to find some time.';
