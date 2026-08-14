"use client";

import { useState } from "react";
import Link from "next/link";
import { HfStatus } from "@/components/HfStatus";
import { RunpodStatus } from "@/components/RunpodStatus";

/**
 * Site nav — inline row on desktop, hamburger drawer below md (nav ate
 * 2-3 rows on a phone). Renders as siblings (no wrapping div) so the
 * header's own flex-wrap row handles the button-beside-logo /
 * nav-wraps-full-width behavior without fighting an inner container's
 * shrink-to-fit width.
 */
export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="touch-manipulation flex h-10 w-10 items-center justify-center rounded-sm border border-[var(--line)] text-lg text-[var(--chrome)] md:hidden"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "✕" : "☰"}
      </button>
      <nav
        className={`${open ? "flex" : "hidden"} w-full flex-wrap items-center gap-2 text-sm md:flex md:w-auto`}
      >
        <Link
          href="/crash"
          className="touch-manipulation rounded-sm border border-[var(--acid)] bg-[var(--acid)]/10 px-3 py-2.5 text-[var(--acid)] hover:bg-[var(--acid)]/20"
          onClick={() => setOpen(false)}
        >
          Crash Lab
        </Link>
        <Link
          href="/"
          className="touch-manipulation rounded-sm border border-[var(--line)] px-3 py-2.5 text-[var(--chrome-dim)] hover:border-[var(--acid)] hover:text-[var(--acid)]"
          onClick={() => setOpen(false)}
        >
          Home
        </Link>
        <HfStatus />
        <RunpodStatus />
      </nav>
    </>
  );
}
