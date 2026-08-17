"use client";

import Link from "next/link";

/**
 * Site nav — inline row on desktop only. Hidden entirely below md: these
 * links aren't needed on a phone and previously lived behind a hamburger
 * that just ate header space for little benefit.
 *
 * HF and RunPod status pills lived here — both were testing-phase
 * integrations superseded by Comfy Cloud and removed outright, not just
 * hidden.
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
    </nav>
  );
}
