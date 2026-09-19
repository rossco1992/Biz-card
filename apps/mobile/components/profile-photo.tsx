import { useState } from "react";
import { Image, Text, View } from "react-native";
import { initials } from "@biz-card/core";
import { colors } from "@/constants/theme";

export function ProfilePhoto({ name, url, size = 88 }: { name: string; url?: string | null; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <View style={{ width: size, height: size, borderRadius: size * 0.3, overflow: "hidden", backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}>
    {url && failed !== url
      ? <Image source={{ uri: url }} accessibilityLabel={`${name}'s profile photo`} onError={() => setFailed(url)} style={{ width: size, height: size }} resizeMode="cover" />
      : <Text style={{ color: "white", fontWeight: "800", fontSize: size * 0.32 }}>{initials(name)}</Text>}
  </View>;
}
