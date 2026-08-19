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
  SCRATCH_REFINE_IMAGE_ONLY_LOCK,
  SCRATCH_SINGLE_FRAME_LOCK,
} from "./sirayI2v";
import { candidateLookPrompt } from "./mobileJobReady";

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

export type ScratchStillSend = {
  layers: ScratchSendLayer[];
  prompt: string;
  nude: boolean;
  joPhone: boolean;
  faces: ScratchFaceRecord[];
  placeLook: string;
  /** Siray gets one image only — no face cards on the wire. */
  imageOnlyRefine?: boolean;
};

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
  const nude = scratchWantsNude(raw);
  const nudeLock = nude
    ? "Same bare body, skin, and wardrobe as the attached image. Do not add clothes. Do not censor anatomy already visible in the image."
    : "";
  const watermark = "No writing, no signage text, no captions, no watermarks.";
  const layers: ScratchSendLayer[] = [
    { id: "refine", label: "Image only", text: SCRATCH_REFINE_IMAGE_ONLY_LOCK },
    ...(nudeLock ? [{ id: "nude", label: "Nude lock", text: nudeLock }] : []),
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
    nude,
    joPhone: false,
    faces: [],
    placeLook: "",
    imageOnlyRefine: true,
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
  /** When Jo is on the pad: phone/maniac layer. Ignored if Jo is not on the pad. */
  joPhone: boolean;
}): ScratchStillSend {
  if (opts.refineFromStill) {
    return buildScratchRefineSend({ staging: opts.staging, speakers: opts.speakers });
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
  const style = buildCrashGenLook(opts.styleId, styleRealism);
  const startLock = scratchStartImageLock(false);
  const nudeLock = nude ? scratchNudeStillLock(nudeText, speakers) : "";
  const multiNude =
    nude && n > 1
      ? "Only undress who the staging names as nude. Everyone else keeps their clothes. No floating name labels."
      : "";
  const stagingLine = staging
    ? `Staging / position: ${staging}`
    : `Staging: ${speakers.join(" and ")} naturally in ${opts.placeName || "this place"}.`;
  const watermark = "No writing, no signage text, no captions, no watermarks.";

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

  return { layers, prompt, nude, joPhone, faces, placeLook };
}
