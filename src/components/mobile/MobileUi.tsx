"use client";

import type { ReactNode } from "react";

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
  title: string;
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
        borderRadius: "10px",
        fontSize: "16px",
        fontWeight: 600,
        border: accent ? "none" : "1px solid var(--line)",
        background: disabled ? "var(--panel-2)" : accent ? "var(--acid)" : "transparent",
        color: disabled ? "var(--chrome-dim)" : accent ? "var(--void)" : "var(--chrome)",
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
      width: "100%",
      padding: "14px",
      borderRadius: "10px",
      border: "1px solid var(--line)",
      background: "var(--panel-2)",
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
