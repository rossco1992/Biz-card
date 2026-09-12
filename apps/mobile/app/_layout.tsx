import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";
import { colors } from "@/constants/theme";
import { SessionProvider } from "@/providers/session-provider";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="auth/callback" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="mode-editor" options={{ presentation: "modal" }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
