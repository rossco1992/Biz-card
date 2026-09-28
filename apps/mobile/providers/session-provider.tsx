import { defaultModes } from "@biz-card/core";
import { loadOwnerWorkspace } from "@biz-card/supabase";
import type { Connection, Event, Mode, Profile, SubscriptionAccess } from "@biz-card/types";
import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { completeAuthCallback, INVALID_LINK_MESSAGE, MOBILE_AUTH_REDIRECT } from "@/lib/auth-callback";
import { AppState } from "react-native";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { configurePurchases, revenueCatConfigured } from "@/lib/billing";

type ProfileInput = Pick<Profile, "slug" | "full_name" | "company" | "title" | "email" | "phone" | "website">;
type ModeInput = Pick<Mode, "name" | "delay_hours" | "subject_template" | "body_template" | "include_signature">;
type EventInput = Pick<Event, "name" | "location">;

type SessionContextValue = {
  configured: boolean;
  session: Session | null;
  profile: Profile | null;
  modes: Mode[];
  events: Event[];
  connections: Connection[];
  subscription: SubscriptionAccess | null;
  loading: boolean;
  refreshing: boolean;
  authCompleting: boolean;
  authError: string;
  error: string;
  clearError: () => void;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  createProfile: (input: ProfileInput) => Promise<void>;
  updateProfile: (input: Partial<ProfileInput & Pick<Profile, "avatar_url" | "email_signature">>) => Promise<void>;
  activateMode: (modeId: string) => Promise<void>;
  activateEvent: (eventId: string) => Promise<void>;
  toggleFollowups: () => Promise<void>;
  deleteMode: (modeId: string) => Promise<void>;
  saveMode: (modeId: string | null, input: ModeInput) => Promise<void>;
  saveEvent: (eventId: string | null, input: EventInput) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [modes, setModes] = useState<Mode[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState("");
  const [authCompleting, setAuthCompleting] = useState(false);
  const lastAuthUrl = useRef<string | null>(null);
  const authInFlight = useRef(false);

  const hydrate = useCallback(async (userId: string, silent = false) => {
    if (!supabase) return;
    if (!silent) setRefreshing(true);
    try {
      const workspace = await loadOwnerWorkspace(supabase, userId);
      setProfile(workspace.profile as Profile | null);
      setModes(workspace.modes as Mode[]);
      setEvents(workspace.events as Event[]);
      setConnections(workspace.connections as unknown as Connection[]);
      setSubscription(workspace.subscription as SubscriptionAccess | null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't refresh your card.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleAuthUrl = useCallback(async (url: string) => {
    if (!supabase || !url.startsWith(MOBILE_AUTH_REDIRECT) || lastAuthUrl.current === url || authInFlight.current) return;
    lastAuthUrl.current = url;
    authInFlight.current = true;
    setAuthCompleting(true);
    setAuthError("");
    try {
      const nextSession = await completeAuthCallback(url, supabase.auth);
      if (nextSession) {
        setSession(nextSession);
        await hydrate(nextSession.user.id);
      }
    } catch {
      setAuthError(INVALID_LINK_MESSAGE);
    } finally {
      authInFlight.current = false;
      setAuthCompleting(false);
    }
  }, [hydrate]);

  useEffect(() => {
    if (!session?.user.id || !revenueCatConfigured()) return;
    void configurePurchases(session.user.id).catch((cause) => {
      if (__DEV__) console.warn("RevenueCat configuration failed", cause);
    });
  }, [session?.user.id]);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }

    let mounted = true;
    client.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!mounted) return;
      if (authInFlight.current) return;
      if (sessionError) setError("Your session could not be restored. Please sign in again.");
      setSession(data.session);
      if (data.session) await hydrate(data.session.user.id, true);
    }).catch(() => {
      if (mounted) setError("Your session could not be restored. Please sign in again.");
    }).finally(() => {
      if (mounted) setLoading(false);
    });

    Linking.getInitialURL().then((url) => url && void handleAuthUrl(url)).catch(() => {
      if (mounted) setAuthError("The sign-in link could not be opened. Please try again.");
    });
    const linkSubscription = Linking.addEventListener("url", ({ url }) => void handleAuthUrl(url));
    const authSubscription = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        if (!authInFlight.current) void hydrate(nextSession.user.id);
      }
      else {
        setProfile(null);
        setModes([]);
        setEvents([]);
        setConnections([]);
        setSubscription(null);
      }
    });
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });

    return () => {
      mounted = false;
      linkSubscription.remove();
      authSubscription.data.subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, [handleAuthUrl, hydrate]);

  const value = useMemo<SessionContextValue>(() => ({
    configured: isSupabaseConfigured,
    session,
    profile,
    modes,
    events,
    connections,
    subscription,
    loading,
    refreshing,
    authCompleting,
    authError,
    error,
    clearError: () => setError(""),
    sendMagicLink: async (email) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        throw Object.assign(new Error("Use the installed Knct’d prototype to sign in."), { code: "native_build_required" });
      }
      setError("");
      setAuthError("");
      const redirectTo = MOBILE_AUTH_REDIRECT;
      if (__DEV__) {
        console.log("Sign-in redirect:", redirectTo);
      }
      const { error: authError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo } });
      if (authError) throw authError;
    },
    signOut: async () => {
      if (!supabase) return;
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    },
    refresh: async () => {
      if (session) await hydrate(session.user.id);
    },
    createProfile: async (input) => {
      if (!supabase || !session) throw new Error("Sign in before creating a card.");
      const { data, error: profileError } = await supabase.from("profiles").insert({
        ...input,
        user_id: session.user.id,
        followup_enabled: true,
      }).select("id").single();
      if (profileError || !data) throw profileError ?? new Error("Could not create your card.");
      const { data: createdModes, error: modesError } = await supabase.from("modes").insert(defaultModes(data.id)).select("id,kind");
      if (modesError) throw modesError;
      const everyday = createdModes?.find((mode) => mode.kind === "everyday");
      if (everyday) await supabase.from("profiles").update({ active_mode_id: everyday.id }).eq("id", data.id);
      await hydrate(session.user.id);
    },
    updateProfile: async (input) => {
      if (!supabase || !profile || !session) return;
      const { error: updateError } = await supabase.from("profiles").update({ ...input, updated_at: new Date().toISOString() }).eq("id", profile.id);
      if (updateError) throw updateError;
      await hydrate(session.user.id);
    },
    activateMode: async (modeId) => {
      if (!supabase || !profile || !session) return;
      setProfile({ ...profile, active_mode_id: modeId });
      const { error: updateError } = await supabase.from("profiles").update({ active_mode_id: modeId, updated_at: new Date().toISOString() }).eq("id", profile.id);
      if (updateError) {
        await hydrate(session.user.id);
        throw updateError;
      }
    },
    activateEvent: async (eventId) => {
      if (!supabase || !profile || !session) return;
      setProfile({ ...profile, active_event_id: eventId });
      const { error: updateError } = await supabase.from("profiles").update({ active_event_id: eventId, updated_at: new Date().toISOString() }).eq("id", profile.id);
      if (updateError) {
        await hydrate(session.user.id);
        throw updateError;
      }
    },
    toggleFollowups: async () => {
      if (!supabase || !profile || !session) return;
      const enabled = !profile.followup_enabled;
      setProfile({ ...profile, followup_enabled: enabled });
      const { error: updateError } = await supabase.from("profiles").update({ followup_enabled: enabled, updated_at: new Date().toISOString() }).eq("id", profile.id);
      if (updateError) {
        await hydrate(session.user.id);
        throw updateError;
      }
    },
    deleteMode: async (modeId) => {
      if (!supabase || !profile || !session) throw new Error("Sign in again to delete this mode.");
      if (profile.active_mode_id === modeId) throw new Error("Activate another mode in My Card before deleting this one.");
      if (modes.length <= 1) throw new Error("Create another mode before deleting your last one.");
      const { data, error: deleteError } = await supabase.from("modes").delete()
        .eq("id", modeId).eq("profile_id", profile.id).select("id");
      if (deleteError) throw new Error("Could not delete this mode. Please try again.");
      if (!data?.length) throw new Error("This mode is no longer available. Refresh and try again.");
      await hydrate(session.user.id);
    },
    saveMode: async (modeId, input) => {
      if (!supabase || !profile || !session) return;
      const requestedDelay = Number.isFinite(input.delay_hours) ? input.delay_hours : 24;
      const payload = { ...input, delay_hours: Math.max(1, Math.min(72, requestedDelay)), updated_at: new Date().toISOString() };
      if (modeId) {
        const { error: updateError } = await supabase.from("modes").update(payload).eq("id", modeId).eq("profile_id", profile.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("modes").insert({ ...payload, profile_id: profile.id, kind: "event" });
        if (insertError) throw insertError;
      }
      await hydrate(session.user.id);
    },
    saveEvent: async (eventId, input) => {
      if (!supabase || !profile || !session) return;
      const payload = { name: input.name.trim(), location: input.location.trim(), updated_at: new Date().toISOString() };
      if (!payload.name || !payload.location) throw new Error("Event name and location are required.");
      if (eventId) {
        const { error: updateError } = await supabase.from("events").update(payload).eq("id", eventId).eq("profile_id", profile.id);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase.from("events").insert({ ...payload, profile_id: profile.id }).select("id").single();
        if (insertError || !data) throw insertError ?? new Error("Could not create this event.");
        const { error: activateError } = await supabase.from("profiles").update({ active_event_id: data.id, updated_at: new Date().toISOString() }).eq("id", profile.id);
        if (activateError) throw activateError;
      }
      await hydrate(session.user.id);
    },
    deleteEvent: async (eventId) => {
      if (!supabase || !profile || !session) throw new Error("Sign in again to delete this event.");
      if (profile.active_event_id === eventId) throw new Error("Activate another event before deleting this one.");
      const { data, error: deleteError } = await supabase.from("events").delete().eq("id", eventId).eq("profile_id", profile.id).select("id");
      if (deleteError) throw new Error("Could not delete this event. Please try again.");
      if (!data?.length) throw new Error("This event is no longer available. Refresh and try again.");
      await hydrate(session.user.id);
    },
  }), [authCompleting, authError, connections, error, events, hydrate, loading, modes, profile, refreshing, session, subscription]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider.");
  return value;
}
