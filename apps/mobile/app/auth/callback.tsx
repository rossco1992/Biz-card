import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useSession } from "@/providers/session-provider";

export default function AuthCallback() {
  const { session, authError, authCompleting, configured } = useSession();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 20000);
    return () => clearTimeout(timer);
  }, []);

  if (session && !authCompleting) return <Redirect href="/" />;
  const message = !configured
    ? "Sign-in is unavailable in this build. Please contact support."
    : authError || (timedOut ? "Sign-in is taking longer than expected. Check your connection, then try again." : "");
  return (
    <View style={styles.center}>
      {!message && <ActivityIndicator color={colors.accent} size="large" />}
      <Text style={styles.title}>{message ? "Sign-in needs another try" : "Finishing sign-in…"}</Text>
      {message ? <>
        <Text style={styles.copy}>{message}</Text>
        <Button onPress={() => router.replace("/sign-in")}>Back to sign-in</Button>
      </> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: colors.background, gap: 18 },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  copy: { color: colors.danger, textAlign: "center" },
});
