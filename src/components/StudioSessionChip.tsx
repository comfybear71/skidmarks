"use client";

import { useEffect, useState } from "react";

/** Desktop header: who is signed in, and a way out. Hidden when login is off. */
export function StudioSessionChip() {
  const [email, setEmail] = useState<string | null>(null);
  const [gated, setGated] = useState(false);

  useEffect(() => {
    fetch("/api/studio/me", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: { gated?: boolean; user?: { email?: string } | null }) => {
        setGated(Boolean(d.gated));
        setEmail(d.user?.email || null);
      })
      .catch(() => {});
  }, []);

  if (!gated) return null;

  return (
    <div className="hidden items-center gap-2 text-xs md:flex">
      <span className="text-[var(--chrome-dim)]">{email || "Signed in"}</span>
      <button
        type="button"
        className="rounded-sm border border-[var(--line)] px-2 py-1 text-[var(--chrome-dim)] hover:border-[var(--acid)] hover:text-[var(--acid)]"
        onClick={() => {
          void fetch("/api/studio/logout", { method: "POST", credentials: "same-origin" }).then(
            () => {
              window.location.href = "/login";
            },
          );
        }}
      >
        Log out
      </button>
    </div>
  );
}
