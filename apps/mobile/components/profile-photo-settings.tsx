import { useRef, useState } from "react";
import { Text } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";
import { Button, Card, Notice, uiStyles } from "./ui";
import { ProfilePhoto } from "./profile-photo";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/session-provider";

export function ProfilePhotoSettings() {
  const { profile, session, updateProfile } = useSession();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  if (!profile || !session || !supabase) return null;
  const client = supabase;
  const owner = session.user.id;
  const oldUrl = profile.avatar_url;

  async function removeOldPhoto() {
    // Only delete our own managed object, never a URL supplied by another host.
    const prefix = client.storage.from("profile-photos").getPublicUrl(`${owner}/`).data.publicUrl;
    if (oldUrl?.startsWith(prefix)) {
      const filename = oldUrl.slice(prefix.length);
      if (/^[a-zA-Z0-9-]+\.jpg$/.test(filename)) {
        await client.storage.from("profile-photos").remove([`${owner}/${filename}`]).catch(() => undefined);
      }
    }
  }

  async function change(remove = false) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(""); setMessage("");
    let uploaded: string | null = null;
    let saved = false;
    try {
      let url: string | null = null;
      if (!remove) {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
        if (result.canceled) return;
        const asset = result.assets[0];
        const side = Math.min(asset.width, asset.height);
        const image = await manipulateAsync(asset.uri, [
          { crop: { originX: Math.floor((asset.width - side) / 2), originY: Math.floor((asset.height - side) / 2), width: side, height: side } },
          { resize: { width: 512, height: 512 } },
        ], { compress: 0.8, format: SaveFormat.JPEG, base64: true });
        if (!image.base64) throw new Error("Could not prepare that photo. Please choose another.");
        const bytes = decode(image.base64);
        if (bytes.byteLength > 2 * 1024 * 1024) throw new Error("That photo is too large. Please choose a smaller photo.");
        const path = `${owner}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error: uploadError } = await client.storage.from("profile-photos").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
        if (uploadError) throw new Error("Could not upload your photo. Please try again.");
        uploaded = path;
        url = client.storage.from("profile-photos").getPublicUrl(path).data.publicUrl;
      }
      await updateProfile({ avatar_url: url });
      saved = true;
      await removeOldPhoto();
      setMessage(remove ? "Photo removed." : "Profile photo updated.");
    } catch (cause) {
      if (uploaded && !saved) await client.storage.from("profile-photos").remove([uploaded]).catch(() => undefined);
      setError(cause instanceof Error ? cause.message : "Could not update your photo. Please try again.");
    } finally { locked.current = false; setBusy(false); }
  }

  return <Card>
    <Text style={uiStyles.sectionTitle}>Profile photo</Text>
    <ProfilePhoto name={profile.full_name} url={profile.avatar_url} />
    <Text style={uiStyles.body}>This photo appears on your public card when someone scans your QR code.</Text>
    <Button disabled={busy} loading={busy} onPress={() => void change()}>{profile.avatar_url ? "Change photo" : "Choose photo"}</Button>
    {profile.avatar_url ? <Button variant="secondary" disabled={busy} onPress={() => void change(true)}>Remove photo</Button> : null}
    {error ? <Notice tone="error">{error}</Notice> : null}
    {message ? <Notice tone="success">{message}</Notice> : null}
  </Card>;
}
