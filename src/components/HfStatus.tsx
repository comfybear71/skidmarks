"use client";

import { useCallback, useEffect, useState } from "react";

type Status =
  | { state: "loading" }
  | { state: "ok"; user: string }
  | { state: "err"; error: string };

/**
 * Tiny nav chip — proves HF_TOKEN from MY MOVIES\.env works.
 */
export function HfStatus() {
  const [status, setStatus] = useState<Status>({ state: "loading" });

  const check = useCallback(async () => {
    setStatus({ state: "loading" });
    try {
      const res = await fetch("/api/hf/status", { cache: "no-store" });
      const data = (await res.json()) as {
        connected?: boolean;
        user?: string;
        error?: string;
      };
      if (data.connected && data.user) {
        setStatus({ state: "ok", user: data.user });
      } else {
        setStatus({
          state: "err",
          error: data.error || "Not connected",
        });
      }
    } catch (e) {
      setStatus({
        state: "err",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  if (status.state === "loading") {
    return (
      <span
        className="rounded-sm border border-[var(--line)] px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--mute)]"
        title="Checking Hugging Face…"
      >
        HF…
      </span>
    );
  }

  if (status.state === "ok") {
    return (
      <a
        href={`https://huggingface.co/${encodeURIComponent(status.user)}`}
        target="_blank"
        rel="noreferrer"
        className="rounded-sm border border-[var(--acid)]/50 px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--acid)] hover:bg-[var(--acid)]/10"
        title="Hugging Face connected — click to open your profile"
      >
        HF · {status.user}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void check()}
      className="rounded-sm border border-[var(--fail)]/50 px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--magenta-hot)] hover:bg-[var(--magenta)]/10"
      title={status.error}
    >
      HF off
    </button>
  );
}
