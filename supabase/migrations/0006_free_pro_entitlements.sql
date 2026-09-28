-- KNCT Free/Pro access, monthly follow-up limits, and complimentary Pro grants.

create table public.profile_entitlements (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  revenuecat_status text not null default 'inactive'
    check (revenuecat_status in ('inactive', 'trialing', 'active', 'cancelled', 'billing_issue', 'expired', 'refunded')),
  revenuecat_expires_at timestamptz,
  revenuecat_product_id text,
  revenuecat_provider text,
  promotion_expires_at timestamptz,
  promotion_label text,
  admin_lifetime boolean not null default false,
  admin_expires_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profile_entitlements (profile_id)
select id from public.profiles
on conflict (profile_id) do nothing;

create function public.ensure_profile_entitlement()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  insert into public.profile_entitlements (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$function$;

create trigger profiles_ensure_entitlement
after insert on public.profiles
for each row execute function public.ensure_profile_entitlement();

alter table public.profile_entitlements enable row level security;
grant select on public.profile_entitlements to authenticated;

create policy "owners can read own entitlement"
on public.profile_entitlements for select
to authenticated
using (profile_id in (select id from public.profiles where user_id = auth.uid()));

create table public.followup_usage (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  period_start date not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, period_start)
);

alter table public.followup_usage enable row level security;
grant select on public.followup_usage to authenticated;

create policy "owners can read own followup usage"
on public.followup_usage for select
to authenticated
using (profile_id in (select id from public.profiles where user_id = auth.uid()));

create or replace function public.profile_has_pro(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((
    select
      e.admin_lifetime
      or (e.admin_expires_at is not null and e.admin_expires_at > now())
      or (e.promotion_expires_at is not null and e.promotion_expires_at > now())
      or (
        e.revenuecat_status in ('trialing', 'active', 'cancelled', 'billing_issue')
        and e.revenuecat_expires_at is not null
        and e.revenuecat_expires_at > now()
      )
    from public.profile_entitlements e
    where e.profile_id = p_profile_id
  ), false);
$function$;

revoke all on function public.profile_has_pro(uuid) from public, anon, authenticated;
grant execute on function public.profile_has_pro(uuid) to service_role;

create or replace function public.consume_followup_allowance(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_period date := date_trunc('month', timezone('UTC', now()))::date;
  v_used integer;
begin
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Profile not found';
  end if;

  if public.profile_has_pro(p_profile_id) then
    return jsonb_build_object('allowed', true, 'plan', 'pro', 'used', null, 'limit', null);
  end if;

  insert into public.followup_usage (profile_id, period_start, used)
  values (p_profile_id, v_period, 0)
  on conflict (profile_id, period_start) do nothing;

  update public.followup_usage
  set used = used + 1, updated_at = now()
  where profile_id = p_profile_id
    and period_start = v_period
    and used < 5
  returning used into v_used;

  if v_used is null then
    select used into v_used
    from public.followup_usage
    where profile_id = p_profile_id and period_start = v_period;

    return jsonb_build_object('allowed', false, 'plan', 'free', 'used', coalesce(v_used, 5), 'limit', 5);
  end if;

  return jsonb_build_object('allowed', true, 'plan', 'free', 'used', v_used, 'limit', 5);
end;
$function$;

revoke all on function public.consume_followup_allowance(uuid) from public, anon, authenticated;
grant execute on function public.consume_followup_allowance(uuid) to service_role;

create or replace function public.my_subscription_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_profile_id uuid;
  v_entitlement public.profile_entitlements%rowtype;
  v_period date := date_trunc('month', timezone('UTC', now()))::date;
  v_used integer := 0;
  v_pro boolean := false;
  v_source text := 'free';
  v_expires_at timestamptz;
begin
  select id into v_profile_id from public.profiles where user_id = auth.uid();
  if v_profile_id is null then
    return jsonb_build_object('plan', 'free', 'source', 'free', 'used', 0, 'limit', 5);
  end if;

  select * into v_entitlement from public.profile_entitlements where profile_id = v_profile_id;

  if v_entitlement.admin_lifetime then
    v_pro := true;
    v_source := 'admin';
  elsif v_entitlement.admin_expires_at is not null and v_entitlement.admin_expires_at > now() then
    v_pro := true;
    v_source := 'admin';
    v_expires_at := v_entitlement.admin_expires_at;
  elsif v_entitlement.promotion_expires_at is not null and v_entitlement.promotion_expires_at > now() then
    v_pro := true;
    v_source := 'promotion';
    v_expires_at := v_entitlement.promotion_expires_at;
  elsif v_entitlement.revenuecat_status in ('trialing', 'active', 'cancelled', 'billing_issue')
    and v_entitlement.revenuecat_expires_at is not null
    and v_entitlement.revenuecat_expires_at > now() then
    v_pro := true;
    v_source := 'revenuecat';
    v_expires_at := v_entitlement.revenuecat_expires_at;
  end if;

  select used into v_used
  from public.followup_usage
  where profile_id = v_profile_id and period_start = v_period;

  if v_pro then
    return jsonb_build_object(
      'plan', 'pro',
      'source', v_source,
      'expires_at', v_expires_at,
      'revenuecat_status', v_entitlement.revenuecat_status,
      'product_id', v_entitlement.revenuecat_product_id,
      'used', coalesce(v_used, 0),
      'limit', null
    );
  end if;

  return jsonb_build_object(
    'plan', 'free',
    'source', 'free',
    'expires_at', null,
    'revenuecat_status', v_entitlement.revenuecat_status,
    'product_id', v_entitlement.revenuecat_product_id,
    'used', coalesce(v_used, 0),
    'limit', 5
  );
end;
$function$;

revoke all on function public.my_subscription_access() from public, anon;
grant execute on function public.my_subscription_access() to authenticated;

create index followup_usage_profile_period_idx on public.followup_usage (profile_id, period_start desc);
