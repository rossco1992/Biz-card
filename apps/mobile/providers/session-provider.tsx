import { defaultModes } from "@biz-card/core";
import { loadOwnerWorkspace } from "@biz-card/supabase";
import type { Connection, Mode, Profile } from "@biz-card/types";
import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { AppState } from "react-native";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type ProfileInput = Pick<Profile, "slug" | "full_name" | "company" | "title" | "email" | "phone" | "website">;
type ModeInput = Pick<Mode, "name" | "delay_hours" | "subject_template" | "body_template">;

type SessionContextValue = {
  configured: boolean;
  session: Session | null;
  profile: Profile | null;
  modes: Mode[];
  connections: Connection[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  clearError: () => void;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  createProfile: (input: ProfileInput) => Promise<void>;
  updateProfile: (input: Partial<ProfileInput>) => Promise<void>;
  activateMode: (modeId: string) => Promise<void>;
  toggleFollowups: () => Promise<void>;
  saveMode: (modeId: string | null, input: ModeInput) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function getAuthParams(url: string) {
  const normalized = url.replace("#", "?");
  const parsed = new URL(normalized);
  return {
    code: parsed.searchParams.get("code"),
    accessToken: parsed.searchParams.get("access_token"),
    refreshToken: parsed.searchParams.get("refresh_token"),
  };
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [modes, setModes] = useState<Mode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const hydrate = useCallback(async (userId: string, silent = false) => {
    if (!supabase) return;
    if (!silent) setRefreshing(true);
    try {
      const workspace = await loadOwnerWorkspace(supabase, userId);
      setProfile(workspace.profile as Profile | null);
      setModes(workspace.modes as Mode[]);
      setConnections(workspace.connections as unknown as Connection[]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't refresh your card.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleAuthUrl = useCallback(async (url: string) => {
    if (!supabase) return;
    try {
      const { code, accessToken, refreshToken } = getAuthParams(url);
      if (code) await supabase.auth.exchangeCodeForSession(code);
      else if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That sign-in link could not be completed.");
    }
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }

    let mounted = true;
    client.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) await hydrate(data.session.user.id, true);
      if (mounted) setLoading(false);
    });

    Linking.getInitialURL().then((url) => url && void handleAuthUrl(url));
    const linkSubscription = Linking.addEventListener("url", ({ url }) => void handleAuthUrl(url));
    const authSubscription = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) void hydrate(nextSession.user.id, true);
      else {
        setProfile(null);
        setModes([]);
        setConnections([]);
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
    connections,
    loading,
    refreshing,
    error,
    clearError: () => setError(""),
    sendMagicLink: async (email) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      setError("");
      const redirectTo = Linking.createURL("auth/callback");
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
    saveMode: async (modeId, input) => {
      if (!supabase || !profile || !session) return;
      const requestedDelay = Number.isFinite(input.delay_hours) ? input.delay_hours : 24;
      const payload = { ...input, delay_hours: Math.max(1, Math.min(72, requestedDelay)), updated_at: new Date().toISOString() };
      if (modeId) {
        const { error: updateError } = await supabase.from("modes").update(payload).eq("id", modeId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("modes").insert({ ...payload, profile_id: profile.id, kind: "event" });
        if (insertError) throw insertError;
      }
      await hydrate(session.user.id);
    },
  }), [connections, error, hydrate, loading, modes, profile, refreshing, session]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider.");
  return value;
}
