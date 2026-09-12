export type FollowupStatus = "scheduled" | "sending" | "sent" | "cancelled" | "failed";
export type ModeKind = "everyday" | "event";

export type Profile = {
  id: string;
  user_id: string;
  slug: string;
  full_name: string;
  company: string;
  title: string;
  email: string;
  phone: string | null;
  website: string | null;
  followup_enabled: boolean;
  active_mode_id: string | null;
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
  created_at?: string;
  updated_at?: string;
};

export type Followup = {
  id: string;
  connection_id: string;
  profile_id: string;
  mode_id: string | null;
  recipient_email: string;
  send_at: string;
  status: FollowupStatus;
  subject_snapshot: string;
  body_snapshot: string;
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
  created_at: string;
  followups?: Pick<Followup, "status" | "send_at" | "sent_at" | "error">[];
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
      profiles: RowShape<
        Required<Profile>,
        Omit<Profile, "id" | "active_mode_id" | "created_at" | "updated_at"> & Partial<Pick<Profile, "id" | "active_mode_id" | "created_at" | "updated_at">>,
        Partial<Omit<Profile, "id" | "user_id">>,
        [Relationship<"profiles_active_mode_fk", "active_mode_id", "modes">]
      >;
      modes: RowShape<
        Required<Mode>,
        Omit<Mode, "id" | "created_at" | "updated_at"> & Partial<Pick<Mode, "id" | "created_at" | "updated_at">>,
        Partial<Omit<Mode, "id" | "profile_id">>,
        [Relationship<"modes_profile_id_fkey", "profile_id", "profiles">]
      >;
      connections: RowShape<
        Omit<Connection, "followups">,
        Omit<Connection, "id" | "created_at" | "followups"> & Partial<Pick<Connection, "id" | "created_at">>,
        Partial<Omit<Connection, "id" | "profile_id" | "followups">>,
        [
          Relationship<"connections_profile_id_fkey", "profile_id", "profiles">,
          Relationship<"connections_mode_id_fkey", "mode_id", "modes">
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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
