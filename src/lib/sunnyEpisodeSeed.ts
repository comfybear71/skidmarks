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
  placeKey,
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

/** The Aug 20 series lock — not a later Make that copied old shelf thumbs. */
export function isSunnySeriesLockJob(job: {
  folderName?: string;
  prompt?: string;
}): boolean {
  return /EP02\s*DROP\s*BEAR/i.test(`${job.folderName || ""} ${job.prompt || ""}`);
}

export type SunnyJobFace = {
  fileName: string;
  look: string;
  seriesLock: boolean;
};

/**
 * Updated EP02 faces beat the Aug 13 shelf. A later Make that copied
 * those old thumbs does not become the new series. Never a plate_{slug} sheet.
 */
export function pickSunnySeriesFace(opts: {
  name: string;
  shelf: ReusableCastCard | null;
  jobFaces: SunnyJobFace[];
}): ReusableCastCard | null {
  const lock = opts.jobFaces.find((f) => f.seriesLock && f.fileName.trim());
  if (lock) {
    return {
      name: opts.name,
      fileName: lock.fileName,
      look: usableLook(lock.look, opts.name),
    };
  }
  const later = opts.jobFaces.find(
    (f) => f.fileName.trim() && f.fileName !== (opts.shelf?.fileName || ""),
  );
  if (later) {
    return {
      name: opts.name,
      fileName: later.fileName,
      look: usableLook(later.look, opts.name),
    };
  }
  return opts.shelf;
}

/**
 * Series faces: EP02 DROP BEAR lock first, then another Sunny job
 * face that is not the old shelf thumb, then the shelf. Never a
 * plate_{slug} turnaround sheet.
 */
export async function findSunnyReusableFaces(
  speakers: string[],
  deskId: string,
): Promise<Record<string, ReusableCastCard>> {
  const wanted = [...new Set([...speakers, ...SUNNY_SERIES_NAMES].map((s) => s.trim()).filter(Boolean))];
  const fromShelf = wanted.length ? await findReusableCastCards("sunny_banks", wanted) : {};
  const jobs = (await listMobileGenJobs(deskId).catch(() => [])).filter(
    (j) => j.styleId === "sunny_banks",
  );
  const out: Record<string, ReusableCastCard> = {};
  for (const name of wanted) {
    const jobFaces: SunnyJobFace[] = [];
    for (const job of jobs) {
      const approved = takesForSpeaker(job.castCandidates, name).find(
        (c) => c.approved && c.fileName.trim(),
      );
      if (!approved) continue;
      jobFaces.push({
        fileName: approved.fileName,
        look: approved.prompt || "",
        seriesLock: isSunnySeriesLockJob(job),
      });
    }
    const picked = pickSunnySeriesFace({
      name,
      shelf: fromShelf[name] || null,
      jobFaces,
    });
    if (picked) out[name] = picked;
  }
  return out;
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

/**
 * A script leaves a place and comes back, so the same place is two scenes.
 * Draw it once: the second scene takes the still the first one already has,
 * instead of a second Grok cook that comes back looking like somewhere else.
 */
export function reusableSunnyPlaceStill(
  job: Pick<MobileGenJob, "scenes">,
  locationCandidates: Record<string, MobileImageCandidate[]>,
  sceneId: string,
): MobileImageCandidate | null {
  const scene = job.scenes.find((s) => s.id === sceneId);
  const key = placeKey(scene?.placeName || "");
  if (!key) return null;
  for (const other of job.scenes) {
    if (other.id === sceneId) continue;
    if (placeKey(other.placeName) !== key) continue;
    const take = (locationCandidates[other.id] || []).find(
      (c) => c.approved && c.fileName.trim(),
    );
    if (take) return { ...take, approved: true };
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
    const already = reusableSunnyPlaceStill(opts.job, locationCandidates, scene.id);
    if (already) {
      locationCandidates[scene.id] = [already];
      continue;
    }
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
