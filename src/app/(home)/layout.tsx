import type { Metadata, Viewport } from "next";
import { Black_Ops_One, DM_Sans } from "next/font/google";
import "../globals.css";
import "./home.css";

/**
 * Public show page — own <html>/<body>, not the Crash Lab Studio chrome.
 * That launcher (Crash Lab / M / Scratch) now lives in the footer here.
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
  themeColor: "#060607",
};

export const metadata: Metadata = {
  title: "Skidmarks — Nobody Gets Out",
  description:
    "Thirty-eight people who never got out, going nowhere, forever, past the same houses.",
};

export default function HomeRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
