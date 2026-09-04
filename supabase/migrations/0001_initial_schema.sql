create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  full_name text not null,
  company text not null default '',
  title text not null default '',
  email text not null,
  phone text,
  website text,
  followup_enabled boolean not null default true,
  active_mode_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.modes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('everyday', 'event')),
  delay_hours integer not null default 24 check (delay_hours between 1 and 336),
  subject_template text not null,
  body_template text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_active_mode_fk
  foreign key (active_mode_id) references public.modes(id) on delete set null;

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  mode_id uuid references public.modes(id) on delete set null,
  first_name text not null,
  last_name text,
  email text not null,
  phone text,
  consent_at timestamptz not null,
  mode_name_snapshot text,
  created_at timestamptz not null default now()
);

create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique references public.connections(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  mode_id uuid references public.modes(id) on delete set null,
  recipient_email text not null,
  send_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  subject_snapshot text not null,
  body_snapshot text not null,
  sent_at timestamptz,
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists followups_due_idx on public.followups (status, send_at);
create index if not exists connections_profile_created_idx on public.connections (profile_id, created_at desc);
create index if not exists modes_profile_idx on public.modes (profile_id);

alter table public.profiles enable row level security;
alter table public.modes enable row level security;
alter table public.connections enable row level security;
alter table public.followups enable row level security;

create policy "owners can read own profile"
on public.profiles for select
using (auth.uid() = user_id);

create policy "owners can update own profile"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "owners can manage own modes"
on public.modes for all
using (profile_id in (select id from public.profiles where user_id = auth.uid()))
with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

create policy "owners can read own connections"
on public.connections for select
using (profile_id in (select id from public.profiles where user_id = auth.uid()));

create policy "owners can read own followups"
on public.followups for select
using (profile_id in (select id from public.profiles where user_id = auth.uid()));
