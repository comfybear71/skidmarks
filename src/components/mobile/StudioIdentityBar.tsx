"use client";

import { useEffect, useState } from "react";
import { DeskSwitcher } from "@/components/mobile/DeskSwitcher";
import { readDeskId, writeDeskId } from "@/lib/mobileDesk";

export type StudioIdentity = {
  gated: boolean;
  deskId: string;
  email?: string;
};

/**
 * When STUDIO_USERS is set: signed-in email + log out.
 * When it is not: the old desk switcher (local PC only — not real isolation).
 */
export function StudioIdentityBar({
  onReady,
}: {
  onReady?: (info: StudioIdentity) => void;
}) {
  const [me, setMe] = useState<StudioIdentity | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/studio/me", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: { gated?: boolean; user?: { id: string; email: string } | null }) => {
        if (cancelled) return;
        if (d.gated && d.user?.id) {
          try {
            writeDeskId(window.localStorage, d.user.id);
          } catch {
            /* private mode */
          }
          const info: StudioIdentity = {
            gated: true,
            deskId: d.user.id,
            email: d.user.email,
          };
          setMe(info);
          onReady?.(info);
          return;
        }
        const info: StudioIdentity = {
          gated: false,
          deskId: readDeskId(window.localStorage),
        };
        setMe(info);
        onReady?.(info);
      })
      .catch(() => {
        if (cancelled) return;
        const info: StudioIdentity = {
          gated: false,
          deskId: readDeskId(window.localStorage),
        };
        setMe(info);
        onReady?.(info);
      });
    return () => {
      cancelled = true;
    };
    // Parent setState is stable; do not re-fetch when the callback identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await fetch("/api/studio/logout", { method: "POST", credentials: "same-origin" });
    window.location.href = "/login";
  }

  if (!me) return null;
  if (!me.gated) {
    return (
      <DeskSwitcher
        onChange={(deskId) => {
          onReady?.({ gated: false, deskId });
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px 0",
      }}
    >
      <div style={{ color: "var(--chrome-dim)", fontSize: "12px" }}>
        Signed in as{" "}
        <span style={{ color: "var(--chrome)", fontWeight: 700 }}>{me.email || "…"}</span>
      </div>
      <button
        type="button"
        onClick={() => void logout()}
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
