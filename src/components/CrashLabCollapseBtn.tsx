"use client";

type Props = {
  collapsed: boolean;
  /** True when whole desk is in left strip stack (not grid). */
  deskStacked?: boolean;
  /** FREE FLOW — + pulls out without parking the others. */
  freeFlow?: boolean;
  onToggle: () => void;
};

/** Square − / + on the right of Crash Lab card title bars. */
export function CrashLabCollapseBtn({
  collapsed,
  deskStacked = false,
  freeFlow = false,
  onToggle,
}: Props) {
  const label = freeFlow
    ? collapsed
      ? "Pull this panel out"
      : "Park this panel"
    : deskStacked
      ? collapsed
        ? "Open this panel"
        : "Put this panel away"
      : collapsed
        ? "Expand this panel"
        : "Collapse this panel";

  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-label={label}
      title={label}
      className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-[var(--line)] bg-[var(--panel)] text-sm leading-none text-[var(--chrome)] hover:border-[var(--acid)]"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {collapsed ? "+" : "−"}
    </button>
  );
}
