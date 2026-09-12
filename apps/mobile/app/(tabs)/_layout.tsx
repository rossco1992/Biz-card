import { Redirect, Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/constants/theme";
import { useSession } from "@/providers/session-provider";

const icon = (glyph: string, color: string) => <Text style={{ color, fontSize: 20 }}>{glyph}</Text>;

export default function TabLayout() {
  const { session, profile, loading } = useSession();
  if (!loading && (!session || !profile)) return <Redirect href="/" />;

  return (
    <Tabs
      initialRouteName="my-card"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: "#89928D",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginBottom: 3 },
        tabBarStyle: { height: 82, paddingTop: 7, backgroundColor: "#FCFCFA", borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen name="my-card" options={{ title: "My Card", tabBarIcon: ({ color }) => icon("▦", String(color)) }} />
      <Tabs.Screen name="connections" options={{ title: "Connections", tabBarIcon: ({ color }) => icon("◉", String(color)) }} />
      <Tabs.Screen name="automations" options={{ title: "Automations", tabBarIcon: ({ color }) => icon("ϟ", String(color)) }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color }) => icon("⚙", String(color)) }} />
    </Tabs>
  );
}
