import fs from "fs";
import path from "path";
import { MOVIES_ROOT } from "./paths";

/**
 * One place to find a ComfyUI workflow template on disk. Three call sites
 * (LTX Cloud IA2V, the LTX Director hotfix, lipsync) each carried their own
 * copy of "search a few candidate paths, load the JSON, throw if none
 * exist" — slightly different every time, and each new workflow meant
 * copy-pasting it again. An "arsenal" of templates needs adding one to be
 * one line, not a new candidate array with its own quirks.
 */
export type WorkflowTemplateSpec = {
  /** File to find, e.g. "LTX_2.3_IA2V_Cloud.json". */
  fileName: string;
  /** Subdirectory under workflow/, e.g. "lipsync" -> workflow/lipsync/<fileName>. */
  subdir?: string;
  /** Extra absolute paths tried alongside the standard roots — for oddball
   * locations like a Desktop fallback that don't fit the workflow/ convention. */
  extraCandidates?: string[];
};

function candidatePaths(spec: WorkflowTemplateSpec): string[] {
  const seg = spec.subdir ? [spec.subdir, spec.fileName] : [spec.fileName];
  return [
    // The PC's MY MOVIES tree — real path when Studio runs locally.
    path.join(MOVIES_ROOT, "workflow", ...seg),
    ...(spec.extraCandidates || []),
    // MOVIES_ROOT resolves into per-invocation /tmp on Vercel and is always
    // empty there, so a copy committed to the repo is the only one a deploy
    // actually carries.
    path.join(process.cwd(), "workflow", ...seg),
  ];
}

export function resolveWorkflowTemplate(
  spec: WorkflowTemplateSpec,
): { path: string; tried: string[] } | { path: null; tried: string[] } {
  const tried = candidatePaths(spec);
  for (const p of tried) {
    if (p && fs.existsSync(p)) return { path: p, tried };
  }
  return { path: null, tried };
}

/** Load and JSON.parse a template, or throw naming every path tried. */
export function loadWorkflowTemplate<T = Record<string, unknown>>(
  spec: WorkflowTemplateSpec,
): T {
  const found = resolveWorkflowTemplate(spec);
  if (!found.path) {
    const dest = spec.subdir ? `${spec.subdir}/${spec.fileName}` : spec.fileName;
    throw new Error(
      `Missing workflow template ${spec.fileName}. Looked in: ${found.tried.join(", ")}. Commit it to workflow/${dest} so deploys carry it.`,
    );
  }
  return JSON.parse(fs.readFileSync(found.path, "utf8")) as T;
}
