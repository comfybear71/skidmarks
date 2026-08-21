import type { Metadata, Viewport } from "next";
import { Black_Ops_One, DM_Sans } from "next/font/google";
import "../globals.css";
import "./m/mobile.css";

/**
 * Phone chrome for /m (episode) and /scratch (one-plate test bed).
 * Own <html>/<body> — not the desktop Crash Lab layout.
 */

const display = Black_Ops_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#07060a",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Skidmarks — Vibe Director",
  description: "Vibe direct a film. Cast, places, and plates stay on the tree.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    title: "Skidmarks",
    statusBarStyle: "black-translucent",
  },
};

export default function MobileRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} antialiased`}
        style={{ background: "var(--void)", minHeight: "100dvh" }}
      >
        {children}
      </body>
    </html>
  );
}
