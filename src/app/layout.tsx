import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Black_Ops_One, DM_Sans } from "next/font/google";
import { HfStatus } from "@/components/HfStatus";
import { RunpodStatus } from "@/components/RunpodStatus";
import { runningOnVercel } from "@/lib/cloudEnv";
import "./globals.css";

const display = Black_Ops_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const isLive = runningOnVercel();
  return {
    title: isLive ? "Skidmarks Studio · Vercel" : "Skidmarks Studio · localhost",
    description: isLive
      ? "Crash Lab — cast, story, plates, LTX. Live on Vercel."
      : "Crash Lab — cast, story, plates, LTX. Local PC + RunPod.",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  const isLive = runningOnVercel();
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <div className="min-h-screen">
          <header className="border-b border-[var(--line)] bg-[var(--panel)]/85 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
              <Link href="/" className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/skidmarks-logo.png"
                  alt="SKID MARKS"
                  className="h-14 w-auto drop-shadow-[0_0_18px_rgba(200,255,46,0.25)] md:h-16"
                />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--magenta-hot)]">
                    {isLive ? "Studio · Vercel" : "Studio · localhost only"}
                  </p>
                  <h1 className="display text-2xl text-[var(--chrome)] md:text-3xl">
                    Skidmarks
                  </h1>
                </div>
              </Link>
              <nav className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href="/crash"
                  className="rounded-sm border border-[var(--acid)] bg-[var(--acid)]/10 px-3 py-1.5 text-[var(--acid)] hover:bg-[var(--acid)]/20"
                >
                  Crash Lab
                </Link>
                <Link
                  href="/"
                  className="rounded-sm border border-[var(--line)] px-3 py-1.5 text-[var(--chrome-dim)] hover:border-[var(--acid)] hover:text-[var(--acid)]"
                >
                  Home
                </Link>
                <HfStatus />
                <RunpodStatus />
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
