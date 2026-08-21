import fs from "fs";
import path from "path";
import { buildCrashGenLook, generateFaceImage } from "@/lib/imageGen";
import { CRASH_DIR } from "@/lib/paths";
import {
  getShowStylePreset,
  type ShowStyleId,
} from "@/lib/showStylePresets";
import { saveCplateMeta } from "@/lib/cplateManifest";
import { emptyHandsStillLock } from "@/lib/mobileImageMotion";
import { PLATE_FACES_PER_PASS } from "@/lib/plateConstants";
import { sortableId } from "@/lib/types";

export { PLATE_FACES_PER_PASS } from "@/lib/plateConstants";

/** Position box can override the default medium / dead-centre solo crop. */
export function plateFramingLine(opts: {
  n: number;
  chainPass: boolean;
  tweak: string;
}): string {
  const t = opts.tweak.toLowerCase();
  if (opts.n === 1 && !opts.chainPass) {
    if (/\b(tight close-up|close-up of the face|face fills)\b/.test(t)) {
      return "CLOSE-UP framing: face fills the frame, shoulders barely visible, huge and near the camera. Keep the locked place from image 1 as a shallow backdrop. Do not invent a second person.";
    }
    if (
      /\b(medium close-up|\bmcu\b|head and shoulders|fill the frame|closer to the camera|huge and near)\b/.test(
        t,
      )
    ) {
      return "MEDIUM CLOSE-UP framing: head and shoulders fill the frame, figure huge and near the camera, crop the waist and legs. Keep the locked place from image 1 behind them. Do not pull back to a distant full-body. Do not invent a second person.";
    }
    if (
      /\b(wide full-body|wide shot|head to toe|lots of the place|lots of .{0,40} around)\b/.test(
        t,
      )
    ) {
      return "WIDE full-body framing: head to toe, plenty of the locked place visible, figure smaller in frame. Keep the locked place from image 1 behind them. Still only one person.";
    }
    return "MEDIUM SHOT framing: figure large in frame, dead centre horizontally. Keep the locked place from image 1 behind them. One person only.";
  }
  return "Wide enough to show everyone clearly — full figures preferred, same camera as the locked place. Keep the locked place from image 1 behind them.";
}

function genDir() {
  const d = path.join(CRASH_DIR, "gen");
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function dropDir() {
  const d = path.join(genDir(), "drops");
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

export function stageBgCopy(sourcePath: string): string {
  const ext = path.extname(sourcePath).toLowerCase() || ".png";
  const safeExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? ext : ".png";
  const bgName = `${sortableId("bg")}${safeExt === ".jpeg" ? ".jpg" : safeExt}`;
  fs.copyFileSync(sourcePath, path.join(genDir(), bgName));
  return bgName;
}

function resolveBgFull(bgPath: string, chainPass: boolean): string {
  const gen = genDir();
  const resolved = path.resolve(bgPath);
  if (chainPass && resolved.startsWith(path.resolve(gen))) {
    return resolved;
  }
  const bgName = stageBgCopy(bgPath);
  return path.join(gen, bgName);
}

function buildPlatePrompt(opts: {
  styleId: ShowStyleId;
  styleRealism: number;
  n: number;
  chainPass: boolean;
  tweak: string;
}): string {
  const { n, chainPass, tweak } = opts;
  const look = buildCrashGenLook(opts.styleId, opts.styleRealism);

  const bgLine = chainPass
    ? "Image 1 is the CURRENT scene — keep EVERY person already in image 1 exactly as they are (same faces, clothes, positions). Do not remove, replace, or reposition anyone already there."
    : "Image 1 is the LOCKED background — keep that exact place, lighting and materials. Do not move the camera. Do not replace the location with a photo street. Remove any people or crowds already in image 1 — empty place only.";

  const poseLine =
    "Keep the EXACT body pose from image 2 unless the tweak names a pose, crop, clothes, or held prop — then use the tweak. Same face from image 2. Do not invent a second person. No passer-by. No extra body in the distance.";

  const peopleLines =
    n === 1
      ? chainPass
        ? [
            "Image 2 is a NEW person — same face identity, hair, age and body from image 2. Do not turn them into a different person.",
            "Add that person into image 1 alongside everyone already there.",
            poseLine,
          ]
        : [
            "Image 2 is the person — same face identity, hair, age and body from image 2. Do not turn them into a different person.",
            "Place that same person from image 2 into image 1.",
            poseLine,
            "One person only. Only that person in frame, no one else appears. Empty of extra people and animals.",
          ]
      : chainPass
        ? [
            `Images 2–${n + 1} are ${n} NEW people — one identity each. Match each face reference. Never merge faces. Never double anyone.`,
            `Add all ${n} new people into image 1 without removing anyone already there.`,
            "Keep each new person's identity and clothes from their reference. Arrange them naturally with the people already in the scene.",
          ]
        : [
            `Images 2–${n + 1} are ${n} different people — one identity each. Match each face reference. Never merge faces. Never double anyone.`,
            `Place all ${n} people into image 1 together in one still.`,
            "Keep each person's identity and clothes from their reference. Arrange them naturally in the place (standing / seated as the tweak says).",
            `Exactly ${n} people — no extras.`,
          ];

  const framing = plateFramingLine({ n, chainPass, tweak });

  return [
    look,
    bgLine,
    ...peopleLines,
    framing,
    tweak
      ? `Staging / tweak: ${tweak}`
      : n > 1
        ? "Staging: arrange them as a natural group in the place, clear spacing, all feet on the ground."
        : chainPass
          ? "Staging: fit the new person naturally into the existing group."
          : "",
    emptyHandsStillLock(tweak),
    "No writing, no signage text, no captions, no watermarks.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function plateCastIntoGen(opts: {
  styleId: ShowStyleId;
  bgPath: string;
  castFiles: { buf: Buffer; ext: string }[];
  castNames?: string[];
  placeName?: string;
  note?: string;
  styleRealism?: number;
  chainPass?: boolean;
  skipMeta?: boolean;
  totalPeople?: number;
}): Promise<{ fileName: string; id: string; people: number }> {
  const cast = opts.castFiles.slice(0, PLATE_FACES_PER_PASS);
  if (!cast.length) throw new Error("Need at least one cast photo");

  const chainPass = Boolean(opts.chainPass);
  const bgFull = resolveBgFull(opts.bgPath, chainPass);
  const refPaths: string[] = [bgFull];

  for (const c of cast) {
    const dropName = `${sortableId("drop")}${c.ext.startsWith(".") ? c.ext : `.${c.ext}`}`;
    const dropPath = path.join(dropDir(), dropName);
    fs.writeFileSync(dropPath, c.buf);
    refPaths.push(dropPath);
  }

  const n = cast.length;
  const tweak = (opts.note || "").trim();
  const realism =
    opts.styleRealism ?? getShowStylePreset(opts.styleId).defaultRealism;

  const prompt = buildPlatePrompt({
    styleId: opts.styleId,
    styleRealism: realism,
    n,
    chainPass,
    tweak,
  });

  const { buffer, ext } = await generateFaceImage({
    prompt,
    referencePaths: refPaths,
    aspectRatio: "3:2",
  });

  const id = sortableId("cplate");
  const fileName = `${id}${ext.startsWith(".") ? ext : `.${ext}`}`;
  fs.writeFileSync(path.join(genDir(), fileName), buffer);

  const people = opts.totalPeople ?? n;
  if (!opts.skipMeta) {
    saveCplateMeta({
      fileName,
      styleId: opts.styleId,
      castNames: opts.castNames?.filter(Boolean) ?? [],
      placeName: opts.placeName,
      people,
    });
  }

  return { fileName, id, people };
}
