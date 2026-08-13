"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PlateRow = {
  name: string;
  mtime: number;
  size: number;
  url: string;
};

/** Folder under _PLATES (`_CARS/foo.png` → `_CARS`). Loose files → Other. */
function plateCategory(name: string): string {
  const slash = name.replace(/\\/g, "/").indexOf("/");
  if (slash <= 0) return "Other";
  return name.replace(/\\/g, "/").slice(0, slash);
}

/** Prefer known SPX folders, then A–Z, Other last. */
function categorySortKey(cat: string): string {
  const order = ["_CARS", "_HOUSE", "_CELESTIAL"];
  const i = order.indexOf(cat);
  if (i >= 0) return `0${i}_${cat}`;
  if (cat === "Other") return `2_${cat}`;
  return `1_${cat}`;
}

function groupPlatesByCategory(plates: PlateRow[]): { cat: string; rows: PlateRow[] }[] {
  const map = new Map<string, PlateRow[]>();
  for (const p of plates) {
    const cat = plateCategory(p.name);
    const list = map.get(cat) || [];
    list.push(p);
    map.set(cat, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => b.mtime - a.mtime);
  }
  return [...map.entries()]
    .sort((a, b) => categorySortKey(a[0]).localeCompare(categorySortKey(b[0])))
    .map(([cat, rows]) => ({ cat, rows }));
}

type Preflight = {
  ok: boolean;
  missing: string[];
  hint: string;
  reachable: boolean;
  checking: boolean;
};

type BoomSize = "small" | "normal" | "big";
type Duration = "short" | "normal";

async function readNdjsonStream(
  res: Response,
  onEvent: (ev: Record<string, unknown>) => void,
): Promise<void> {
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let sawTerminal = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try {
        const ev = JSON.parse(t) as Record<string, unknown>;
        onEvent(ev);
        if (ev.step === "done" || ev.step === "error") sawTerminal = true;
      } catch {
        /* ignore partial */
      }
    }
  }
  const tail = buf.trim();
  if (tail) {
    try {
      const ev = JSON.parse(tail) as Record<string, unknown>;
      onEvent(ev);
      if (ev.step === "done" || ev.step === "error") sawTerminal = true;
    } catch {
      /* ignore */
    }
  }
  if (!sawTerminal) {
    throw new Error(
      "Boom stream ended with no Done/Error — check Comfy (job may still be running)",
    );
  }
}

type Props = {
  /** Fires when Go/Keep busy state changes (for tab dot on other tabs). */
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Filmmaker boom FX — pick plate, boom size, Go, Keep.
 * Abstracts Comfy/Wan. Pod must be Started by Stuie first.
 */
export function WanFxBabyPanel({ onBusyChange }: Props) {
  const [plates, setPlates] = useState<PlateRow[]>([]);
  const [platesMsg, setPlatesMsg] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [boom, setBoom] = useState<BoomSize>("normal");
  const [duration, setDuration] = useState<Duration>("short");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [keepMsg, setKeepMsg] = useState("");
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const plateGroups = useMemo(() => groupPlatesByCategory(plates), [plates]);

  const loadPlates = useCallback(async () => {
    try {
      const res = await fetch("/api/crash/wan/plates");
      const data = (await res.json()) as {
        plates?: PlateRow[];
        count?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Could not list plates");
      const list = Array.isArray(data.plates) ? data.plates : [];
      setPlates(list);
      setPlatesMsg(
        list.length
          ? `${list.length} in _XX_SPX\\_PLATES`
          : "No pictures yet — drop stills into _XX_SPX\\_PLATES",
      );
      setSelected((prev) => {
        if (prev && list.some((p) => p.name === prev)) return prev;
        return list[0]?.name || "";
      });
    } catch (e) {
      setPlatesMsg(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const runPreflight = useCallback(async () => {
    setPreflight((prev) => ({
      ok: prev?.ok ?? false,
      missing: prev?.missing ?? [],
      hint: prev?.hint ?? "",
      reachable: prev?.reachable ?? false,
      checking: true,
    }));
    try {
      const res = await fetch("/api/crash/wan/preflight");
      const data = (await res.json()) as {
        ok?: boolean;
        missing?: string[];
        hint?: string;
        reachable?: boolean;
        error?: string;
      };
      setPreflight({
        ok: Boolean(data.ok),
        missing: Array.isArray(data.missing) ? data.missing : [],
        hint: String(data.hint || data.error || ""),
        reachable: data.reachable !== false,
        checking: false,
      });
    } catch (e) {
      setPreflight({
        ok: false,
        missing: [],
        hint:
          e instanceof Error
            ? e.message
            : "Preflight failed — is Studio running?",
        reachable: false,
        checking: false,
      });
    }
  }, []);

  useEffect(() => {
    void loadPlates();
    void runPreflight();
  }, [loadPlates, runPreflight]);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    const onFocus = () => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    window.addEventListener("crash-wan-fx-focus", onFocus);
    return () => window.removeEventListener("crash-wan-fx-focus", onFocus);
  }, []);

  async function onGo() {
    if (!selected || busy) return;
    setBusy(true);
    setKeepMsg("");
    setPreviewUrl(null);
    setPreviewFile(null);
    setStatus("Starting…");
    try {
      const res = await fetch("/api/crash/wan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plateName: selected,
          prompt: prompt.trim() || undefined,
          duration,
          boom,
        }),
      });
      if (!res.ok && !res.body) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      await readNdjsonStream(res, (ev) => {
        const step = String(ev.step || "");
        const msg = String(ev.message || ev.error || step);
        setStatus(msg);
        if (step === "done") {
          const url = typeof ev.url === "string" ? ev.url : null;
          const file =
            typeof ev.file === "string"
              ? ev.file
              : url
                ? decodeURIComponent(
                    (url.split("name=")[1] || "").split("&")[0] || "",
                  )
                : null;
          if (url) setPreviewUrl(url);
          if (file) setPreviewFile(file);
        }
        if (step === "error") {
          setStatus(String(ev.error || ev.message || "Boom failed"));
        }
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      const nice = /Failed to fetch|NetworkError|Load failed/i.test(err)
        ? `${err} — Studio or Comfy unreachable. Start the pod, then Go.`
        : err;
      setStatus(nice);
    } finally {
      setBusy(false);
    }
  }

  async function onKeep() {
    if (!previewFile || busy) return;
    setKeepMsg("Keeping…");
    try {
      const res = await fetch("/api/crash/wan/keep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file: previewFile }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Keep failed");
      setKeepMsg(data.message || "Kept");
    } catch (e) {
      setKeepMsg(e instanceof Error ? e.message : String(e));
    }
  }

  const cold =
    preflight &&
    !preflight.checking &&
    (!preflight.reachable || !preflight.ok);

  return (
    <div
      id="wan-fx-baby"
      ref={panelRef}
      className="flex min-h-0 min-w-0 w-full flex-1 flex-col rounded-sm border border-[var(--magenta-hot)]/40 bg-[var(--magenta-hot)]/5 p-1.5"
    >
      <div className="mb-1 flex shrink-0 flex-wrap items-center gap-2">
        <span className="text-[8px] uppercase tracking-wider text-[var(--magenta-hot)]">
          Boom FX
        </span>
        <span className="text-[8px] text-[var(--mute)]">
          Pick picture → boom → Go → Keep
        </span>
        {preflight?.checking || !preflight ? (
          <span className="text-[8px] text-[var(--mute)]">Checking Wan…</span>
        ) : preflight.ok ? (
          <span className="text-[8px] text-[var(--acid)]">Wan ready</span>
        ) : (
          <span className="text-[8px] text-[var(--magenta-hot)]">
            {preflight.reachable
              ? "Wan nodes missing"
              : "Start pod then Go"}
          </span>
        )}
        <button
          type="button"
          onClick={() => void runPreflight()}
          disabled={Boolean(preflight?.checking)}
          className="text-[8px] text-[var(--chrome-dim)] underline hover:text-[var(--acid)] disabled:opacity-40"
        >
          Recheck
        </button>
        <button
          type="button"
          onClick={() => void loadPlates()}
          className="text-[8px] text-[var(--chrome-dim)] underline hover:text-[var(--chrome)]"
        >
          Refresh pictures
        </button>
      </div>

      {cold && preflight?.hint ? (
        <p className="mb-1 shrink-0 text-[8px] leading-snug text-[var(--mute)]">
          {preflight.hint}
        </p>
      ) : null}

      <p className="mb-1 shrink-0 text-[8px] text-[var(--mute)]">
        Pick picture{" "}
        <span className="text-[var(--chrome-dim)]">({platesMsg})</span>
      </p>
      <div className="crash-tray-scroll mb-1.5 min-h-0 flex-1 overflow-y-auto rounded-sm border border-[var(--line)] bg-[var(--void)]/30 p-1">
        {plates.length === 0 ? (
          <p className="px-1 py-3 text-center text-[9px] text-[var(--mute)]">
            Put stills in _XX_SPX\_PLATES\_CARS (or _HOUSE / _CELESTIAL)
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {plateGroups.map(({ cat, rows }) => (
              <div key={cat}>
                <p className="mb-0.5 px-0.5 text-[8px] uppercase tracking-wider text-[var(--acid)]">
                  {cat === "Other" ? "Other (loose in _PLATES)" : cat}{" "}
                  <span className="text-[var(--mute)] normal-case tracking-normal">
                    ({rows.length})
                  </span>
                </p>
                <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
                  {rows.map((p) => {
                    const on = p.name === selected;
                    return (
                      <button
                        key={p.name}
                        type="button"
                        title={p.name}
                        disabled={busy}
                        onClick={() => setSelected(p.name)}
                        className={`relative overflow-hidden rounded-sm border ${
                          on
                            ? "border-[var(--magenta-hot)] ring-1 ring-[var(--magenta-hot)]"
                            : "border-[var(--line)] opacity-80 hover:opacity-100"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={p.name}
                          className="h-[52px] w-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-1 flex shrink-0 flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-[9px] text-[var(--chrome-dim)]">
          Boom size
          <select
            value={boom}
            disabled={busy}
            onChange={(e) => setBoom(e.target.value as BoomSize)}
            className="rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-1 py-0.5 text-[9px] text-[var(--chrome)]"
          >
            <option value="small">Small</option>
            <option value="normal">Normal</option>
            <option value="big">Big</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-[9px] text-[var(--chrome-dim)]">
          Length
          <select
            value={duration}
            disabled={busy}
            onChange={(e) => setDuration(e.target.value as Duration)}
            className="rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-1 py-0.5 text-[9px] text-[var(--chrome)]"
          >
            <option value="short">Short (~2s)</option>
            <option value="normal">Normal (~3s)</option>
          </select>
        </label>
        <input
          type="text"
          value={prompt}
          disabled={busy}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Optional short note (positive only)"
          className="min-w-[140px] flex-1 rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-1.5 py-0.5 text-[9px] text-[var(--chrome)]"
        />
        <button
          type="button"
          disabled={busy || !selected}
          onClick={() => void onGo()}
          title={
            cold
              ? "Start the pod first, then Go"
              : "Upload plate → queue boom → pull mp4"
          }
          className="rounded-sm border border-[var(--magenta-hot)] bg-[var(--magenta-hot)]/20 px-2.5 py-0.5 text-[10px] font-medium text-[var(--magenta-hot)] disabled:opacity-40"
        >
          {busy ? "Working…" : cold ? "Start pod then Go" : "Go"}
        </button>
        <button
          type="button"
          disabled={busy || !previewFile}
          onClick={() => void onKeep()}
          title="Copy mp4 into _XX_SPX\\explosions\\"
          className="rounded-sm border border-[var(--acid)] bg-[var(--acid)]/15 px-2 py-0.5 text-[10px] text-[var(--acid)] disabled:opacity-40"
        >
          Keep
        </button>
      </div>

      {status ? (
        <p className="mb-1 shrink-0 text-[9px] text-[var(--chrome-dim)]">{status}</p>
      ) : null}
      {keepMsg ? (
        <p className="mb-1 shrink-0 text-[9px] text-[var(--acid)]">{keepMsg}</p>
      ) : null}

      {previewUrl ? (
        <video
          key={previewUrl}
          src={previewUrl}
          controls
          playsInline
          className="mt-1 max-h-[min(200px,35%)] w-full shrink-0 rounded-sm border border-[var(--line)] bg-black"
        />
      ) : null}

      <p className="mt-1 shrink-0 text-[7px] leading-snug text-[var(--mute)]">
        Short clips by default (cheap). Model Wan 2.1 I2V 480p fp8 · LoRA explode_30_epochs ·
        attention sdpa. Keep → _XX_SPX\explosions\. SFX in Resolve.
      </p>
    </div>
  );
}
