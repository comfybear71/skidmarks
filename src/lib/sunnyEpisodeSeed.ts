/**
 * Seed a Sunny Banks Make job from the series shelf.
 * Cast cards are the compositor faces. Character plates are metadata only.
 * Never put plate_{slug} into castCandidates.
 */
import fs from "fs";
import path from "path";
import { readShowAssetBytes } from "./cloudShelf";
import { findCharacterPlate } from "./characterPlates";
import { CRASH_DIR } from "./paths";
import { uploadMobileMedia } from "./mobileMediaStore";
import { mobileMediaFolder } from "./mobileJobFolder";
import { listMobileGenJobs, type MobileGenJob, type MobileImageCandidate } from "./mobileGenJob";
import { approvedCandidateFileName, faceCandidateTakes } from "./mobileJobReady";
import { findReusableCastCards, type ReusableCastCard } from "./mobileCastReuse";
import {
  isSunnySeriesName,
  matchSunnyPlaceLoose,
  SUNNY_SERIES_NAMES,
} from "./sunnyEpisodeSpec";
import { createCharacter, listCharacters } from "./characters";
import { generateCastCandidates, generateLocationCandidates } from "./mobileCandidates";
import type { SunnyShelfPlace } from "./sunnyEpisodeShelf";
import { resolveWorldCardThumbPath } from "./worldCardThumbs";

export function missingSunnyShelfFaces(
  speakers: string[],
  reusable: Record<string, ReusableCastCard>,
): string[] {
  return speakers.filter((name) => !reusable[name]);
}

export function missingSunnyShelfPlaces(
  places: string[],
  shelf: SunnyShelfPlace[],
): string[] {
  return places.filter((place) => {
    const hit = matchSunnyPlaceLoose(place, shelf);
    return !hit || !hit.thumbKey.trim();
  });
}

export function sunnyShelfFailMessage(opts: {
  missingFaces: string[];
  missingPlaces: string[];
}): string {
  const bits: string[] = [];
  if (opts.missingFaces.length) {
    bits.push(
      `No series face for ${opts.missingFaces.join(", ")}. Put them on the Sunny Banks CAST shelf once.`,
    );
  }
  if (opts.missingPlaces.length) {
    bits.push(
      `No shelf still for ${opts.missingPlaces.join(", ")}. Name the Place: as it is on the shelf.`,
    );
  }
  return bits.join(" ");
}

function usableLook(look: string, name: string): string {
  const t = (look || "").trim();
  if (!t) return "";
  if (t.toLowerCase() === name.trim().toLowerCase()) return "";
  if (/^a front on of this character/i.test(t)) return "";
  return t;
}

function namesMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function takesForSpeaker(
  candidates: Record<string, MobileImageCandidate[]>,
  speaker: string,
): MobileImageCandidate[] {
  const exact = candidates[speaker];
  if (exact?.length) return faceCandidateTakes(exact);
  const hit = Object.entries(candidates).find(([name]) => namesMatch(name, speaker));
  return faceCandidateTakes(hit?.[1]);
}

/**
 * Series faces: show shelf first, then the latest Sunny Banks job that
 * already has that person picked (the updated EP02 cards). Never a
 * plate_{slug} turnaround sheet.
 */
export async function findSunnyReusableFaces(
  speakers: string[],
  deskId: string,
): Promise<Record<string, ReusableCastCard>> {
  const wanted = [...new Set([...speakers, ...SUNNY_SERIES_NAMES].map((s) => s.trim()).filter(Boolean))];
  const fromShelf = wanted.length ? await findReusableCastCards("sunny_banks", wanted) : {};
  const missing = wanted.filter((name) => !fromShelf[name]);
  if (!missing.length) return fromShelf;

  const jobs = await listMobileGenJobs(deskId).catch(() => []);
  const sunny = jobs.filter((j) => j.styleId === "sunny_banks");
  for (const job of sunny) {
    for (const name of missing) {
      if (fromShelf[name]) continue;
      const approved = takesForSpeaker(job.castCandidates, name).find(
        (c) => c.approved && c.fileName.trim(),
      );
      if (!approved) continue;
      fromShelf[name] = {
        name,
        fileName: approved.fileName,
        look: usableLook(approved.prompt || "", name),
      };
    }
  }
  return fromShelf;
}

/** Approve the last face/place take when a Sunny row already has stills and nobody picked. */
export function autoPickSunnyTakes<
  T extends {
    styleId: string;
    castCandidates: Record<string, MobileImageCandidate[]>;
    locationCandidates: Record<string, MobileImageCandidate[]>;
  },
>(job: T): T & { changed: boolean } {
  if (job.styleId !== "sunny_banks") return { ...job, changed: false };
  let changed = false;
  const pick = (rows: Record<string, MobileImageCandidate[]>, facesOnly: boolean) => {
    const next: Record<string, MobileImageCandidate[]> = {};
    for (const [key, list] of Object.entries(rows)) {
      const usable = facesOnly ? faceCandidateTakes(list) : list || [];
      if (!list?.length) {
        next[key] = list || [];
        continue;
      }
      if (usable.some((c) => c.approved)) {
        next[key] = list;
        continue;
      }
      if (!usable.length) {
        next[key] = list;
        continue;
      }
      changed = true;
      const pickId = usable[usable.length - 1].id;
      next[key] = list.map((c) => ({ ...c, approved: c.id === pickId }));
    }
    return next;
  };
  return {
    ...job,
    castCandidates: pick(job.castCandidates, true),
    locationCandidates: pick(job.locationCandidates, false),
    changed,
  };
}

export function seedSunnyCastCandidates(
  reusable: Record<string, ReusableCastCard>,
): Record<string, MobileImageCandidate[]> {
  const out: Record<string, MobileImageCandidate[]> = {};
  for (const [name, card] of Object.entries(reusable)) {
    out[name] = [
      {
        id: card.fileName,
        fileName: card.fileName,
        approved: true,
        prompt: usableLook(card.look || "", name),
      },
    ];
  }
  return out;
}

async function worldStillBytes(
  styleId: MobileGenJob["styleId"],
  thumbKey: string,
): Promise<{ bytes: Buffer; ext: string } | null> {
  const key = thumbKey.trim();
  if (!key) return null;
  const fileName = key.startsWith("g:") ? key.slice(2) : key;
  const ext = path.extname(fileName) || ".png";
  const cloud = await readShowAssetBytes(styleId, "world", fileName).catch(() => null);
  if (cloud?.length) return { bytes: cloud, ext };
  const local = resolveWorldCardThumbPath(styleId, key.startsWith("g:") ? key : `g:${fileName}`);
  if (local && fs.existsSync(local)) {
    return { bytes: fs.readFileSync(local), ext: path.extname(local) || ext };
  }
  return null;
}

/** Copy each matched shelf place onto this job as an approved still. */
export async function copySunnyPlaceStills(opts: {
  job: MobileGenJob;
  places: string[];
  shelf: SunnyShelfPlace[];
}): Promise<Record<string, MobileImageCandidate[]>> {
  const locationCandidates: Record<string, MobileImageCandidate[]> = {
    ...opts.job.locationCandidates,
  };
  for (const scene of opts.job.scenes) {
    if (approvedCandidateFileName(locationCandidates, scene.id)) continue;
    const wanted =
      opts.places.find(
        (p) => p.trim().toLowerCase() === scene.placeName.trim().toLowerCase(),
      ) || scene.placeName;
    const hit = matchSunnyPlaceLoose(wanted, opts.shelf);
    if (!hit?.thumbKey) continue;
    const still = await worldStillBytes(opts.job.styleId, hit.thumbKey);
    if (!still) continue;
    const destName = `place_${scene.id.slice(-10)}${still.ext}`;
    const destPath = path.join(CRASH_DIR, "gen", destName);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, still.bytes);
    try {
      await uploadMobileMedia({
        styleId: opts.job.styleId,
        folderName: mobileMediaFolder(opts.job),
        kind: "plates",
        localPath: destPath,
      });
    } catch {
      /* local copy still usable this request */
    }
    locationCandidates[scene.id] = [
      {
        id: destName,
        fileName: destName,
        approved: true,
        prompt: hit.name,
      },
    ];
  }
  return locationCandidates;
}

export async function attachSunnyCharacterPlates(
  job: MobileGenJob,
  speakers: string[],
): Promise<NonNullable<MobileGenJob["characterPlates"]>> {
  const characterPlates: NonNullable<MobileGenJob["characterPlates"]> = {
    ...(job.characterPlates || {}),
  };
  for (const name of speakers) {
    if (characterPlates[name]?.status === "done" && characterPlates[name].fileName) continue;
    const plate = await findCharacterPlate(job.styleId, name);
    if (!plate) continue;
    characterPlates[name] = { fileName: plate.filename, status: "done" };
  }
  return characterPlates;
}

export function nextSunnyGuestNeedingFace(job: MobileGenJob): string | null {
  for (const name of job.speakers) {
    if (isSunnySeriesName(name)) continue;
    if (approvedCandidateFileName(job.castCandidates, name)) continue;
    return name;
  }
  return null;
}

export function nextSunnyPlaceNeedingStill(job: MobileGenJob): {
  sceneId: string;
  placeName: string;
} | null {
  for (const scene of job.scenes) {
    if (approvedCandidateFileName(job.locationCandidates, scene.id)) continue;
    if (scene.worldThumbKey?.trim() && !scene.worldThumbKey.startsWith("g:")) continue;
    return { sceneId: scene.id, placeName: scene.placeName };
  }
  return null;
}

function characterIdFor(name: string, look: string): string {
  const existing = listCharacters().find(
    (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  if (existing) return existing.id;
  return createCharacter({ name, lookNote: look, pastNote: look }).id;
}

/** Draw one guest from the script. Auto-picks the take. Never invents a series regular. */
export async function generateSunnyGuestFace(
  job: MobileGenJob,
  name: string,
  look: string,
): Promise<MobileImageCandidate> {
  if (isSunnySeriesName(name)) {
    throw new Error(`Won't invent ${name} — use the locked series face.`);
  }
  const id = characterIdFor(name, look);
  const takes = await generateCastCandidates(
    job.styleId,
    mobileMediaFolder(job),
    id,
    1,
    undefined,
    look || name,
    job.styleRealism,
  );
  const take = takes[0];
  if (!take?.fileName) throw new Error(`Couldn't draw ${name}`);
  return { ...take, approved: true, prompt: look || take.prompt || name };
}

/** Draw one new place from the script. Auto-picks the take. */
export async function generateSunnyPlaceStill(
  job: MobileGenJob,
  placeName: string,
): Promise<MobileImageCandidate> {
  const takes = await generateLocationCandidates(
    job.styleId,
    mobileMediaFolder(job),
    placeName,
    placeName,
    1,
    job.styleRealism,
  );
  const take = takes[0];
  if (!take?.fileName) throw new Error(`Couldn't draw ${placeName}`);
  return { ...take, approved: true, prompt: placeName };
}
