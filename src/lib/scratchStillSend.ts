/**
 * One Draw send. Client preview and Siray POST use this function.
 * If a layer is not in this list, it is not sent.
 */

import { buildCrashGenLook } from "./crashGenLook";
import type { ShowStyleId } from "./showStylePresets";
import { isJoKeyboardWarrior } from "./mobileImageMotion";
import { plateCastStagingNote } from "./mobilePlateLines";
import { withScratchEmptyHands } from "./mobileImageMotion";
import { stripScratchLayoutMarks } from "./scratchBench/padDrop";
import {
  scratchNudeStillLock,
  scratchStartImageLock,
  scratchWantsNude,
  scratchWantsUndressFromStill,
  SCRATCH_ADD_INTO_STILL_LOCK,
  SCRATCH_REFINE_IMAGE_ONLY_LOCK,
  SCRATCH_SINGLE_FRAME_LOCK,
} from "./sirayI2v";
import { candidateLookPrompt } from "./mobileJobReady";
import { MUSIC_VIDEO_NO_CEL } from "./musicVideoGroupPlate";

export type ScratchSendLayer = {
  id: string;
  label: string;
  text: string;
};

export type ScratchFaceRecord = {
  name: string;
  look: string;
  fileName: string;
};

export type ScratchStillWireMode = "fresh" | "refine" | "add-into-still";

export type ScratchStillSend = {
  layers: ScratchSendLayer[];
  prompt: string;
  nude: boolean;
  joPhone: boolean;
  faces: ScratchFaceRecord[];
  placeLook: string;
  /** Siray gets one image only — no face cards on the wire. */
  imageOnlyRefine?: boolean;
  mode: ScratchStillWireMode;
};

/** Unique trimmed names, first-seen order. */
function uniqueNames(names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/**
 * Who on the pad is not already locked as pixels in the last still.
 * Empty last-still cast = we do not know who is in the picture, so every
 * pad name is a newcomer (face cards go on the wire).
 */
export function scratchStillNewcomers(speakers: string[], lastStillCast: string[]): string[] {
  const pad = uniqueNames(speakers);
  const drawn = new Set(uniqueNames(lastStillCast).map((n) => n.toLowerCase()));
  if (!drawn.size) return pad;
  return pad.filter((n) => !drawn.has(n.toLowerCase()));
}

/**
 * Image-only refine is for a pose tweak of people already in the still.
 * Adding Shazza onto a Dazza still (or an empty park) is not that — her
 * face card has to go on the wire or the model invents a stranger.
 */
export function scratchStillWireMode(opts: {
  hasLastStill: boolean;
  speakers: string[];
  lastStillCast: string[];
}): ScratchStillWireMode {
  if (!opts.hasLastStill) return "fresh";
  const pad = uniqueNames(opts.speakers);
  if (!pad.length) return "refine";
  const drawn = uniqueNames(opts.lastStillCast);
  if (!drawn.length) return "fresh";
  if (scratchStillNewcomers(pad, drawn).length) return "add-into-still";
  return "refine";
}

/**
 * Cast list handed to buildScratchStillSend when a last still exists.
 * Episode Redo of the same names must not fall into image-only refine —
 * that send invented a stranger and wrote the name on a shirt.
 */
export function lastStillCastForSend(opts: {
  hasLastStill: boolean;
  episode: boolean;
  speakers: string[];
  rawLastCast: string[];
}): string[] | undefined {
  if (!opts.hasLastStill) return undefined;
  if (
    opts.episode &&
    scratchStillWireMode({
      hasLastStill: true,
      speakers: opts.speakers,
      lastStillCast: opts.rawLastCast,
    }) === "refine"
  ) {
    return [];
  }
  return opts.rawLastCast;
}

/** Pad names whose face cards go on the Siray image list. */
export function scratchStillFaceNamesOnWire(
  mode: ScratchStillWireMode,
  speakers: string[],
  lastStillCast: string[] = [],
): string[] {
  if (mode === "refine") return [];
  if (mode === "add-into-still") return scratchStillNewcomers(speakers, lastStillCast);
  return uniqueNames(speakers);
}

export function padHasJo(speakers: string[]): boolean {
  return speakers.some((n) => isJoKeyboardWarrior(n));
}

export function looksLineForSpeakers(
  speakers: string[],
  looksByName: Record<string, string>,
): string {
  return speakers
    .map((name) => {
      const look = (looksByName[name] || "").trim();
      return look ? `${name} looks like: ${look}` : "";
    })
    .filter(Boolean)
    .join(". ");
}

export function faceRecordsFromJob(
  speakers: string[],
  castCandidates: Record<string, { approved?: boolean; prompt?: string; fileName?: string }[] | undefined>,
): ScratchFaceRecord[] {
  return speakers.map((name) => {
    const look = candidateLookPrompt(castCandidates, name);
    const list = castCandidates[name] || Object.entries(castCandidates).find(
      ([k]) => k.trim().toLowerCase() === name.trim().toLowerCase(),
    )?.[1];
    const fileName = (list?.find((c) => c.approved)?.fileName || list?.[0]?.fileName || "").trim();
    return { name, look, fileName };
  });
}

/** Refine from a pass still — one image, user staging only. No face/place/show stacks. */
export function buildScratchRefineSend(opts: {
  staging: string;
  speakers?: string[];
}): ScratchStillSend {
  const raw = stripScratchLayoutMarks(opts.staging || "").trim();
  const speakers = [...new Set((opts.speakers || []).map((s) => s.trim()).filter(Boolean))];
  const undressFromStill = scratchWantsUndressFromStill(raw);
  const nudeKeep = scratchWantsNude(raw) && !undressFromStill;
  const nudeLock = nudeKeep
    ? "Same bare body, skin, and wardrobe as the attached image. Do not add clothes. Do not censor anatomy already visible in the image."
    : "";
  const undressLock = undressFromStill
    ? "The attached image is clothed. Follow Change only — undress as written. Do not keep the outfit if Change only removes it. Do not invent a second person."
    : "";
  const watermark = "No writing, no signage text, no captions, no watermarks.";
  const layers: ScratchSendLayer[] = [
    { id: "refine", label: "Image only", text: SCRATCH_REFINE_IMAGE_ONLY_LOCK },
    ...(nudeLock ? [{ id: "nude", label: "Nude lock", text: nudeLock }] : []),
    ...(undressLock ? [{ id: "undress", label: "Undress from still", text: undressLock }] : []),
    {
      id: "staging",
      label: "Change only",
      text: raw ? `Change only: ${raw}` : "No staging — return the same image.",
    },
    { id: "watermark", label: "No text in picture", text: watermark },
  ];
  const prompt = layers.map((l) => l.text).filter(Boolean).join("\n\n");
  return {
    layers,
    prompt,
    nude: nudeKeep || undressFromStill,
    joPhone: false,
    faces: [],
    placeLook: "",
    imageOnlyRefine: true,
    mode: "refine",
  };
}

/** Last still + new face cards. Keep whoever is already in the picture. */
export function buildScratchAddIntoStillSend(opts: {
  styleId: ShowStyleId;
  styleRealism?: number;
  placeName: string;
  speakers: string[];
  newcomers: string[];
  looksByName: Record<string, string>;
  placeLook: string;
  staging: string;
  joPhone: boolean;
}): ScratchStillSend {
  const speakers = uniqueNames(opts.speakers);
  const newcomers = uniqueNames(opts.newcomers).filter((n) =>
    speakers.some((s) => s.toLowerCase() === n.toLowerCase()),
  );
  const joOnPad = padHasJo(speakers);
  const joPhone = joOnPad && opts.joPhone;
  const looks = looksLineForSpeakers(newcomers, opts.looksByName);
  const placeLook = (opts.placeLook || "").trim();
  const rawStaging = stripScratchLayoutMarks(opts.staging || "").trim();
  const stagingBody = withScratchEmptyHands(rawStaging, joPhone);
  const staging = plateCastStagingNote({
    speakers,
    staging: stagingBody,
    looks,
    placeLook,
    joPhone,
    styleId: opts.styleId,
  });
  const who = newcomers
    .map(
      (name, i) =>
        `Image ${i + 2} is ${name}'s face card. Copy that face exactly — same face, hair, age, skin and body. Do not invent a new face for ${name}. Add ${name} into image 1.`,
    )
    .join(" ");
  const addOnly = newcomers.length
    ? `People already in image 1 stay. Add only ${newcomers.join(" and ")}. No extras. Do not invent anyone else. Do not write names or words on clothing.`
    : "";
  const lookLock = looks ? `Looks: ${looks}` : "";
  const styleRealism = Number.isFinite(opts.styleRealism)
    ? Math.max(0, Math.min(100, Math.round(opts.styleRealism as number)))
    : 60;
  const style = [
    buildCrashGenLook(opts.styleId, styleRealism),
    opts.styleId === "music_video" ? MUSIC_VIDEO_NO_CEL : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const watermark = "No writing, no signage text, no captions, no watermarks. No name printed on a shirt.";
  const stagingLine = staging
    ? `Staging / position: ${staging}`
    : `Staging: add ${newcomers.join(" and ")} into ${opts.placeName || "this place"}.`;
  const layers: ScratchSendLayer[] = [
    { id: "style", label: "Show look (slider)", text: style },
    { id: "start", label: "Keep the still", text: SCRATCH_ADD_INTO_STILL_LOCK },
    { id: "frame", label: "One photograph", text: SCRATCH_SINGLE_FRAME_LOCK },
    { id: "face", label: "New face card", text: [who, addOnly].filter(Boolean).join(" ") },
    ...(lookLock ? [{ id: "looks", label: "Looks (from face record)", text: lookLock }] : []),
    ...(placeLook ? [{ id: "place", label: "Place look", text: `Place look: ${placeLook}` }] : []),
    { id: "staging", label: "Staging", text: stagingLine },
    { id: "watermark", label: "No text in picture", text: watermark },
  ];
  const prompt = layers.map((l) => l.text).filter(Boolean).join("\n\n");
  return {
    layers,
    prompt,
    nude: false,
    joPhone,
    faces: newcomers.map((name) => ({
      name,
      look: (opts.looksByName[name] || "").trim(),
      fileName: "",
    })),
    placeLook,
    mode: "add-into-still",
  };
}

export function buildScratchStillSend(opts: {
  styleId: ShowStyleId;
  styleRealism?: number;
  placeName: string;
  speakers: string[];
  looksByName: Record<string, string>;
  placeLook: string;
  staging: string;
  refineFromStill: boolean;
  /**
   * Who the last still already drew. Pass this when a plate file exists.
   * A new pad name that is not in this list sends their face card — image-only
   * refine is how "add Shazza" became a stranger with the name on a shirt.
   * Omit it to keep the old refine-when-refineFromStill behaviour (tests).
   */
  lastStillCast?: string[];
  /** When Jo is on the pad: phone/maniac layer. Ignored if Jo is not on the pad. */
  joPhone: boolean;
}): ScratchStillSend {
  const mode =
    opts.lastStillCast !== undefined
      ? scratchStillWireMode({
          hasLastStill: opts.refineFromStill,
          speakers: opts.speakers,
          lastStillCast: opts.lastStillCast,
        })
      : opts.refineFromStill
        ? "refine"
        : "fresh";
  if (mode === "refine") {
    return buildScratchRefineSend({ staging: opts.staging, speakers: opts.speakers });
  }
  if (mode === "add-into-still") {
    return buildScratchAddIntoStillSend({
      styleId: opts.styleId,
      styleRealism: opts.styleRealism,
      placeName: opts.placeName,
      speakers: opts.speakers,
      newcomers: scratchStillNewcomers(opts.speakers, opts.lastStillCast || []),
      looksByName: opts.looksByName,
      placeLook: opts.placeLook,
      staging: opts.staging,
      joPhone: opts.joPhone,
    });
  }

  const speakers = [...new Set(opts.speakers.map((s) => s.trim()).filter(Boolean))];
  const styleRealism = Number.isFinite(opts.styleRealism)
    ? Math.max(0, Math.min(100, Math.round(opts.styleRealism as number)))
    : 60;
  const joOnPad = padHasJo(speakers);
  const joPhone = joOnPad && opts.joPhone;
  const looks = looksLineForSpeakers(speakers, opts.looksByName);
  const placeLook = (opts.placeLook || "").trim();
  const rawStaging = stripScratchLayoutMarks(opts.staging || "").trim();
  const stagingBody = withScratchEmptyHands(rawStaging, joPhone);
  const staging = plateCastStagingNote({
    speakers,
    staging: stagingBody,
    looks,
    placeLook,
    joPhone,
    styleId: opts.styleId,
  });
  const nudeText = `${staging} ${looks}`;
  const nude = scratchWantsNude(nudeText);
  const n = speakers.length;
  const who =
    n === 1
      ? `Image 2 is ${speakers[0]}'s face card. Copy that face exactly — same face, hair, age, skin and body. Do not invent a new face. Place them IN image 1. One person only. One photograph.`
      : speakers
          .map(
            (name, i) =>
              `Image ${i + 2} is ${name}'s face card. Copy that face exactly — same face, hair, age, skin. Do not invent a new face for ${name}.`,
          )
          .concat(
            `Put all of them INTO image 1 as people in that room. Never merge faces. Exactly ${n} people. Not a panel per person.`,
          )
          .join(" ");
  const lookLock = [
    nude ? "Ignore clothes on the face cards. Keep each face from its card." : "",
    looks ? `Looks: ${looks}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const style = [
    buildCrashGenLook(opts.styleId, styleRealism),
    opts.styleId === "music_video" ? MUSIC_VIDEO_NO_CEL : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const startLock = scratchStartImageLock(false);
  const nudeLock = nude ? scratchNudeStillLock(nudeText, speakers) : "";
  const multiNude =
    nude && n > 1
      ? "Only undress who the staging names as nude. Everyone else keeps their clothes. No floating name labels."
      : "";
  const stagingLine = staging
    ? `Staging / position: ${staging}`
    : `Staging: ${speakers.join(" and ")} naturally in ${opts.placeName || "this place"}.`;
  const watermark = "No writing, no signage text, no captions, no watermarks. No name printed on a shirt.";

  const layers: ScratchSendLayer[] = [
    { id: "style", label: "Show look (slider)", text: style },
    { id: "start", label: "Place lock", text: startLock },
    { id: "frame", label: "One photograph", text: SCRATCH_SINGLE_FRAME_LOCK },
    { id: "face", label: "Face card", text: who },
    ...(nudeLock ? [{ id: "nude", label: "Nude lock", text: nudeLock }] : []),
    ...(multiNude ? [{ id: "nude-who", label: "Who is nude", text: multiNude }] : []),
    ...(lookLock ? [{ id: "looks", label: "Looks (from face record)", text: lookLock }] : []),
    ...(placeLook ? [{ id: "place", label: "Place look", text: `Place look: ${placeLook}` }] : []),
    { id: "staging", label: "Staging", text: stagingLine },
    { id: "watermark", label: "No text in picture", text: watermark },
  ];

  if (joPhone) {
    layers.splice(5, 0, {
      id: "jo-phone",
      label: "Jo phone (on)",
      text: "CRAZY BIG HOLE JO phone / maniac layer is ON because Jo is on the pad.",
    });
  }

  const prompt = layers.map((l) => l.text).filter(Boolean).join("\n\n");
  const faces = speakers.map((name) => ({
    name,
    look: (opts.looksByName[name] || "").trim(),
    fileName: "",
  }));

  return { layers, prompt, nude, joPhone, faces, placeLook, mode: "fresh" };
}
