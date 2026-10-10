import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";
import { colors } from "@/constants/theme";
import { SessionProvider } from "@/providers/session-provider";
import { NotificationBridge } from "@/components/notification-bridge";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <NotificationBridge />
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="auth/callback" />
          <Stack.Screen name="email-connected" />
          <Stack.Screen name="text-followup" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="mode-editor" options={{ presentation: "modal" }} />
          <Stack.Screen name="event-editor" options={{ presentation: "modal" }} />
          <Stack.Screen name="pro" options={{ presentation: "modal" }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
