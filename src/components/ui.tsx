import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-sm border border-[var(--line)] bg-[var(--panel)]/95 shadow-[0_0_40px_rgba(225,0,106,0.08)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-[var(--acid-deep)]">
      {children}
    </label>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-sm border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-[var(--chrome)] outline-none focus:border-[var(--acid)] focus:shadow-[0_0_0_1px_var(--acid)]";

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return <input {...props} className={`${inputClass} ${props.className || ""}`} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea {...props} className={`${inputClass} ${props.className || ""}`} />
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  return (
    <select {...props} className={`${inputClass} ${props.className || ""}`} />
  );
}

export function Btn({
  children,
  tone = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "accent" | "magenta" | "danger" | "ghost" | "ok";
}) {
  const tones = {
    default:
      "border-[var(--line)] bg-[var(--panel-2)] text-[var(--chrome)] hover:border-[var(--magenta)]",
    accent:
      "border-[var(--acid)] bg-[var(--acid)] text-[var(--void)] hover:brightness-110 font-semibold",
    magenta:
      "border-[var(--magenta)] bg-[var(--magenta)] text-white hover:brightness-110 font-semibold",
    ok: "border-[var(--acid)] text-[var(--acid)] hover:bg-[var(--acid)]/10",
    danger:
      "border-[var(--fail)] text-[var(--fail)] hover:bg-[var(--fail)]/10",
    ghost: "border-transparent text-[var(--mute)] hover:text-[var(--chrome)]",
  };
  return (
    <button
      {...props}
      className={`rounded-sm border px-3 py-2 text-sm transition disabled:opacity-40 ${tones[tone]} ${props.className || ""}`}
    >
      {children}
    </button>
  );
}

export function Pill({
  children,
  tone = "mute",
}: {
  children: ReactNode;
  tone?: "mute" | "acid" | "magenta" | "ok" | "fail";
}) {
  const tones = {
    mute: "border-[var(--line)] text-[var(--mute)]",
    acid: "border-[var(--acid)] text-[var(--acid)]",
    magenta: "border-[var(--magenta)] text-[var(--magenta-hot)]",
    ok: "border-[var(--acid)] bg-[var(--acid)]/10 text-[var(--acid)]",
    fail: "border-[var(--fail)] bg-[var(--fail)]/10 text-[var(--fail)]",
  };
  return (
    <span
      className={`inline-block rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
