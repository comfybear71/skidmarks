"use client";

import Link from "next/link";
import { HfStatus } from "@/components/HfStatus";
import { RunpodStatus } from "@/components/RunpodStatus";

/**
 * Site nav — inline row on desktop only. Hidden entirely below md: these
 * links (Crash Lab / Home / HF / POD status) aren't needed on a phone and
 * previously lived behind a hamburger that just ate header space for
 * little benefit.
 */
export function SiteNav() {
  return (
    <nav className="hidden w-auto flex-wrap items-center gap-2 text-sm md:flex">
      <Link
        href="/crash"
        className="touch-manipulation rounded-sm border border-[var(--acid)] bg-[var(--acid)]/10 px-3 py-2.5 text-[var(--acid)] hover:bg-[var(--acid)]/20"
      >
        Crash Lab
      </Link>
      <Link
        href="/"
        className="touch-manipulation rounded-sm border border-[var(--line)] px-3 py-2.5 text-[var(--chrome-dim)] hover:border-[var(--acid)] hover:text-[var(--acid)]"
      >
        Home
      </Link>
      <HfStatus />
      <RunpodStatus />
    </nav>
  );
}
