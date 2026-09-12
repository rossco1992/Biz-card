import { slugify } from "@biz-card/core";
import { Redirect, router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, Field, Notice, Screen, uiStyles } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useSession } from "@/providers/session-provider";

export default function Onboarding() {
  const { session, profile, createProfile } = useSession();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [slug, setSlug] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const suggestedSlug = useMemo(() => slugify(slug || fullName), [fullName, slug]);

  if (!session) return <Redirect href="/sign-in" />;
  if (profile) return <Redirect href="/" />;

  async function finish() {
    setBusy(true);
    setError("");
    try {
      await createProfile({ full_name: fullName.trim(), slug: suggestedSlug, company: company.trim(), title: title.trim(), email: email.trim(), phone: phone.trim() || null, website: website.trim() || null });
      router.replace("/");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "We couldn't create your card.";
      setError(message.includes("profiles_slug_key") ? "That card URL is already taken. Try another." : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.progressRow}>{[0, 1, 2].map((item) => <View key={item} style={[styles.progress, item <= step && styles.progressActive]} />)}</View>
      <Text style={styles.stepLabel}>Step {step + 1} of 3</Text>
      {step === 0 ? (
        <>
          <Text style={styles.title}>Make it yours.</Text>
          <Text style={uiStyles.body}>Start with the details people should save when they meet you.</Text>
          <Card>
            <Field label="Full name" value={fullName} onChangeText={(value) => { setFullName(value); if (!slug) setSlug(slugify(value)); }} autoComplete="name" />
            <Field label="Company" value={company} onChangeText={setCompany} />
            <Field label="Title" value={title} onChangeText={setTitle} />
            <Button onPress={() => setStep(1)} disabled={!fullName.trim()}>Continue</Button>
          </Card>
        </>
      ) : step === 1 ? (
        <>
          <Text style={styles.title}>How can people reach you?</Text>
          <Text style={uiStyles.body}>Only the details you add here appear on your public card.</Text>
          <Card>
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Field label="Website (optional)" value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" placeholder="https://" />
            <Button onPress={() => setStep(2)} disabled={!email.trim()}>Continue</Button>
            <Pressable onPress={() => setStep(0)}><Text style={styles.back}>Back</Text></Pressable>
          </Card>
        </>
      ) : (
        <>
          <Text style={styles.title}>Choose your card link.</Text>
          <Text style={uiStyles.body}>Your QR always points here, even when you switch follow-up modes.</Text>
          <Card>
            <Field label="Public card URL" value={slug} onChangeText={setSlug} autoCapitalize="none" autoCorrect={false} />
            <View style={styles.urlPreview}><Text style={styles.urlMuted}>bizcard-nu.vercel.app/</Text><Text style={styles.urlStrong}>{suggestedSlug || "your-name"}</Text></View>
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button onPress={() => void finish()} loading={busy} disabled={!suggestedSlug}>Create my card</Button>
            <Pressable onPress={() => setStep(1)}><Text style={styles.back}>Back</Text></Pressable>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: "row", gap: 7, marginTop: 8 },
  progress: { height: 5, flex: 1, borderRadius: 99, backgroundColor: colors.line },
  progressActive: { backgroundColor: colors.accent },
  stepLabel: { color: colors.accent, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 37, lineHeight: 41, fontWeight: "800", letterSpacing: -1.6 },
  back: { color: colors.muted, fontWeight: "700", textAlign: "center", padding: 8 },
  urlPreview: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 4 },
  urlMuted: { color: colors.muted, fontSize: 13 },
  urlStrong: { color: colors.ink, fontSize: 13, fontWeight: "800" },
});
