import { useState } from "react";
import { Modal, View, Text, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { WebView } from "react-native-webview";
import { resolveWebUrl } from "@biz-card/core";
import { useSession } from "@/providers/session-provider";
import { supabase } from "@/lib/supabase";
import { Button, Notice, Screen, uiStyles } from "./ui";
type Imported = { html: string; text: string; warnings: string[] };
export function HtmlSignatureImport() {
  const { refresh, profile } = useSession();
  const [preview, setPreview] = useState<Imported | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function request(html: string, save: boolean): Promise<Imported> {
    const { data } = await supabase!.auth.getSession();
    if (!data.session) throw new Error("Sign in again to import a signature.");
    const response = await fetch(`${(resolveWebUrl(process.env.EXPO_PUBLIC_WEB_URL)).replace(/\/$/, '')}/api/signature`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ html, save }), signal: AbortSignal.timeout(20000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.html) throw new Error(result?.error || "Signature import is unavailable. Please try again.");
    return result;
  }
  async function choose() {
    setError(""); setMessage(""); setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!/\.html?$/i.test(asset.name)) throw new Error("Choose an .html or .htm signature file.");
      if ((asset.size ?? 0) > 102400) throw new Error("Choose a file smaller than 100 KB.");
      const html = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
      if (html.length > 102400) throw new Error("Choose a file smaller than 100 KB.");
      setPreview(await request(html, false));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not import that file."); }
    finally { setBusy(false); }
  }
  async function showSaved() {
    if (!profile?.email_signature_html) return;
    setBusy(true); setError("");
    try { setPreview(await request(profile.email_signature_html, false)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not preview your signature."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!preview) return;
    setBusy(true); setError("");
    try { await request(preview.html, true); await refresh(); setPreview(null); setMessage("HTML signature saved."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your signature."); }
    finally { setBusy(false); }
  }
  const document = preview ? `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; style-src 'unsafe-inline';"><style>body{font-family:Arial;padding:12px;overflow-wrap:anywhere}img{max-width:100%}</style></head><body>${preview.html}</body></html>` : '';
  return <>
    <Button variant="secondary" onPress={() => void choose()} disabled={busy} loading={busy}>Import HTML signature</Button>
    {profile?.email_signature_html ? <Button variant="secondary" onPress={() => void showSaved()} disabled={busy}>Preview saved signature</Button> : null}
    <Text style={uiStyles.small}>Choose an .html or .htm file (up to 100 KB). Use hosted HTTPS images; images saved only on your computer won't be included.</Text>
    {!preview && error ? <Notice tone="error">{error}</Notice> : null}
    {message ? <Notice tone="success">{message}</Notice> : null}
    <Modal visible={!!preview} animationType="slide" onRequestClose={() => { if (!busy) setPreview(null); }}>
      <Screen>
        <Text style={uiStyles.sectionTitle}>Preview your signature</Text>
        <Text style={uiStyles.small}>Formatting can vary between email apps. Review the imported signature before saving.</Text>
        <View style={{ height: 320, backgroundColor: 'white' }}>
          {Platform.OS === 'web' ? <iframe title="Signature preview" sandbox="" srcDoc={document} style={{ width: '100%', height: '100%', border: 0 }} /> :
            <WebView source={{ html: document }} originWhitelist={['*']} javaScriptEnabled={false} domStorageEnabled={false} allowFileAccess={false} allowingReadAccessToURL={undefined} onShouldStartLoadWithRequest={r => r.url === 'about:blank'} />}
        </View>
        {preview?.warnings.map(w => <Notice key={w}>{w}</Notice>)}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button onPress={() => void save()} loading={busy} disabled={busy}>Use this signature</Button>
        <Button variant="secondary" onPress={() => setPreview(null)} disabled={busy}>Cancel</Button>
      </Screen>
    </Modal>
  </>;
}
