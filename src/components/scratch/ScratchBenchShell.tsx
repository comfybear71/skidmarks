"use client";

import type { ReactNode } from "react";

/**
 * Three-column Scratch command center shell.
 * Left = assets, center = canvas/stage, right = controls.
 * History strip sits under the grid.
 */
export function ScratchBenchShell({
  left,
  center,
  right,
  history,
  toolbar,
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  history?: ReactNode;
  toolbar?: ReactNode;
}) {
  return (
    <div className="scratch-bench">
      {toolbar ? <div className="scratch-bench-toolbar">{toolbar}</div> : null}
      <div className="scratch-bench-grid">
        <aside className="scratch-bench-col scratch-bench-left" aria-label="Assets">
          {left}
        </aside>
        <main className="scratch-bench-col scratch-bench-center" aria-label="Canvas">
          {center}
        </main>
        <aside className="scratch-bench-col scratch-bench-right" aria-label="Controls">
          {right}
        </aside>
      </div>
      {history ? (
        <footer className="scratch-bench-history" aria-label="Run history">
          {history}
        </footer>
      ) : null}
    </div>
  );
}
