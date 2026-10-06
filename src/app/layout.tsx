import type { Metadata, Viewport } from "next";
import "./globals.css";
import { withBase } from "@/lib/basePath";

export const metadata: Metadata = {
  title: "Blind Interval Timer",
  description: "A random hidden interval timer for workouts",
  manifest: withBase("/manifest.webmanifest"),
  appleWebApp: {
    capable: true,
    title: "Blind Timer",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: withBase("/icons/icon-192.png"),
    apple: withBase("/icons/apple-touch-icon.png"),
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <meta name="mobile-web-app-capable" content="yes" />
        {children}
      </body>
    </html>
  );
}
