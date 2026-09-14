import { Redirect } from "expo-router";
import { useRef, useState } from "react";
import { Keyboard, StyleSheet, Text, View } from "react-native";
import { Button, Card, Field, Notice, Screen } from "@/components/ui";
import { getSignInErrorMessage, isValidEmail } from "@/lib/sign-in";
import { colors } from "@/constants/theme";
import { useSession } from "@/providers/session-provider";

export default function SignIn() {
  const { session, sendMagicLink, configured, loading } = useSession();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submitting = useRef(false);
  const validEmail = isValidEmail(email);

  if (session) return <Redirect href="/" />;

  async function submit() {
    Keyboard.dismiss();
    if (submitting.current || loading || !configured) return;
    setError("");
    setMessage("");
    if (!validEmail) {
      setError("Enter a valid email address, like you@company.com.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      await sendMagicLink(email.trim());
      setMessage("Check your inbox and spam folder, then tap the sign-in link to return here.");
    } catch (cause) {
      setError(getSignInErrorMessage(cause));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.brand}>Biz Card</Text>
        <Text style={styles.title}>Your card. Your follow-up.</Text>
        <Text style={styles.copy}>Swap details in seconds and keep every promising introduction moving.</Text>
      </View>
      <Card>
        <Field
          label="Work email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError("");
            setMessage("");
          }}
          onBlur={() => {
            if (email.trim() && !validEmail) setError("Enter a valid email address, like you@company.com.");
          }}
          editable={!busy && !loading && configured}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          returnKeyType="send"
          onSubmitEditing={() => void submit()}
          placeholder="you@company.com"
        />
        <Button onPress={() => void submit()} loading={busy} disabled={busy || loading || !configured || !validEmail}>Email me a sign-in link</Button>
        {!configured ? <Notice tone="error">Sign-in is temporarily unavailable. Please try again later.</Notice> : null}
        {message ? <Notice tone="success">{message}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Text style={styles.finePrint}>No password to remember. The link securely signs you into this device.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 72, paddingBottom: 18 },
  brand: { color: colors.accent, fontSize: 13, fontWeight: "900", letterSpacing: 1.7, textTransform: "uppercase", marginBottom: 18 },
  title: { color: colors.ink, fontSize: 46, fontWeight: "800", lineHeight: 48, letterSpacing: -2.2, maxWidth: 340 },
  copy: { color: colors.muted, fontSize: 17, lineHeight: 25, marginTop: 16, maxWidth: 340 },
  finePrint: { color: colors.muted, fontSize: 12, textAlign: "center", lineHeight: 17 },
});
