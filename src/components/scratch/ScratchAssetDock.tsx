"use client";

import type { ReactNode } from "react";

/** Left rail: cast + place docks. Pass existing Scratch side panels as children. */
export function ScratchAssetDock({
  cast,
  place,
  label = "Assets",
}: {
  cast: ReactNode;
  place: ReactNode;
  label?: string;
}) {
  return (
    <div className="scratch-asset-dock">
      <div className="scratch-bench-rail-label">{label}</div>
      <div className="scratch-asset-dock-cast">{cast}</div>
      <div className="scratch-asset-dock-place">{place}</div>
    </div>
  );
}
