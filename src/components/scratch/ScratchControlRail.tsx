"use client";

import type { ReactNode } from "react";

/** Right rail wrapper for prompt / knobs / Draw / Generate. */
export function ScratchControlRail({
  children,
  label = "Controls",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="scratch-control-rail">
      <div className="scratch-bench-rail-label">{label}</div>
      <div className="scratch-control-rail-body">{children}</div>
    </div>
  );
}
