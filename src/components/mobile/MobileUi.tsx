"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

/**
 * Card surface shared by every tappable panel. Flat fill — a panel-to-black
 * linear gradient made every box look dirty. Lift is the inset hairline
 * and the drop shadow, not a wash.
 */
export const mobileCard: CSSProperties = {
  borderRadius: "16px",
  border: "1px solid var(--line)",
  background: "var(--panel)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.045), 0 10px 28px rgba(0,0,0,0.45)",
};

/** Selected variant — accent edge plus a tighter, warmer lift. */
export const mobileCardSelected: CSSProperties = {
  ...mobileCard,
  border: "1px solid var(--acid)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.07), 0 10px 30px rgba(0,0,0,0.5), 0 0 0 1px var(--acid)",
};

/** Small collapsed row for a finished step — the "stepper" trail up top. */
export function CompletedStepRow({
  title,
  summary,
}: {
  title: string;
  summary: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 16px",
        borderBottom: "1px solid var(--line)",
        animation: "mobileStepIn 240ms ease-out",
      }}
    >
      <span style={{ color: "var(--acid)", fontSize: "14px" }}>✓</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ color: "var(--chrome-dim)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {title}
        </div>
        <div
          style={{
            color: "var(--chrome)",
            fontSize: "12px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summary}
        </div>
      </div>
    </div>
  );
}

/** The big, near-full-screen active step — most of the phone screen, one thing at a time. */
export function ActiveStepPanel({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        animation: "mobileStepIn 320ms ease-out",
      }}
    >
      <div style={{ padding: "16px 16px 8px" }}>
        <h2 className="display" style={{ fontSize: "22px", color: "var(--acid)", margin: 0 }}>
          {title}
        </h2>
        {subtitle ? (
          <p style={{ color: "var(--chrome-dim)", fontSize: "13px", margin: "4px 0 0" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
        {children}
      </div>
    </div>
  );
}

/** A gradient sweep through the text instead of a flat color or opacity
 * pulse — used on in-progress status labels ("Generating…", "Casting
 * voices…") so a long unattended phase still reads as alive, not stalled. */
export function ShimmerText({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--chrome-dim) 0%, var(--acid) 50%, var(--chrome-dim) 100%)",
        backgroundSize: "200% auto",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        animation: "mobileShimmerText 2200ms linear infinite",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function MobilePrimaryButton({
  children,
  onClick,
  disabled,
  busy,
  tone = "accent",
  size = "block",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Working — stay lit. Do not fade to 0.55 or a tap looks dead. */
  busy?: boolean;
  tone?: "accent" | "ghost";
  size?: "block" | "chip";
}) {
  const accent = tone === "accent";
  const chip = size === "chip";
  const locked = Boolean(disabled || busy);
  return (
    <button
      type="button"
      className={busy ? "m-tap m-tap-busy" : "m-tap"}
      onClick={onClick}
      disabled={locked}
      aria-busy={busy || undefined}
      style={{
        width: "auto",
        maxWidth: "100%",
        flex: "0 0 auto",
        alignSelf: "flex-start",
        minHeight: 0,
        height: "auto",
        lineHeight: 1.2,
        padding: chip ? "4px 8px" : "6px 10px",
        borderRadius: "2px",
        fontSize: chip ? "11px" : "12px",
        fontWeight: 600,
        letterSpacing: chip ? "0.06em" : undefined,
        textTransform: chip ? "uppercase" : undefined,
        border: accent || busy ? "1px solid var(--acid)" : "1px solid var(--line)",
        appearance: "none",
        WebkitAppearance: "none",
        backgroundImage: "none",
        background: busy ? "var(--acid)" : "transparent",
        color: busy
          ? "#111"
          : disabled
            ? "var(--chrome-dim)"
            : accent
              ? "var(--acid)"
              : "var(--chrome)",
        opacity: disabled && !busy ? 0.55 : 1,
        boxShadow: "none",
        touchAction: "manipulation",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

/** Same magenta AI chip as the desktop shot desk — draft this box, tap again for another take. */
export function MobileAiButton({
  onClick,
  busy,
}: {
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      className="m-tap"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy || undefined}
      title="Draft this box — tap again for a different take"
      style={{
        flex: "0 0 auto",
        padding: "4px 8px",
        borderRadius: "2px",
        border: "1px solid var(--magenta)",
        background: busy ? "var(--magenta)" : "transparent",
        color: busy ? "#fff" : "var(--magenta)",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        opacity: 1,
      }}
    >
      {busy ? "AI…" : "AI"}
    </button>
  );
}

export function MobileTextInput({
  value,
  onChange,
  placeholder,
  multiline,
  rows = 3,
  onAi,
  aiBusy,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  onAi?: () => void;
  aiBusy?: boolean;
}) {
  const fieldStyle: CSSProperties = onAi
    ? {
        width: "100%",
        padding: "14px 14px 8px",
        color: "var(--chrome)",
        fontSize: "15px",
        fontFamily: "inherit",
        background: "transparent",
        border: "none",
        outline: "none",
        boxShadow: "none",
        resize: multiline ? "vertical" : "none",
      }
    : {
        ...mobileCard,
        width: "100%",
        padding: "14px",
        color: "var(--chrome)",
        fontSize: "15px",
        fontFamily: "inherit",
      };
  const shared = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    placeholder,
    style: fieldStyle,
  };
  const field = multiline ? (
    <textarea {...shared} rows={rows} />
  ) : (
    <input {...shared} type="text" />
  );
  if (!onAi) return field;
  return (
    <div style={{ ...mobileCard, overflow: "hidden" }}>
      {field}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "0 10px 10px",
        }}
      >
        <MobileAiButton onClick={onAi} busy={aiBusy} />
      </div>
    </div>
  );
}

export const mobileMediaFrame: CSSProperties = {
  width: "100%",
  borderRadius: "2px",
  border: "1px solid var(--line)",
  background: "var(--void)",
  display: "block",
};

function clock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Squared acid play + scrub — not the browser's rounded grey widget. */
export function MobileAudioPlayer({
  src,
  onRemove,
  removing,
}: {
  src: string;
  onRemove?: () => void;
  removing?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setT(el.currentTime);
    const onMeta = () => setDur(el.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [src]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else void el.play();
  }

  const pct = dur > 0 ? Math.min(100, (t / dur) * 100) : 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        width: "100%",
        padding: "6px 8px",
        borderRadius: "2px",
        border: "1px solid var(--line)",
        background: "var(--panel-2)",
      }}
    >
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={toggle}
        style={{
          width: "28px",
          height: "28px",
          flex: "0 0 auto",
          borderRadius: "2px",
          border: "1px solid var(--acid)",
          background: "var(--acid)",
          color: "var(--void)",
          fontSize: "11px",
          fontWeight: 700,
        }}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={dur || 0}
        aria-valuenow={t}
        onClick={(e) => {
          const el = audioRef.current;
          if (!el || !dur) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          el.currentTime = Math.max(0, Math.min(dur, x * dur));
        }}
        style={{
          flex: 1,
          height: "6px",
          borderRadius: "2px",
          background: "var(--void)",
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--acid)",
          }}
        />
      </div>
      <span
        style={{
          flex: "0 0 auto",
          fontSize: "11px",
          color: "var(--chrome-dim)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {clock(t)}/{clock(dur)}
      </span>
      {onRemove ? (
        <button
          type="button"
          disabled={removing}
          aria-label="Remove this mp3"
          onClick={onRemove}
          style={{
            width: "28px",
            height: "28px",
            flex: "0 0 auto",
            borderRadius: "2px",
            border: "1px solid var(--line)",
            background: "transparent",
            color: removing ? "var(--chrome-dim)" : "var(--magenta-hot)",
            fontSize: "18px",
            lineHeight: 1,
            fontWeight: 700,
            opacity: removing ? 0.55 : 1,
            touchAction: "manipulation",
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

/** Shared fold for long desk lists — Sections, song cuts, stills, talking extras. */
export function DeskFold({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count?: number | string;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="m-desk-fold">
      <button
        type="button"
        className={`m-desk-fold-btn${open ? " is-open" : ""}`}
        aria-expanded={open}
        onClick={onToggle}
      >
        {label}
        {count != null && count !== "" ? <span className="m-desk-fold-n">{count}</span> : null}
        <span className="m-desk-fold-caret">{open ? "▾" : "▸"}</span>
      </button>
      {open ? <div className="m-desk-fold-body">{children}</div> : null}
    </div>
  );
}
