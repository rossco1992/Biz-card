import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { useSession } from "@/providers/session-provider";

export default function AuthCallback() {
  const { session, error } = useSession();
  if (session) return <Redirect href="/" />;
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.title}>{error ? "Sign-in needs another try" : "Finishing sign-in…"}</Text>
      {error ? <Text style={styles.copy}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: colors.background },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800", marginTop: 18 },
  copy: { color: colors.danger, textAlign: "center", marginTop: 8 },
});
