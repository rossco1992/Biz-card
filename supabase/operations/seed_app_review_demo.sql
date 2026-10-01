-- Creates realistic App Review content for the dedicated password-auth user.
-- Run only after creating appreview@getknctd.com in Supabase Auth with a password
-- and marking the email confirmed. Safe to rerun: it replaces only that user's demo workspace.

do $$
declare
  v_user_id uuid;
  v_profile_id uuid;
  v_everyday_mode_id uuid;
  v_event_mode_id uuid;
  v_event_id uuid;
  v_conn_sent uuid;
  v_conn_scheduled uuid;
  v_conn_recent uuid;
begin
  select id
    into v_user_id
  from auth.users
  where lower(email) = lower('appreview@getknctd.com')
  limit 1;

  if v_user_id is null then
    raise exception 'Create and confirm appreview@getknctd.com in Supabase Auth before running this script.';
  end if;

  delete from public.profiles where user_id = v_user_id;
  delete from public.profiles where slug = 'apple-review';

  insert into public.profiles (
    user_id,
    slug,
    full_name,
    company,
    title,
    email,
    phone,
    website,
    followup_enabled,
    email_signature
  )
  values (
    v_user_id,
    'apple-review',
    'Alex Morgan',
    'KNCT Demo',
    'Product Lead',
    'appreview@getknctd.com',
    '+1 201 555 0142',
    'https://www.getknctd.com',
    true,
    'Alex Morgan\nProduct Lead, KNCT Demo\nhttps://www.getknctd.com'
  )
  returning id into v_profile_id;

  insert into public.modes (
    profile_id,
    name,
    kind,
    delay_hours,
    subject_template,
    body_template,
    include_signature
  )
  values (
    v_profile_id,
    'Everyday',
    'everyday',
    24,
    'Great meeting you',
    'Hey {{first_name}} — great meeting you. Wanted to follow up while our conversation was still fresh. If it''d be useful to keep talking, happy to find some time.',
    true
  )
  returning id into v_everyday_mode_id;

  insert into public.modes (
    profile_id,
    name,
    kind,
    delay_hours,
    subject_template,
    body_template,
    include_signature
  )
  values (
    v_profile_id,
    'Conference',
    'event',
    24,
    '{{my_first_name}} from {{event_name}} — great meeting you',
    'Hey {{first_name}} — {{my_first_name}} here. It was great meeting you at {{event_context}}. I wanted to follow up while our conversation was still fresh. Would love to stay connected.',
    true
  )
  returning id into v_event_mode_id;

  insert into public.events (
    profile_id,
    name,
    location,
    event_date
  )
  values (
    v_profile_id,
    'Product Leaders Summit',
    'New York, NY',
    current_date + 14
  )
  returning id into v_event_id;

  update public.profiles
  set
    active_mode_id = v_everyday_mode_id,
    active_event_id = v_event_id,
    updated_at = now()
  where id = v_profile_id;

  insert into public.connections (
    profile_id,
    mode_id,
    event_id,
    first_name,
    last_name,
    email,
    phone,
    consent_at,
    mode_name_snapshot,
    event_name_snapshot,
    event_location_snapshot,
    created_at
  )
  values (
    v_profile_id,
    v_event_mode_id,
    v_event_id,
    'Jamie',
    'Chen',
    'jamie.chen@example.com',
    '+1 212 555 0101',
    now() - interval '3 days',
    'Conference',
    'Product Leaders Summit',
    'New York, NY',
    now() - interval '3 days'
  )
  returning id into v_conn_sent;

  insert into public.followups (
    connection_id,
    profile_id,
    mode_id,
    recipient_email,
    send_at,
    status,
    subject_snapshot,
    body_snapshot,
    sent_at,
    provider_message_id,
    created_at,
    updated_at
  )
  values (
    v_conn_sent,
    v_profile_id,
    v_event_mode_id,
    'jamie.chen@example.com',
    now() - interval '2 days',
    'sent',
    'Alex from Product Leaders Summit — great meeting you',
    'Hey Jamie — Alex here. It was great meeting you at Product Leaders Summit in New York, NY. I wanted to follow up while our conversation was still fresh. Would love to stay connected.',
    now() - interval '2 days',
    'app-review-demo-sent',
    now() - interval '3 days',
    now() - interval '2 days'
  );

  insert into public.connections (
    profile_id,
    mode_id,
    event_id,
    first_name,
    last_name,
    email,
    consent_at,
    mode_name_snapshot,
    event_name_snapshot,
    event_location_snapshot,
    created_at
  )
  values (
    v_profile_id,
    v_event_mode_id,
    v_event_id,
    'Taylor',
    'Brooks',
    'taylor.brooks@example.com',
    now() - interval '1 day',
    'Conference',
    'Product Leaders Summit',
    'New York, NY',
    now() - interval '1 day'
  )
  returning id into v_conn_scheduled;

  insert into public.followups (
    connection_id,
    profile_id,
    mode_id,
    recipient_email,
    send_at,
    status,
    subject_snapshot,
    body_snapshot,
    created_at,
    updated_at
  )
  values (
    v_conn_scheduled,
    v_profile_id,
    v_event_mode_id,
    'taylor.brooks@example.com',
    now() + interval '30 days',
    'scheduled',
    'Alex from Product Leaders Summit — great meeting you',
    'Hey Taylor — Alex here. It was great meeting you at Product Leaders Summit in New York, NY. I wanted to follow up while our conversation was still fresh. Would love to stay connected.',
    now() - interval '1 day',
    now() - interval '1 day'
  );

  insert into public.connections (
    profile_id,
    mode_id,
    first_name,
    last_name,
    email,
    consent_at,
    mode_name_snapshot,
    created_at
  )
  values (
    v_profile_id,
    v_everyday_mode_id,
    'Jordan',
    'Lee',
    'jordan.lee@example.com',
    now() - interval '2 hours',
    'Everyday',
    now() - interval '2 hours'
  )
  returning id into v_conn_recent;

  insert into public.followups (
    connection_id,
    profile_id,
    mode_id,
    recipient_email,
    send_at,
    status,
    subject_snapshot,
    body_snapshot,
    created_at,
    updated_at
  )
  values (
    v_conn_recent,
    v_profile_id,
    v_everyday_mode_id,
    'jordan.lee@example.com',
    now() + interval '31 days',
    'scheduled',
    'Great meeting you',
    'Hey Jordan — great meeting you. Wanted to follow up while our conversation was still fresh. If it''d be useful to keep talking, happy to find some time.',
    now() - interval '2 hours',
    now() - interval '2 hours'
  );

  update public.profile_entitlements
  set
    admin_lifetime = true,
    admin_note = 'App Store review demo account',
    updated_at = now()
  where profile_id = v_profile_id;
end
$$;
