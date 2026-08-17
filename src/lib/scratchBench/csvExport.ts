/** Export Scratch bench runs as a CSV stress report (browser download). */

import { runVerdict, SCRATCH_STRESS_TAGS } from "./scorecard";
import type { ScratchBenchRun } from "./types";

function csvCell(value: string | number | boolean | undefined | null): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function scratchRunsToCsv(runs: ScratchBenchRun[]): string {
  const headers = [
    "id",
    "timestamp",
    "kind",
    "backend",
    "chaos",
    "environment",
    "dialogue",
    "position_prompt",
    "eye",
    "fingers",
    "melt",
    "ghost",
    "tags",
    "verdict",
    "plate_url",
    "clip_url",
  ];

  const rows = runs.map((run) => {
    const tags = run.tags || [];
    const verdict = runVerdict(tags);
    return [
      run.id,
      new Date(run.at).toISOString(),
      run.kind,
      run.backend,
      run.chaosId,
      run.environment || "",
      run.dialogue || "",
      run.positionPrompt || "",
      tags.includes("eye") ? "TRUE" : "FALSE",
      tags.includes("fingers") ? "TRUE" : "FALSE",
      tags.includes("melt") ? "TRUE" : "FALSE",
      tags.includes("ghost") ? "TRUE" : "FALSE",
      tags.join("|"),
      verdict === "open" ? (SCRATCH_STRESS_TAGS.some((t) => tags.includes(t)) ? "fail" : "open") : verdict,
      run.plateUrl || "",
      run.clipUrl || "",
    ]
      .map(csvCell)
      .join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

export function downloadScratchRunsCsv(runs: ScratchBenchRun[], filename?: string): boolean {
  if (!runs.length || typeof document === "undefined") return false;
  const csv = scratchRunsToCsv(runs);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const day = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = filename || `scratch_stress_report_${day}.csv`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}
