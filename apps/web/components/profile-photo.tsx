"use client";

import { useState } from "react";

export function ProfilePhoto({ name, url }: { name: string; url?: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <div className="profileMark" style={{ overflow: "hidden", flexShrink: 0 }}>
    {url && failed !== url
      ? <img src={url} alt={`${name}'s profile photo`} onError={() => setFailed(url)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      : name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase()}
  </div>;
}
