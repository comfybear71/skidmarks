"use client";

import { copyTextToClipboard } from "@/lib/copyText";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

const POD_START_COMMAND = "bash /workspace/boot_hotfix.sh";

type PodRow = {
  id: string;
  name: string;
  desiredStatus: string;
  comfyUrl: string;
  gpu: string;
  gpuCount?: number;
  comfy?: "up" | "down" | "skip";
};

type Status =
  | { state: "loading" }
  | { state: "ok"; running: number; total: number; pods: PodRow[] }
  | { state: "err"; error: string };

function isRunning(s: string) {
  return /RUNNING/i.test(s);
}

function isStopped(s: string) {
  return /EXITED|STOPPED/i.test(s);
}

/**
 * Nav chip — RunPod API key + how many pods are running.
 * Panel portals to document.body — header backdrop-blur was trapping fixed pos.
 */
export function RunpodStatus() {
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState("");
  const [copyOk, setCopyOk] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const placePanel = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPanelStyle({
      position: "fixed",
      top: Math.round(r.bottom + 6),
      right: Math.round(window.innerWidth - r.right),
      width: 320,
      zIndex: 9999,
    });
  }, []);

  const check = useCallback(async (probe: boolean, soft = false) => {
    if (!soft) setStatus({ state: "loading" });
    else setBusy(true);
    try {
      const res = await fetch(
        `/api/runpod/status${probe ? "?probe=1" : ""}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        connected?: boolean;
        running?: number;
        total?: number;
        pods?: PodRow[];
        error?: string;
      };
      if (data.connected) {
        setStatus({
          state: "ok",
          running: data.running || 0,
          total: data.total || 0,
          pods: data.pods || [],
        });
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
    } finally {
      setBusy(false);
    }
  }, []);

  const control = useCallback(
    async (pod: PodRow, action: "start" | "stop") => {
      if (action === "stop") {
        const ok = window.confirm(
          `Stop ${pod.name}?\nGPU billing stops. Disk stays.`,
        );
        if (!ok) return;
      }
      setActionErr("");
      setActionId(pod.id);
      try {
        const res = await fetch("/api/runpod/control", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            podId: pod.id,
            action,
            gpuCount: pod.gpuCount || 1,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!data.ok) {
          setActionErr(data.error || "Control failed");
          return;
        }
        await check(true, true);
      } catch (e) {
        setActionErr(e instanceof Error ? e.message : String(e));
      } finally {
        setActionId(null);
      }
    },
    [check],
  );

  const copyStartCommand = useCallback(async () => {
    try {
      await copyTextToClipboard(POD_START_COMMAND);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 2000);
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void check(false);
  }, [check]);

  useEffect(() => {
    if (!open) return;
    placePanel();
    const onScroll = () => placePanel();
    const onResize = () => placePanel();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      const panel = document.getElementById("runpod-status-panel");
      if (panel?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open, placePanel]);

  if (status.state === "loading") {
    return (
      <span
        className="rounded-sm border border-[var(--line)] px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--mute)]"
        title="Checking RunPod…"
      >
        Pod…
      </span>
    );
  }

  if (status.state === "err") {
    return (
      <button
        type="button"
        onClick={() => void check(false)}
        className="rounded-sm border border-[var(--fail)]/50 px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--magenta-hot)] hover:bg-[var(--magenta)]/10"
        title={status.error}
      >
        Pod off
      </button>
    );
  }

  const label =
    status.running > 0
      ? `Pod · ${status.running} on`
      : status.total > 0
        ? `Pod · ${status.total} stopped`
        : "Pod · none";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            placePanel();
            setActionErr("");
            void check(true, true);
          }
        }}
        className={`rounded-sm border px-2 py-1 text-[10px] uppercase tracking-wider ${
          status.running > 0
            ? "border-[var(--acid)]/50 text-[var(--acid)] hover:bg-[var(--acid)]/10"
            : "border-[var(--line)] text-[var(--chrome-dim)] hover:border-[var(--acid)] hover:text-[var(--acid)]"
        }`}
        title="Click for pod list + Start / Stop"
      >
        {label}
      </button>
      {mounted && open
        ? createPortal(
            <div
              id="runpod-status-panel"
              style={panelStyle}
              className="rounded-sm border border-[var(--line)] bg-[var(--panel)] p-2 text-left shadow-lg"
            >
              <p className="mb-1.5 text-[9px] uppercase tracking-wider text-[var(--mute)]">
                RunPod · Start / Stop
                {busy ? " · …" : ""}
              </p>
              {actionErr ? (
                <p className="mb-1.5 text-[10px] text-[var(--magenta-hot)]">
                  {actionErr}
                </p>
              ) : null}
              <div className="mb-2 rounded-sm border border-[var(--line)]/80 bg-[var(--bg)]/40 px-1.5 py-1">
                <p className="text-[9px] leading-snug text-[var(--mute)]">
                  RunPod Start Command (once):{" "}
                  <code className="text-[var(--chrome-dim)]">
                    {POD_START_COMMAND}
                  </code>
                </p>
                <p className="mt-0.5 text-[9px] leading-snug text-[var(--mute)]">
                  Copy PC{" "}
                  <code className="text-[var(--chrome-dim)]">
                    workflow\boot_hotfix.sh
                  </code>{" "}
                  → pod{" "}
                  <code className="text-[var(--chrome-dim)]">
                    /workspace/boot_hotfix.sh
                  </code>{" "}
                  once. Every Start heals Comfy — no Jupyter.
                </p>
                <button
                  type="button"
                  className="mt-1 text-[10px] text-[var(--acid)] hover:underline"
                  onClick={() => void copyStartCommand()}
                >
                  {copyOk ? "Copied" : "Copy Start Command"}
                </button>
              </div>
              {status.pods.length === 0 ? (
                <p className="text-[11px] text-[var(--chrome-dim)]">No pods</p>
              ) : (
                <ul className="max-h-[min(50vh,360px)] space-y-1.5 overflow-y-auto">
                  {status.pods.map((p) => {
                    const working = actionId === p.id;
                    const running = isRunning(p.desiredStatus);
                    const stopped = isStopped(p.desiredStatus);
                    return (
                      <li
                        key={p.id}
                        className="rounded-sm border border-[var(--line)] px-1.5 py-1 text-[11px]"
                      >
                        <p className="truncate text-[var(--chrome)]">{p.name}</p>
                        <p className="truncate text-[9px] text-[var(--mute)]">
                          {p.desiredStatus}
                          {p.gpu ? ` · ${p.gpu}` : ""}
                          {p.gpuCount && p.gpuCount > 1
                            ? ` ×${p.gpuCount}`
                            : ""}
                          {p.comfy === "up"
                            ? " · Comfy up"
                            : p.comfy === "down"
                              ? " · Comfy down"
                              : ""}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {stopped ? (
                            <button
                              type="button"
                              disabled={working || Boolean(actionId)}
                              className="text-[10px] text-[var(--acid)] hover:underline disabled:opacity-40"
                              onClick={() => void control(p, "start")}
                            >
                              {working ? "Starting…" : "Start"}
                            </button>
                          ) : null}
                          {running ? (
                            <button
                              type="button"
                              disabled={working || Boolean(actionId)}
                              className="text-[10px] text-[var(--magenta-hot)] hover:underline disabled:opacity-40"
                              onClick={() => void control(p, "stop")}
                            >
                              {working ? "Stopping…" : "Stop"}
                            </button>
                          ) : null}
                          {!running && !stopped ? (
                            <span className="text-[10px] text-[var(--mute)]">
                              {working ? "…" : p.desiredStatus}
                            </span>
                          ) : null}
                          {p.comfyUrl && running ? (
                            <a
                              href={p.comfyUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-[var(--acid)] hover:underline"
                            >
                              Open :3000
                            </a>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <button
                type="button"
                className="mt-1.5 text-[10px] text-[var(--mute)] hover:text-[var(--chrome)]"
                onClick={() => void check(true, true)}
              >
                Refresh
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
