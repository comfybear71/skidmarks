import type { Metadata, Viewport } from "next";
import { Black_Ops_One, DM_Sans } from "next/font/google";
import "../../globals.css";
import "./mobile.css";

/**
 * Independent root layout for the mobile/PWA automated pipeline — no
 * desktop header/nav, own <html>/<body>. Deliberately separate from
 * (desktop)/layout.tsx: this is a different app, not a responsive view
 * of the same one. Reuses globals.css purely for the shared design
 * tokens (--acid/--magenta/--panel/--line/--chrome), not its layout.
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
};

export const metadata: Metadata = {
  title: "Skidmarks — Auto Studio",
  description: "Prompt in, finished animated scene out — fully automated.",
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
