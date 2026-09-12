import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii } from "@/constants/theme";

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const content = <View style={styles.screenContent}>{children}</View>;
  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function PageHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerText}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle | ViewStyle[] }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  children,
  onPress,
  variant = "primary",
  disabled,
  loading,
}: PropsWithChildren<{ onPress?: () => void; variant?: "primary" | "secondary" | "danger"; disabled?: boolean; loading?: boolean }>) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[`${variant}Button`], (pressed || disabled || loading) && styles.buttonPressed]}
    >
      {loading ? <ActivityIndicator color={variant === "primary" ? "white" : colors.ink} /> : <Text style={[styles.buttonText, variant === "primary" && styles.primaryButtonText, variant === "danger" && styles.dangerButtonText]}>{children}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#9AA19D"
        {...props}
        style={[styles.input, props.multiline && styles.multiline, props.style]}
      />
    </View>
  );
}

export function Notice({ children, tone = "neutral" }: PropsWithChildren<{ tone?: "neutral" | "error" | "success" }>) {
  return (
    <View style={[styles.notice, tone === "error" && styles.errorNotice, tone === "success" && styles.successNotice]}>
      <Text style={[styles.noticeText, tone === "error" && styles.errorText]}>{children}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, copy }: { icon: string; title: string; copy: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: "row", alignItems: "center" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  screenContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 120, gap: 18 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  headerText: { flex: 1 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 5 },
  title: { color: colors.ink, fontSize: 34, fontWeight: "800", letterSpacing: -1.5, lineHeight: 39 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radii.large, padding: 18, gap: 16, shadowColor: "#24372F", shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  button: { minHeight: 54, borderRadius: radii.medium, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, borderWidth: 1 },
  primaryButton: { backgroundColor: colors.ink, borderColor: colors.ink },
  secondaryButton: { backgroundColor: colors.surface, borderColor: colors.line },
  dangerButton: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  buttonPressed: { opacity: 0.62 },
  buttonText: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  primaryButtonText: { color: "white" },
  dangerButtonText: { color: colors.danger },
  field: { gap: 7 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  input: { minHeight: 52, borderRadius: radii.medium, borderColor: colors.line, borderWidth: 1, backgroundColor: colors.surface, paddingHorizontal: 15, color: colors.ink, fontSize: 16 },
  multiline: { minHeight: 126, paddingTop: 14, textAlignVertical: "top" },
  notice: { backgroundColor: "#ECEEEB", padding: 13, borderRadius: radii.small },
  errorNotice: { backgroundColor: colors.dangerSoft },
  successNotice: { backgroundColor: colors.accentSoft },
  noticeText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  errorText: { color: colors.danger },
  empty: { alignItems: "center", paddingVertical: 38, paddingHorizontal: 18 },
  emptyIcon: { fontSize: 30, marginBottom: 12 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: 6 },
  emptyCopy: { color: colors.muted, textAlign: "center", lineHeight: 20 },
});
