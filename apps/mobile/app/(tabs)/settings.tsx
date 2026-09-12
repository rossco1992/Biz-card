import { DEFAULT_WEB_URL, publicCardUrl } from "@biz-card/core";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Button, Card, Field, Notice, PageHeader, Screen, uiStyles } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useSession } from "@/providers/session-provider";

export default function SettingsScreen() {
  const { profile, session, updateProfile, signOut } = useSession();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [company, setCompany] = useState(profile?.company ?? "");
  const [title, setTitle] = useState(profile?.title ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [website, setWebsite] = useState(profile?.website ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name); setCompany(profile.company); setTitle(profile.title); setEmail(profile.email); setPhone(profile.phone ?? ""); setWebsite(profile.website ?? "");
  }, [profile]);
  if (!profile) return null;

  async function save() {
    setBusy(true); setMessage(""); setError("");
    try {
      await updateProfile({ full_name: fullName.trim(), company: company.trim(), title: title.trim(), email: email.trim(), phone: phone.trim() || null, website: website.trim() || null });
      setMessage("Profile saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your profile."); }
    finally { setBusy(false); }
  }

  function confirmSignOut() {
    Alert.alert("Sign out?", "You'll need a new email link to sign back in.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  const cardUrl = publicCardUrl(profile.slug, process.env.EXPO_PUBLIC_WEB_URL || DEFAULT_WEB_URL);
  return (
    <Screen>
      <PageHeader eyebrow="Account & card" title="Settings" />
      <Text style={uiStyles.body}>Keep the contact details on your public card current.</Text>
      <Card>
        <Text style={uiStyles.sectionTitle}>Card profile</Text>
        <Field label="Full name" value={fullName} onChangeText={setFullName} />
        <Field label="Company" value={company} onChangeText={setCompany} />
        <Field label="Title" value={title} onChangeText={setTitle} />
        <Field label="Public email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Website" value={website} onChangeText={setWebsite} keyboardType="url" autoCapitalize="none" />
        {message ? <Notice tone="success">{message}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button onPress={() => void save()} loading={busy} disabled={!fullName.trim() || !email.trim()}>Save changes</Button>
      </Card>
      <Card>
        <Text style={uiStyles.sectionTitle}>Public card</Text>
        <View><Text style={styles.label}>Card URL</Text><Text style={styles.value}>{cardUrl}</Text></View>
        <Button variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(cardUrl)}>Open public card</Button>
      </Card>
      <Card>
        <Text style={uiStyles.sectionTitle}>Account</Text>
        <View><Text style={styles.label}>Signed in as</Text><Text style={styles.value}>{session?.user.email}</Text></View>
        <View><Text style={styles.label}>Sending domain</Text><Text style={styles.value}>Managed in the web admin</Text></View>
        <Button variant="danger" onPress={confirmSignOut}>Sign out</Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 },
  value: { color: colors.ink, fontSize: 14, lineHeight: 20 },
});
