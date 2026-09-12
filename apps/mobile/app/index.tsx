import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { useSession } from "@/providers/session-provider";

export default function Index() {
  const { configured, loading, session, profile } = useSession();

  if (!configured) {
    return (
      <View style={styles.center}>
        <Text style={styles.brand}>Biz Card</Text>
        <Text style={styles.title}>Connect your backend.</Text>
        <Text style={styles.copy}>Add the Expo public Supabase URL and anon key to run the native app.</Text>
      </View>
    );
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  if (!session) return <Redirect href="/sign-in" />;
  if (!profile) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/my-card" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: colors.background },
  brand: { color: colors.accent, fontSize: 14, fontWeight: "900", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 18 },
  title: { color: colors.ink, fontSize: 32, fontWeight: "800", letterSpacing: -1.2, textAlign: "center" },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 10, maxWidth: 320 },
});
