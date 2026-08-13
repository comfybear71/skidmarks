"use client";

import type { ReactNode } from "react";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function copyImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const blob = await res.blob();
    const png =
      blob.type === "image/png"
        ? blob
        : await new Promise<Blob>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const c = document.createElement("canvas");
              c.width = img.naturalWidth;
              c.height = img.naturalHeight;
              const ctx = c.getContext("2d");
              if (!ctx) {
                reject(new Error("no ctx"));
                return;
              }
              ctx.drawImage(img, 0, 0);
              c.toBlob(
                (b) => (b ? resolve(b) : reject(new Error("blob"))),
                "image/png",
              );
            };
            img.onerror = () => reject(new Error("img"));
            img.src = URL.createObjectURL(blob);
          });
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": png }),
    ]);
    return true;
  } catch {
    // Fallback: open download
    return false;
  }
}

export function downloadUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Label row with a small Copy control, and an optional AI draft control */
export function CopyLabel({
  label,
  onCopy,
  copied,
  onAi,
  aiBusy,
}: {
  label: string;
  onCopy: () => void;
  copied?: boolean;
  onAi?: () => void;
  aiBusy?: boolean;
}) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--mute)]">
        {label}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {onAi ? (
          <button
            type="button"
            onClick={onAi}
            disabled={aiBusy}
            className="rounded-sm border border-[var(--magenta)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--magenta)] hover:bg-[var(--magenta)] hover:text-black disabled:opacity-50"
            title="Draft this box — press again for a different take"
          >
            {aiBusy ? "…" : "AI"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCopy}
          className="rounded-sm border border-[var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--acid)] hover:border-[var(--acid)]"
          title="Copy"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </span>
    </div>
  );
}

export function CopyFieldShell({
  label,
  onCopy,
  copied,
  children,
  footer,
  onAi,
  aiBusy,
}: {
  label: string;
  onCopy: () => void;
  copied?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  onAi?: () => void;
  aiBusy?: boolean;
}) {
  return (
    <div className="mb-3">
      <CopyLabel
        label={label}
        onCopy={onCopy}
        copied={copied}
        onAi={onAi}
        aiBusy={aiBusy}
      />
      {children}
      {footer}
    </div>
  );
}
