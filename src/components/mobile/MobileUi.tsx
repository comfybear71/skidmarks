"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Card surface shared by every tappable panel: rounder corners, a soft
 * top-down gradient instead of a flat fill, and a lift shadow with a hairline
 * inset highlight. Flat panels with a 1px border read as a form; this reads as
 * something you press.
 */
export const mobileCard: CSSProperties = {
  borderRadius: "16px",
  border: "1px solid var(--line)",
  background: "linear-gradient(160deg, var(--panel-2) 0%, var(--panel) 100%)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.045), 0 10px 28px rgba(0,0,0,0.45)",
};

/** Selected variant — accent edge plus a tighter, warmer lift. */
export const mobileCardSelected: CSSProperties = {
  ...mobileCard,
  border: "1px solid var(--acid)",
  background: "linear-gradient(160deg, var(--panel-2) 0%, var(--panel) 100%)",
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
        // Gradient rather than a flat fill, darkening toward the bottom so the
        // button reads as lit from above like the cards around it.
        background: disabled
          ? "var(--panel-2)"
          : accent
            ? "linear-gradient(180deg, var(--acid) 0%, var(--acid) 58%, rgba(0,0,0,0.20) 100%)"
            : "transparent",
        color: disabled ? "var(--chrome-dim)" : accent ? "var(--void)" : "var(--chrome)",
        boxShadow:
          disabled || !accent
            ? "none"
            : "inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 22px rgba(0,0,0,0.42)",
        touchAction: "manipulation",
      }}
    >
      {children}
    </button>
  );
}

export function MobileTextInput({
  value,
  onChange,
  placeholder,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const shared = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    placeholder,
    style: {
      ...mobileCard,
      width: "100%",
      padding: "14px",
      color: "var(--chrome)",
      fontSize: "15px",
      fontFamily: "inherit",
    } as React.CSSProperties,
  };
  return multiline ? (
    <textarea {...shared} rows={4} style={{ ...shared.style, resize: "vertical" }} />
  ) : (
    <input {...shared} type="text" />
  );
}
