import { Redirect } from "expo-router";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useSession } from "@/providers/session-provider";

export default function Index() {
  const { configured, loading, refreshing, authCompleting, session, profile, error, refresh, signOut } = useSession();

  if (!configured) {
    return (
      <View style={styles.center}>
        <Text style={styles.brand}>Biz Card</Text>
        <Text style={styles.title}>Connect your backend.</Text>
        <Text style={styles.copy}>Add the Expo public Supabase URL and anon key to run the native app.</Text>
      </View>
    );
  }

  if (loading || refreshing || authCompleting) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  if (!session) return <Redirect href="/sign-in" />;
  if (error && !profile) return (
    <View style={styles.center}>
      <Text style={styles.title}>We couldn't load your card.</Text>
      <Text style={styles.copy}>Check your connection and try again.</Text>
      <Button onPress={() => void refresh()}>Try again</Button>
      <Button variant="secondary" onPress={() => { void signOut().catch(() => Alert.alert("Could not sign out", "Check your connection and try again.")); }}>Sign out</Button>
    </View>
  );
  if (!profile) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/my-card" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 18, backgroundColor: colors.background },
  brand: { color: colors.accent, fontSize: 14, fontWeight: "900", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 18 },
  title: { color: colors.ink, fontSize: 32, fontWeight: "800", letterSpacing: -1.2, textAlign: "center" },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 10, maxWidth: 320 },
});
