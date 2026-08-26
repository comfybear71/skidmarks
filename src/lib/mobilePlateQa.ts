import fs from "fs";
import path from "path";
import { findCharacterPlate, resolveCharacterPlatePath } from "./characterPlates";
import { CRASH_DIR } from "./paths";
import { directorWantsEmptyHands, shortLtxLookLock } from "./mobileImageMotion";
import { compileScriptedPosition } from "./mobilePlateScript";

export { compileScriptedPosition } from "./mobilePlateScript";
import { resolvePlateCastPath, type PlateJobRef } from "./mobilePlates";
import type { ShowStyleId } from "./showStylePresets";
import { askGrokVision, textKeyPresent } from "./textGen";

export const PLATE_QA_MAX_ATTEMPTS = 3;

export type PlateQaCheckId =
  | "onBed"
  | "emptyHands"
  | "alone"
  | "facingCamera"
  | "noPhone"
  | "sameFace"
  | "anatomy"
  | "noText"
  | "peopleCount";

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
  sameFace:
    "Same face as the locked character plate for this name. One person. Not a stranger. Not a different cast member.",
  anatomy:
    "Normal human anatomy. Two hands, five separate fingers each. No extra hands, no extra limbs, no melted or fused fingers, no warped torso.",
  noText:
    "No writing, no signage, no readable letters, no captions, no watermarks. Blank or out-of-focus boards only.",
  peopleCount:
    "Exactly the asked number of distinct people. No clones of the same face. No extras.",
};

/** Always proof anatomy + text. Position keywords add more. sameFace when we have a name. */
/** Group plates almost always have a logo or wrapper. Don't burn two more cooks. */
export function plateQaStopRetry(fails: string[], people: number): boolean {
  if (!fails.length) return false;
  return people >= 2 && fails.every((id) => id === "noText");
}

export function plateQaChecks(
  staging: string,
  opts?: { identity?: boolean; people?: number },
): PlateQaCheckId[] {
  const t = staging.toLowerCase();
  const out: PlateQaCheckId[] = ["anatomy", "noText"];
  if (opts?.identity) out.push("sameFace");
  if (opts?.people && opts.people > 0) out.push("peopleCount");
  if (/\bon the bed\b|\bbutt on the mattress\b|\bsitting on .{0,40}bed\b/.test(t)) {
    out.push("onBed");
  }
  if (directorWantsEmptyHands(t)) {
    out.push("emptyHands");
    out.push("noPhone");
  }
  if (opts?.people === 1 || /only .{1,80} in frame|\bno other people\b/.test(t)) {
    if (!out.includes("alone")) out.push("alone");
  }
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

function pathToDataUrl(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function plateFileToDataUrl(fileName: string): string {
  const filePath = path.join(CRASH_DIR, "gen", fileName);
  if (!fs.existsSync(filePath)) throw new Error("No still on disk to check");
  return pathToDataUrl(filePath);
}

function bytesToDataUrl(buf: Buffer, fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/**
 * Identity lock for QA only. Never handed to the still compositor
 * (a turnaround sheet would draw doubles).
 */
export async function resolvePlateQaIdentity(opts: {
  styleId: ShowStyleId;
  name: string;
  job?: PlateJobRef;
}): Promise<{ dataUrl: string; source: "character_plate" | "cast_card" } | null> {
  const name = opts.name.trim();
  if (!name) return null;
  const sheet = await findCharacterPlate(opts.styleId, name);
  if (sheet) {
    const local = resolveCharacterPlatePath(opts.styleId, sheet.filename);
    if (local) return { dataUrl: pathToDataUrl(local), source: "character_plate" };
    if (/^https?:\/\//i.test(sheet.url)) {
      try {
        const res = await fetch(sheet.url);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          return { dataUrl: bytesToDataUrl(buf, sheet.filename), source: "character_plate" };
        }
      } catch {
        /* fall through to the single cast card */
      }
    }
  }
  const castPath = await resolvePlateCastPath(opts.styleId, name, opts.job);
  if (castPath && fs.existsSync(castPath)) {
    return { dataUrl: pathToDataUrl(castPath), source: "cast_card" };
  }
  return null;
}

export async function judgePlateStill(opts: {
  plateFile: string;
  staging: string;
  speaker?: string;
  lookLock?: string;
  people?: number;
  identityDataUrl?: string;
  identitySource?: "character_plate" | "cast_card";
}): Promise<PlateQaVerdict | null> {
  const name = (opts.speaker || "").trim();
  const withIdentity = Boolean(name || opts.identityDataUrl);
  const people = Number.isFinite(opts.people) ? Math.max(0, Math.round(opts.people as number)) : 0;
  const checks = plateQaChecks(opts.staging, { identity: withIdentity, people });
  if (!checks.length) return { ok: true, fails: [], fix: "", checks };
  if (!textKeyPresent()) return null;

  const look = shortLtxLookLock(opts.lookLock || "");
  const images = [plateFileToDataUrl(opts.plateFile)];
  if (opts.identityDataUrl) images.push(opts.identityDataUrl);

  const raw = await askGrokVision({
    system: [
      "You QA one still for a director. Reply with JSON only.",
      "Keys: anatomy, noText, peopleCount, sameFace, onBed, emptyHands, noPhone, alone, facingCamera (true/false only if that check is asked), fails (array of failed check ids), fix (one short affirmative sentence to append to the still prompt).",
      "First image is the still. Second image if present is the locked identity: a character-plate turnaround of ONE person (several angles of the same face) or a single cast card. It is not a crowd.",
      "anatomy is false if extra hands, extra limbs, melted/fused fingers, missing hands, or a warped body.",
      "noText is false if any readable letters, signage, captions, watermarks, or nonsense words (LADDER, BEXXY, etc.) appear.",
      "peopleCount is false if the number of distinct people is wrong, or two people are the same face cloned.",
      "sameFace is false if the still is a different person, a stranger, or the wrong cast member.",
      "onBed is false if they sit on a chair/stool in front of a bed, or stand, or the bed is only background.",
      "alone is false if any other person is visible, even blurry.",
      "noPhone and emptyHands are false if a phone is in their hands.",
      "Do not invent extra checks.",
    ].join(" "),
    user: [
      name ? `This still must be ${name}.` : "",
      people > 0 ? `Exactly ${people} distinct people in frame.` : "",
      look ? `Look words: ${look}` : "",
      opts.identitySource === "character_plate"
        ? "Second image = series character plate (same person, several views)."
        : opts.identitySource === "cast_card"
          ? "Second image = locked CAST card (one face)."
          : "",
      `Position asked for: ${opts.staging}`,
      `Only judge: ${checks.join(", ")}`,
      "JSON:",
    ]
      .filter(Boolean)
      .join("\n"),
    imageDataUrls: images,
  });
  return parsePlateQaJson(raw, checks);
}
