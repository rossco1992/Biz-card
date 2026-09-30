export type FollowupStatus = "scheduled" | "sending" | "sent" | "cancelled" | "failed";
export type FollowupChannel = "email" | "sms";
export type SmsSenderStatus = "requested" | "pending" | "approved" | "rejected" | "suspended";
export type MailProvider = "google" | "microsoft";
export type Mailbox = {
  profile_id: string;
  id: string;
  provider: MailProvider;
  email: string;
  refresh_token_encrypted: string;
  status: "connected" | "reconnect";
  updated_at: string;
};
export type MailboxStatus = {
  mailbox: Pick<Mailbox, "id" | "provider" | "email" | "status"> | null;
  providers: { google: boolean; microsoft: boolean };
};
export type MailboxOAuthState = {
  state_hash: string;
  launch_hash: string | null;
  browser_hash: string | null;
  profile_id: string;
  provider: MailProvider;
  platform: "web" | "mobile";
  verifier_encrypted: string;
  expires_at: string;
  confirmation_hash: string | null;
  pending_email: string | null;
  pending_token_encrypted: string | null;
  confirmed_mailbox_id: string | null;
};
export type ModeKind = "everyday" | "event";

export type SmsSender = {
  profile_id: string;
  id: string;
  status: SmsSenderStatus;
  phone_number: string | null;
  twilio_subaccount_sid: string | null;
  messaging_service_sid: string | null;
  phone_number_sid: string | null;
  brand_sid: string | null;
  campaign_sid: string | null;
  status_detail: string | null;
  requested_at: string;
  approved_at: string | null;
  updated_at: string;
};

export type RevenueCatStatus = "inactive" | "trialing" | "active" | "cancelled" | "billing_issue" | "expired" | "refunded";
export type SubscriptionPlan = "free" | "pro";
export type SubscriptionSource = "free" | "revenuecat" | "promotion" | "admin";
export type SubscriptionAccess = {
  plan: SubscriptionPlan;
  source: SubscriptionSource;
  expires_at: string | null;
  revenuecat_status?: RevenueCatStatus;
  product_id?: string | null;
  used: number;
  limit: number | null;
};
export type FollowupAllowance = {
  allowed: boolean;
  plan: SubscriptionPlan;
  used: number | null;
  limit: number | null;
};
export type ProfileEntitlement = {
  profile_id: string;
  revenuecat_status: RevenueCatStatus;
  revenuecat_expires_at: string | null;
  revenuecat_product_id: string | null;
  revenuecat_provider: string | null;
  promotion_expires_at: string | null;
  promotion_label: string | null;
  admin_lifetime: boolean;
  admin_expires_at: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};
export type FollowupUsage = {
  profile_id: string;
  period_start: string;
  used: number;
  updated_at: string;
};

export type Profile = {
  id: string;
  user_id: string;
  slug: string;
  avatar_url?: string | null;
  full_name: string;
  company: string;
  title: string;
  email: string;
  phone: string | null;
  website: string | null;
  followup_enabled: boolean;
  sms_followup_enabled: boolean;
  active_mode_id: string | null;
  active_event_id: string | null;
  email_signature: string;
  email_signature_html?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Mode = {
  id: string;
  profile_id: string;
  name: string;
  kind: ModeKind;
  delay_hours: number;
  subject_template: string;
  body_template: string;
  include_signature: boolean;
  sms_enabled: boolean;
  sms_body_template: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Event = {
  id: string;
  profile_id: string;
  name: string;
  location: string;
  event_date?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Followup = {
  delivery_provider?: "resend" | "unconnected" | "twilio" | MailProvider;
  channel: FollowupChannel;
  mailbox_id?: string | null;
  id: string;
  connection_id: string;
  profile_id: string;
  mode_id: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  send_at: string;
  status: FollowupStatus;
  subject_snapshot: string;
  body_snapshot: string;
  body_html_snapshot?: string | null;
  sent_at: string | null;
  provider_message_id: string | null;
  error: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Connection = {
  id: string;
  profile_id: string;
  mode_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  consent_at: string;
  mode_name_snapshot: string | null;
  event_id: string | null;
  event_name_snapshot: string | null;
  event_location_snapshot: string | null;
  created_at: string;
  followups?: Pick<Followup, "channel" | "status" | "send_at" | "sent_at" | "error">
    | Pick<Followup, "channel" | "status" | "send_at" | "sent_at" | "error">[]
    | null;
};

type Relationship<ForeignKey extends string, Column extends string, ReferencedRelation extends string> = {
  foreignKeyName: ForeignKey;
  columns: [Column];
  isOneToOne: boolean;
  referencedRelation: ReferencedRelation;
  referencedColumns: ["id"];
};

type RowShape<Row, Insert, Update, Relationships extends Relationship<string, string, string>[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

export type Database = {
  public: {
    Tables: {
      profile_entitlements: RowShape<ProfileEntitlement, ProfileEntitlement, Partial<ProfileEntitlement>>;
      followup_usage: RowShape<FollowupUsage, FollowupUsage, Partial<FollowupUsage>>;
      sms_senders: RowShape<SmsSender, Partial<SmsSender> & Pick<SmsSender, "profile_id">, Partial<SmsSender>>;
      mailboxes: RowShape<Mailbox, Mailbox, Partial<Mailbox>>;
      mailbox_oauth_states: RowShape<MailboxOAuthState, MailboxOAuthState, Partial<MailboxOAuthState>>;
      profiles: RowShape<
        Required<Profile>,
        Omit<Profile, "id" | "active_mode_id" | "active_event_id" | "email_signature" | "created_at" | "updated_at"> & Partial<Pick<Profile, "id" | "active_mode_id" | "active_event_id" | "email_signature" | "created_at" | "updated_at">>,
        Partial<Omit<Profile, "id" | "user_id">>,
        [
          Relationship<"profiles_active_mode_fk", "active_mode_id", "modes">,
          Relationship<"profiles_active_event_fk", "active_event_id", "events">
        ]
      >;
      modes: RowShape<
        Required<Mode>,
        Omit<Mode, "id" | "include_signature" | "created_at" | "updated_at"> & Partial<Pick<Mode, "id" | "include_signature" | "created_at" | "updated_at">>,
        Partial<Omit<Mode, "id" | "profile_id">>,
        [Relationship<"modes_profile_id_fkey", "profile_id", "profiles">]
      >;
      events: RowShape<
        Required<Event>,
        Omit<Event, "id" | "created_at" | "updated_at"> & Partial<Pick<Event, "id" | "created_at" | "updated_at">>,
        Partial<Omit<Event, "id" | "profile_id">>,
        [Relationship<"events_profile_id_fkey", "profile_id", "profiles">]
      >;
      connections: RowShape<
        Omit<Connection, "followups">,
        Omit<Connection, "id" | "event_id" | "event_name_snapshot" | "event_location_snapshot" | "created_at" | "followups"> & Partial<Pick<Connection, "id" | "event_id" | "event_name_snapshot" | "event_location_snapshot" | "created_at">>,
        Partial<Omit<Connection, "id" | "profile_id" | "followups">>,
        [
          Relationship<"connections_profile_id_fkey", "profile_id", "profiles">,
          Relationship<"connections_mode_id_fkey", "mode_id", "modes">,
          Relationship<"connections_event_id_fkey", "event_id", "events">
        ]
      >;
      followups: RowShape<
        Required<Followup>,
        Omit<Followup, "id" | "sent_at" | "provider_message_id" | "error" | "created_at" | "updated_at"> & Partial<Pick<Followup, "id" | "sent_at" | "provider_message_id" | "error" | "created_at" | "updated_at">>,
        Partial<Omit<Followup, "id" | "profile_id" | "connection_id">>,
        [
          Relationship<"followups_connection_id_fkey", "connection_id", "connections">,
          Relationship<"followups_profile_id_fkey", "profile_id", "profiles">,
          Relationship<"followups_mode_id_fkey", "mode_id", "modes">
        ]
      >;
    };
    Views: Record<string, never>;
    Functions: {
      my_subscription_access: { Args: Record<string, never>; Returns: SubscriptionAccess };
      profile_has_pro: { Args: { p_profile_id: string }; Returns: boolean };
      consume_followup_allowance: { Args: { p_profile_id: string }; Returns: FollowupAllowance };
      finish_mailbox_connection: { Args: { p_confirmation_hash: string; p_profile_id: string }; Returns: undefined };
      disconnect_mailbox: { Args: { p_profile_id: string }; Returns: undefined };
      claim_mailbox_followups: { Args: { batch_size?: number }; Returns: Required<Followup>[] };
      claim_sms_followups: { Args: { batch_size?: number }; Returns: Required<Followup>[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
