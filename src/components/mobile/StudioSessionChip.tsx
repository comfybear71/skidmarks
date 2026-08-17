"use client";

import { useEffect, useState } from "react";

/** Email + log out on /m and /scratch. Hidden when login is off or the visitor is not signed in. */
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

  if (!gated || !email) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 16px 0",
      }}
    >
      <div style={{ color: "var(--chrome-dim)", fontSize: "12px" }}>
        <span style={{ color: "var(--chrome)", fontWeight: 700 }}>{email}</span>
      </div>
      <button
        type="button"
        onClick={() => {
          void fetch("/api/studio/logout", { method: "POST", credentials: "same-origin" }).then(() => {
            window.location.href = "/";
          });
        }}
        style={{
          padding: "5px 10px",
          borderRadius: "2px",
          border: "1px solid var(--line)",
          background: "transparent",
          color: "var(--chrome-dim)",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        Log out
      </button>
    </div>
  );
}
