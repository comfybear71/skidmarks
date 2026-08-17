"use client";

import type { ScratchOverlay } from "@/lib/scratchBench/types";

/**
 * SVG overlay for bounding boxes + arrows on the plate.
 * Boilerplate: render-only. Wire pointer tools later.
 */
export function ScratchCanvasOverlay({
  overlays,
  className,
}: {
  overlays: ScratchOverlay[];
  className?: string;
}) {
  if (!overlays.length) return null;
  return (
    <svg
      className={className || "scratch-canvas-overlay"}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden
    >
      {overlays.map((o) => {
        if (o.kind === "box") {
          return (
            <g key={o.id}>
              <rect
                x={o.x}
                y={o.y}
                width={o.w}
                height={o.h}
                fill="none"
                stroke="currentColor"
                strokeWidth={0.008}
              />
              {o.label ? (
                <text x={o.x + 0.01} y={o.y + 0.04} fontSize={0.035} fill="currentColor">
                  {o.label}
                </text>
              ) : null}
            </g>
          );
        }
        return (
          <g key={o.id}>
            <line
              x1={o.x1}
              y1={o.y1}
              x2={o.x2}
              y2={o.y2}
              stroke="currentColor"
              strokeWidth={0.01}
              markerEnd="url(#scratch-arrow)"
            />
            {o.label ? (
              <text
                x={(o.x1 + o.x2) / 2}
                y={(o.y1 + o.y2) / 2}
                fontSize={0.03}
                fill="currentColor"
              >
                {o.label}
              </text>
            ) : null}
          </g>
        );
      })}
      <defs>
        <marker id="scratch-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
      </defs>
    </svg>
  );
}
