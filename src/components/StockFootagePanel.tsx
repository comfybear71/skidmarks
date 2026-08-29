"use client";

import { useRef, useState } from "react";
import type { CrashStoryShot, ShotFootageRole } from "@/lib/crashStoryTypes";
import {
  looksLikeLocalFilePath,
  shotFootageRole,
  stockSearchLinks,
  stockSearchQuery,
} from "@/lib/stockFootage";
import { composeStockSearchQuery, stockLookIsOn, type StockLook } from "@/lib/stockLook";
import { ARSENAL_EFFECTS, type ArsenalEffectId } from "@/lib/arsenalEffectsCatalog";

type Props = {
  shot: CrashStoryShot;
  variant?: "desk" | "phone";
  attachBusy?: boolean;
  attachError?: string;
  /** Job-wide free-film lock — nature, space, war, anything Free. */
  look?: StockLook | null;
  onRoleChange: (role: ShotFootageRole) => void;
  onQueryChange: (query: string) => void;
  onAttachFile: (file: File) => void;
  /** Music-video mute: drop the singer name when this still has no person. */
  nobodyInShot?: boolean;
  onNobodyChange?: (nobodyInShot: boolean) => void;
  /** Music-video Support only. Omit everywhere else. */
  arsenal?: {
    hasClip: boolean;
    busy?: boolean;
    error?: string;
    onApply: (effectId: ArsenalEffectId) => void;
  };
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
      {btn("hero", "Hero", "Hero")}
      {btn("support", "Support", "B-roll / scenery / mood — hang licensed stock, do not cook")}
    </div>
  );
}

export function StockFootagePanel({
  shot,
  variant = "desk",
  attachBusy,
  attachError,
  look,
  onRoleChange,
  onQueryChange,
  onAttachFile,
  arsenal,
  nobodyInShot,
  onNobodyChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pathNote, setPathNote] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const role = shotFootageRole(shot);
  const shotQuery = stockSearchQuery(shot);
  const query = composeStockSearchQuery(look, shotQuery);
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
        <div
          className={compact ? undefined : "flex items-center gap-1"}
          style={compact ? { display: "flex", gap: "6px", flexWrap: "wrap" } : undefined}
        >
          <RoleToggle role={role} onChange={onRoleChange} compact={compact} />
          {onNobodyChange ? (
            <button
              type="button"
              title="This still has no person — car, road, scenery. Do not name JACK or say is prominent."
              onClick={() => onNobodyChange(!nobodyInShot)}
              className={
                compact
                  ? undefined
                  : `rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${
                      nobodyInShot
                        ? "border-[var(--acid)] bg-[var(--acid)] text-[#111]"
                        : "border-[var(--line)] text-[var(--chrome-dim)] hover:border-[var(--chrome-dim)]"
                    }`
              }
              style={
                compact
                  ? {
                      border: nobodyInShot ? "1px solid var(--acid)" : "1px solid var(--line)",
                      background: nobodyInShot ? "var(--acid)" : "transparent",
                      color: nobodyInShot ? "#111" : "var(--chrome-dim)",
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
              Nobody
            </button>
          ) : null}
        </div>
      </div>

      {role === "support" ? (
        <>
          <p
            className={compact ? undefined : "text-[10px] leading-snug text-[var(--chrome-dim)]"}
            style={compact ? { fontSize: "12px", lineHeight: 1.35, color: "var(--chrome-dim)", margin: 0 } : undefined}
          >
            Free licensed video first — nature, space, war, any topic the library still has. Do not cook. YouTube watch pages are not free stock unless the page says Creative Commons.
          </p>
          {stockLookIsOn(look) ? (
            <p
              className={compact ? undefined : "text-[10px] leading-snug text-[var(--acid)]"}
              style={compact ? { fontSize: "12px", lineHeight: 1.35, color: "var(--acid)", margin: 0 } : undefined}
            >
              Searching: {query || "—"}
            </p>
          ) : null}
          <input
            value={shot.stockQuery || ""}
            onChange={(e) => {
              const v = e.target.value;
              setPathNote(looksLikeLocalFilePath(v) ? "Drop the file. A path on your PC cannot reach the site." : "");
              onQueryChange(v);
            }}
            placeholder={shotQuery || "this shot only — river close, trench wide…"}
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
          {arsenal ? (
            <div
              className={compact ? undefined : "space-y-1 border-t border-[var(--line)] pt-1.5"}
              style={compact ? { display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid var(--line)", paddingTop: "8px" } : undefined}
            >
              <span
                className={compact ? undefined : "text-[9px] uppercase tracking-wide text-[var(--acid)]"}
                style={compact ? { fontSize: "11px", color: "var(--acid)", textTransform: "uppercase", letterSpacing: "0.04em" } : undefined}
              >
                Arsenal of effects
              </span>
              <p
                className={compact ? undefined : "text-[10px] leading-snug text-[var(--chrome-dim)]"}
                style={compact ? { fontSize: "12px", lineHeight: 1.35, color: "var(--chrome-dim)", margin: 0 } : undefined}
              >
                Picture spice on this hung stock clip. Our tools, not CapCut. Same clock. Audio stays off.
              </p>
              <div className={compact ? undefined : "flex flex-wrap gap-1"} style={compact ? { display: "flex", flexWrap: "wrap", gap: "6px" } : undefined}>
                {ARSENAL_EFFECTS.map((fx) => (
                  <button
                    key={fx.id}
                    type="button"
                    title={fx.blurb}
                    disabled={!arsenal.hasClip || arsenal.busy || attachBusy}
                    onClick={() => arsenal.onApply(fx.id)}
                    className={
                      compact
                        ? undefined
                        : "rounded-sm border border-[var(--acid)]/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--acid)] hover:bg-[var(--acid)]/10 disabled:opacity-40"
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
                            background: "transparent",
                            cursor: !arsenal.hasClip || arsenal.busy ? "not-allowed" : "pointer",
                            opacity: !arsenal.hasClip || arsenal.busy ? 0.4 : 1,
                          }
                        : undefined
                    }
                  >
                    {arsenal.busy ? "…" : fx.label}
                  </button>
                ))}
              </div>
              {!arsenal.hasClip ? (
                <p className={compact ? undefined : "text-[10px] text-[var(--mute)]"} style={compact ? { fontSize: "12px", color: "var(--mute)", margin: 0 } : undefined}>
                  Hang the stock file first.
                </p>
              ) : null}
              {arsenal.error ? (
                <p className={compact ? undefined : "text-[10px] text-[var(--fail)]"} style={compact ? { fontSize: "12px", color: "var(--magenta-hot)", margin: 0 } : undefined}>
                  {arsenal.error}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
