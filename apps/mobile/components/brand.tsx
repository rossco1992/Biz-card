import { Image, StyleSheet, Text, View } from "react-native";
import { colors, displayFont } from "@/constants/theme";

export function Brand({ tagline = false }: { tagline?: boolean }) {
  return <View style={styles.container}>
    <View style={styles.row} accessible accessibilityLabel="Knct’d">
      <Image source={require("@/assets/images/icon.png")} style={styles.icon} accessibilityIgnoresInvertColors />
      <Text style={styles.wordmark}>Kn<Text style={styles.copper}>ct’</Text>d</Text>
    </View>
    {tagline ? <Text style={styles.tagline}>The professional follow-up app</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: 10, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 12 },
  wordmark: { fontFamily: displayFont, fontSize: 36, color: colors.ink, letterSpacing: -1.5 },
  copper: { color: colors.copper },
  tagline: { color: colors.muted, fontSize: 10, letterSpacing: 1.3, textTransform: "uppercase" },
});
