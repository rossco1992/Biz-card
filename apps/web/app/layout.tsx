import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knct’d",
  description: "The professional follow-up app. Swap contacts once. Follow up automatically.",
  metadataBase: new URL("https://www.getknctd.com"),
  icons: { icon: "/brand/favicon.png", apple: "/brand/apple-touch-icon.png" },
  applicationName: "Knct’d",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7F2E7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
