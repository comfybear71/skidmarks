"use client";

import { useRef, useState } from "react";
import type { CrashStoryShot, ShotFootageRole } from "@/lib/crashStoryTypes";
import {
  looksLikeLocalFilePath,
  shotFootageRole,
  stockSearchLinks,
  stockSearchQuery,
} from "@/lib/stockFootage";

type Props = {
  shot: CrashStoryShot;
  variant?: "desk" | "phone";
  attachBusy?: boolean;
  attachError?: string;
  onRoleChange: (role: ShotFootageRole) => void;
  onQueryChange: (query: string) => void;
  onAttachFile: (file: File) => void;
};

function RoleToggle({
  role,
  onChange,
  compact,
}: {
  role: ShotFootageRole;
  onChange: (role: ShotFootageRole) => void;
  compact?: boolean;
}) {
  const btn = (id: ShotFootageRole, label: string, title: string) => {
    const on = role === id;
    return (
      <button
        type="button"
        title={title}
        onClick={() => onChange(id)}
        className={
          compact
            ? undefined
            : `rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${
                on
                  ? id === "support"
                    ? "border-[var(--acid)] bg-[var(--acid)] text-[#111]"
                    : "border-[var(--magenta-hot)] bg-[var(--magenta-hot)] text-white"
                  : "border-[var(--line)] text-[var(--chrome-dim)] hover:border-[var(--chrome-dim)]"
              }`
        }
        style={
          compact
            ? {
                border: on
                  ? id === "support"
                    ? "1px solid var(--acid)"
                    : "1px solid var(--magenta-hot)"
                  : "1px solid var(--line)",
                background: on
                  ? id === "support"
                    ? "var(--acid)"
                    : "var(--magenta-hot)"
                  : "transparent",
                color: on ? (id === "support" ? "#111" : "#fff") : "var(--chrome-dim)",
                fontSize: "11px",
                lineHeight: 1,
                padding: "5px 8px",
                borderRadius: "2px",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }
            : undefined
        }
      >
        {label}
      </button>
    );
  };
  return (
    <div className={compact ? undefined : "flex items-center gap-1"} style={compact ? { display: "flex", gap: "6px" } : undefined}>
      {btn("hero", "Hero", "Needs our character — Plates / Speak / Animate as normal")}
      {btn("support", "Support", "B-roll / scenery / mood — hang licensed stock, do not cook")}
    </div>
  );
}

export function StockFootagePanel({
  shot,
  variant = "desk",
  attachBusy,
  attachError,
  onRoleChange,
  onQueryChange,
  onAttachFile,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pathNote, setPathNote] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const role = shotFootageRole(shot);
  const query = stockSearchQuery(shot);
  const links = stockSearchLinks(query);
  const compact = variant === "phone";

  function takeFiles(files: FileList | File[] | null) {
    const file = files?.[0];
    if (!file) return;
    setPathNote("");
    onAttachFile(file);
  }

  return (
    <div
      className={compact ? undefined : "space-y-1.5 rounded-sm border border-[var(--line)] bg-[var(--panel-2)] p-1.5"}
      style={
        compact
          ? {
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "8px",
              border: "1px solid var(--line)",
              borderRadius: "2px",
              background: "var(--panel-2)",
            }
          : undefined
      }
    >
      <div className={compact ? undefined : "flex flex-wrap items-center justify-between gap-1.5"}>
        <span
          className={compact ? undefined : "text-[9px] uppercase tracking-wide text-[var(--mute)]"}
          style={compact ? { fontSize: "11px", color: "var(--mute)", textTransform: "uppercase" } : undefined}
        >
          Footage
        </span>
        <RoleToggle role={role} onChange={onRoleChange} compact={compact} />
      </div>

      {role === "support" ? (
        <>
          <p
            className={compact ? undefined : "text-[10px] leading-snug text-[var(--chrome-dim)]"}
            style={compact ? { fontSize: "12px", lineHeight: 1.35, color: "var(--chrome-dim)", margin: 0 } : undefined}
          >
            Free licensed video first. Do not cook. YouTube watch pages are not free stock unless the page says Creative Commons.
          </p>
          <input
            value={shot.stockQuery || ""}
            onChange={(e) => {
              const v = e.target.value;
              setPathNote(looksLikeLocalFilePath(v) ? "Drop the file. A path on your PC cannot reach the site." : "");
              onQueryChange(v);
            }}
            placeholder={query || "frost seed ice river…"}
            className={
              compact
                ? undefined
                : "w-full rounded-sm border border-[var(--chrome-dim)]/45 bg-[var(--panel)] px-1 py-0.5 text-[10px] text-[var(--chrome)] placeholder:text-[var(--chrome-dim)] focus:border-[var(--acid)]"
            }
            style={
              compact
                ? {
                    width: "100%",
                    border: "1px solid var(--line)",
                    background: "var(--panel)",
                    color: "var(--chrome)",
                    fontSize: "13px",
                    padding: "8px",
                    borderRadius: "2px",
                  }
                : undefined
            }
          />
          {pathNote ? (
            <p className={compact ? undefined : "text-[10px] text-[var(--fail)]"} style={compact ? { fontSize: "12px", color: "var(--magenta-hot)", margin: 0 } : undefined}>
              {pathNote}
            </p>
          ) : null}
          <div className={compact ? undefined : "flex flex-wrap gap-1"} style={compact ? { display: "flex", flexWrap: "wrap", gap: "6px" } : undefined}>
            {links.map((link) => (
              <a
                key={link.id}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                title={link.note}
                className={
                  compact
                    ? undefined
                    : "rounded-sm border border-[var(--acid)]/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--acid)] hover:bg-[var(--acid)]/10"
                }
                style={
                  compact
                    ? {
                        border: "1px solid var(--acid)",
                        color: "var(--acid)",
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        padding: "6px 8px",
                        borderRadius: "2px",
                        textDecoration: "none",
                      }
                    : undefined
                }
              >
                {link.label}
              </a>
            ))}
          </div>
          <label
            className={
              compact
                ? undefined
                : `flex cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed px-2 py-2 text-center text-[10px] ${
                    dragOver
                      ? "border-[var(--acid)] bg-[var(--acid)]/10 text-[var(--acid)]"
                      : "border-[var(--line)] text-[var(--chrome-dim)]"
                  }`
            }
            style={
              compact
                ? {
                    display: "block",
                    border: dragOver ? "1px dashed var(--acid)" : "1px dashed var(--line)",
                    background: dragOver ? "rgba(200,255,46,0.08)" : "transparent",
                    color: "var(--chrome-dim)",
                    fontSize: "12px",
                    textAlign: "center",
                    padding: "12px 8px",
                    borderRadius: "2px",
                    cursor: attachBusy ? "wait" : "pointer",
                  }
                : undefined
            }
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              takeFiles(e.dataTransfer.files);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              className="hidden"
              style={compact ? { display: "none" } : undefined}
              disabled={attachBusy}
              onChange={(e) => {
                takeFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {attachBusy ? "Hanging…" : "Drop the downloaded clip here, or tap to pick"}
          </label>
          {attachError ? (
            <p className={compact ? undefined : "text-[10px] text-[var(--fail)]"} style={compact ? { fontSize: "12px", color: "var(--magenta-hot)", margin: 0 } : undefined}>
              {attachError}
            </p>
          ) : null}
        </>
      ) : (
        <p
          className={compact ? undefined : "text-[10px] text-[var(--mute)]"}
          style={compact ? { fontSize: "12px", color: "var(--mute)", margin: 0 } : undefined}
        >
          Hero — Plates / Speak / Animate as normal.
        </p>
      )}
    </div>
  );
}
