import fs from "fs";
import path from "path";
import { buildFacePrompt, buildLocationPrompt, generateFaceImage } from "./imageGen";
import { addFaceAttempt, faceFilePath, getCharacter, setAttemptStatus } from "./characters";
import { saveUploadAsStyleCard } from "./styleCardThumbs";
import { saveGenStillAsWorldCard } from "./worldCardThumbs";
import { CRASH_DIR } from "./paths";
import { sortableId } from "./types";
import type { ShowStyleId } from "./showStylePresets";
import type { MobileImageCandidate } from "./mobileGenJob";

const CANDIDATES_PER_BATCH = 4;

/** Generate N face candidates for a Character — pending faceAttempts, not yet approved. */
export async function generateCastCandidates(
  characterId: string,
  count = CANDIDATES_PER_BATCH,
): Promise<MobileImageCandidate[]> {
  const character = getCharacter(characterId);
  if (!character) throw new Error("Character not found");

  const note = [character.lookNote, character.pastNote].filter(Boolean).join(". ");
  const prompt = buildFacePrompt({
    name: character.name,
    pastNote: character.pastNote,
    note,
    styleRealism: 60,
    rejectHints: [],
  });

  const out: MobileImageCandidate[] = [];
  for (let i = 0; i < count; i++) {
    const { buffer, ext } = await generateFaceImage({ prompt, referencePaths: [] });
    const saved = addFaceAttempt(characterId, { note, buffer, ext, styleRealism: 60, source: "generated" });
    if (!saved) continue;
    out.push({ id: saved.attempt.id, fileName: saved.attempt.fileName, approved: false });
  }
  return out;
}

/**
 * Approve one cast candidate: locks it as the Character's approvedFaceId
 * (setAttemptStatus already does this) and mirrors it into the style-card
 * gallery — a separate cast gallery plateCastIntoGen/crashVoice.ts read
 * from, confirmed via research to be distinct from Character.faceAttempts.
 * Without this mirror the plate-compositing and voice-reuse phases can't
 * find this character by name.
 */
export function approveCastCandidate(
  styleId: ShowStyleId,
  characterId: string,
  attemptId: string,
): void {
  const character = setAttemptStatus(characterId, attemptId, "approved");
  if (!character) throw new Error("Character not found");
  const attempt = character.faceAttempts.find((a) => a.id === attemptId);
  if (!attempt?.fileName) throw new Error("Approved attempt has no file");
  const filePath = faceFilePath(characterId, attempt.fileName);
  if (!filePath) throw new Error("Approved face file missing on disk");

  saveUploadAsStyleCard({
    buffer: fs.readFileSync(filePath),
    ext: path.extname(attempt.fileName) || ".png",
    styleId,
    name: character.name,
    brief: character.name,
  });
}

function candidateGenDir(): string {
  const dir = path.join(CRASH_DIR, "gen");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Generate N location-still candidates — plain files, not yet a World card. */
export async function generateLocationCandidates(
  styleId: ShowStyleId,
  placeName: string,
  customPrompt?: string,
  count = CANDIDATES_PER_BATCH,
): Promise<MobileImageCandidate[]> {
  const name = (customPrompt || placeName).trim();
  const prompt = buildLocationPrompt({
    name,
    notes: "",
    lookNote: "",
    note: "",
    styleRealism: 60,
    rejectHints: [],
    residentNames: [],
  });

  const out: MobileImageCandidate[] = [];
  for (let i = 0; i < count; i++) {
    const { buffer, ext } = await generateFaceImage({
      prompt,
      referencePaths: [],
      aspectRatio: "16:9",
    });
    const fileName = `${sortableId("mloc")}${ext.startsWith(".") ? ext : `.${ext}`}`;
    fs.writeFileSync(path.join(candidateGenDir(), fileName), buffer);
    out.push({ id: fileName, fileName, approved: false });
  }
  return out;
}

/** Approve one location candidate: registers it as a real World card, returns the thumb key. */
export function approveLocationCandidate(
  styleId: ShowStyleId,
  placeName: string,
  fileName: string,
): string {
  const saved = saveGenStillAsWorldCard({
    genFileName: fileName,
    styleId,
    prompt: `${placeName} — Location`,
    placeType: "social_public",
  });
  return saved.thumbKey;
}
