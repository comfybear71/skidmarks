import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import { directorWantsEmptyHands } from "./mobileImageMotion";
import { askGrokVision, textKeyPresent } from "./textGen";

export const PLATE_QA_MAX_ATTEMPTS = 3;

export type PlateQaCheckId = "onBed" | "emptyHands" | "alone" | "facingCamera" | "noPhone";

export type PlateQaVerdict = {
  ok: boolean;
  fails: string[];
  fix: string;
  checks: PlateQaCheckId[];
};

const CHECK_FIX: Record<PlateQaCheckId, string> = {
  onBed:
    "She is sitting on the bed, butt on the mattress, knees forward. The bed frame is under and behind her — not on a chair, not standing, not in front of the bed.",
  emptyHands: "Empty hands in her lap. No phone.",
  noPhone: "Empty hands in her lap. No phone.",
  alone: "Only this person in frame. No other people. No walkers. No extras.",
  facingCamera: "Faces the camera, eyes toward lens, mouth clearly readable.",
};

/** What Position asked for — only those get judged. */
export function plateQaChecks(staging: string): PlateQaCheckId[] {
  const t = staging.toLowerCase();
  const out: PlateQaCheckId[] = [];
  if (/\bon the bed\b|\bbutt on the mattress\b|\bsitting on .{0,40}bed\b/.test(t)) {
    out.push("onBed");
  }
  if (directorWantsEmptyHands(t)) {
    out.push("emptyHands");
    out.push("noPhone");
  }
  if (/only .{1,80} in frame|\bno other people\b/.test(t)) out.push("alone");
  if (/facing (the )?camera/.test(t)) out.push("facingCamera");
  return out;
}

export function appendPlateQaFix(staging: string, fix: string): string {
  const add = fix.trim();
  if (!add) return staging.trim();
  const base = staging.trim();
  if (base.toLowerCase().includes(add.toLowerCase())) return base;
  return `${base}\n\n${add}`;
}

export function parsePlateQaJson(raw: string, checks: PlateQaCheckId[]): PlateQaVerdict {
  const block = raw.match(/\{[\s\S]*\}/)?.[0] || "";
  let parsed: Record<string, unknown> = {};
  try {
    parsed = block ? (JSON.parse(block) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }
  const fails: string[] = [];
  for (const id of checks) {
    const v = parsed[id];
    if (v === false) fails.push(id);
  }
  const listed = Array.isArray(parsed.fails)
    ? (parsed.fails as unknown[]).map((x) => String(x))
    : [];
  const named = [...new Set([...fails, ...listed.filter((x) => checks.includes(x as PlateQaCheckId))])];
  const fixFromModel = String(parsed.fix || "").trim();
  const fix =
    fixFromModel ||
    named
      .map((id) => CHECK_FIX[id as PlateQaCheckId])
      .filter(Boolean)
      .join(" ");
  return { ok: named.length === 0, fails: named, fix, checks };
}

function plateFileToDataUrl(fileName: string): string {
  const filePath = path.join(CRASH_DIR, "gen", fileName);
  if (!fs.existsSync(filePath)) throw new Error("No still on disk to check");
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export async function judgePlateStill(opts: {
  plateFile: string;
  staging: string;
}): Promise<PlateQaVerdict | null> {
  const checks = plateQaChecks(opts.staging);
  if (!checks.length) return { ok: true, fails: [], fix: "", checks };
  if (!textKeyPresent()) return null;

  const raw = await askGrokVision({
    system: [
      "You QA one still for a director. Reply with JSON only.",
      "Keys: onBed, emptyHands, noPhone, alone, facingCamera (true/false only if that check is asked), fails (array of failed check ids), fix (one short affirmative sentence to append to the still prompt).",
      "onBed is false if they sit on a chair/stool in front of a bed, or stand, or the bed is only background.",
      "alone is false if any other person is visible, even blurry.",
      "noPhone and emptyHands are false if a phone is in their hands.",
      "Do not invent extra checks.",
    ].join(" "),
    user: [
      `Position asked for: ${opts.staging}`,
      `Only judge: ${checks.join(", ")}`,
      "JSON:",
    ].join("\n"),
    imageDataUrl: plateFileToDataUrl(opts.plateFile),
  });
  return parsePlateQaJson(raw, checks);
}
