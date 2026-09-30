-- Separate Twilio-funded SMS access from KNCT Pro software access.
-- RevenueCat should attach entitlement id "pro_plus" to products that include SMS.

alter table public.profile_entitlements
  add column if not exists revenuecat_entitlement_ids text[] not null default '{}',
  add column if not exists sms_admin_lifetime boolean not null default false,
  add column if not exists sms_admin_expires_at timestamptz,
  add column if not exists sms_admin_note text;

create or replace function public.profile_has_sms(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((
    select
      e.sms_admin_lifetime
      or (e.sms_admin_expires_at is not null and e.sms_admin_expires_at > now())
      or (
        'pro_plus' = any(coalesce(e.revenuecat_entitlement_ids, '{}'::text[]))
        and e.revenuecat_status in ('trialing', 'active', 'cancelled', 'billing_issue')
        and e.revenuecat_expires_at is not null
        and e.revenuecat_expires_at > now()
      )
    from public.profile_entitlements e
    where e.profile_id = p_profile_id
  ), false);
$function$;

revoke all on function public.profile_has_sms(uuid) from public, anon, authenticated;
grant execute on function public.profile_has_sms(uuid) to service_role;

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
    return jsonb_build_object(
      'allowed', true,
      'plan', case when public.profile_has_sms(p_profile_id) then 'pro_plus' else 'pro' end,
      'used', null,
      'limit', null
    );
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
  v_sms boolean := false;
  v_source text := 'free';
  v_expires_at timestamptz;
begin
  select id into v_profile_id from public.profiles where user_id = auth.uid();
  if v_profile_id is null then
    return jsonb_build_object('plan', 'free', 'source', 'free', 'sms_access', false, 'used', 0, 'limit', 5);
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

  v_sms := public.profile_has_sms(v_profile_id);
  if v_sms then v_pro := true; end if;

  select used into v_used
  from public.followup_usage
  where profile_id = v_profile_id and period_start = v_period;

  if v_pro then
    return jsonb_build_object(
      'plan', case when v_sms then 'pro_plus' else 'pro' end,
      'source', v_source,
      'sms_access', v_sms,
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
    'sms_access', false,
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
