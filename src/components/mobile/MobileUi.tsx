"use client";

import type { CSSProperties, ReactNode } from "react";

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
  tone = "accent",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "accent" | "ghost";
}) {
  const accent = tone === "accent";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "16px",
        borderRadius: "14px",
        fontSize: "16px",
        fontWeight: 600,
        border: accent ? "none" : "1px solid var(--line)",
        // Flat acid. A lime-to-black linear gradient turned the bottom
        // third of Add / Start directing into mud. appearance:none so
        // the browser cannot paint its own button wash on top.
        appearance: "none",
        WebkitAppearance: "none",
        backgroundImage: "none",
        background: disabled
          ? "var(--panel-2)"
          : accent
            ? "var(--acid)"
            : "transparent",
        color: disabled ? "var(--chrome-dim)" : accent ? "var(--void)" : "var(--chrome)",
        boxShadow:
          disabled || !accent
            ? "none"
            : "inset 0 1px 0 rgba(255,255,255,0.35), 0 8px 22px rgba(0,0,0,0.42)",
        touchAction: "manipulation",
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
      onClick={onClick}
      disabled={busy}
      title="Draft this box — tap again for a different take"
      style={{
        flex: "0 0 auto",
        alignSelf: "center",
        padding: "4px 8px",
        borderRadius: "6px",
        border: "1px solid var(--magenta)",
        background: "transparent",
        color: "var(--magenta)",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        opacity: busy ? 0.5 : 1,
        position: "relative",
        zIndex: 2,
        cursor: busy ? "default" : "pointer",
      }}
    >
      {busy ? "…" : "AI"}
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
  sharp,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  onAi?: () => void;
  aiBusy?: boolean;
  /** Square corners + tighter pad — line review, not the big episode box. */
  sharp?: boolean;
}) {
  const overlayAi = Boolean(onAi) && !multiline;
  const shared = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    placeholder,
    style: {
      ...mobileCard,
      width: "100%",
      padding: sharp ? (overlayAi ? "8px 44px 8px 8px" : "8px") : overlayAi ? "14px 52px 14px 14px" : "14px",
      borderRadius: sharp ? "2px" : mobileCard.borderRadius,
      boxShadow: sharp ? "none" : mobileCard.boxShadow,
      fontSize: sharp ? "13px" : "15px",
      color: "var(--chrome)",
      fontFamily: "inherit",
    } as React.CSSProperties,
  };
  const field = multiline ? (
    <textarea
      {...shared}
      className="mobile-scroll"
      rows={rows}
      style={{ ...shared.style, resize: "vertical" }}
    />
  ) : (
    <input {...shared} type="text" />
  );
  if (!onAi) return field;
  // Multiline AI sits above the box so the Windows scrollbar cannot cover
  // the chip or steal the tap. Single-line keeps the chip inside the field.
  if (multiline) {
    return (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "6px",
          }}
        >
          <MobileAiButton onClick={onAi} busy={aiBusy} />
        </div>
        {field}
      </div>
    );
  }
  return (
    <div style={{ position: "relative" }}>
      {field}
      <div style={{ position: "absolute", top: "50%", right: "8px", transform: "translateY(-50%)" }}>
        <MobileAiButton onClick={onAi} busy={aiBusy} />
      </div>
    </div>
  );
}
