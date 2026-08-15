import fs from "fs";
import path from "path";
import { buildFacePrompt, buildLocationPrompt, generateFaceImage } from "./imageGen";
import { addFaceAttempt, faceFilePath, getCharacter, setAttemptStatus } from "./characters";
import { saveUploadAsStyleCard } from "./styleCardThumbs";
import { saveGenStillAsWorldCard } from "./worldCardThumbs";
import { CRASH_DIR } from "./paths";
import { sortableId } from "./types";
import { uploadMobileMedia, resolveMobileMedia } from "./mobileMediaStore";
import { getShowStylePreset, type ShowStyleId } from "./showStylePresets";
import type { MobileImageCandidate } from "./mobileGenJob";

const CANDIDATES_PER_BATCH = 4;
/** Pre-approval candidate stills reuse the "plates" Blob bucket — same
 * episode-scoped shape gen/file's cloudBlobRedirect("plates", …) already
 * checks, so location candidates need no separate lookup path. */
const CANDIDATE_BLOB_KIND = "plates" as const;

/** Generate N face candidates for a Character — pending faceAttempts, not yet approved. */
export async function generateCastCandidates(
  styleId: ShowStyleId,
  folderName: string,
  characterId: string,
  count = CANDIDATES_PER_BATCH,
  jobPrompt?: string,
  customPrompt?: string,
): Promise<MobileImageCandidate[]> {
  const character = getCharacter(characterId);
  if (!character) throw new Error("Character not found");

  const styleRealism = getShowStylePreset(styleId).defaultRealism;
  // Use custom prompt (manual refinement), original job prompt, or character notes — in that order.
  const note = customPrompt || jobPrompt || [character.lookNote, character.pastNote].filter(Boolean).join(". ");
  const prompt = buildFacePrompt({
    name: character.name,
    pastNote: character.pastNote,
    note,
    styleRealism,
    rejectHints: [],
  });

  const out: MobileImageCandidate[] = [];
  for (let i = 0; i < count; i++) {
    const { buffer, ext } = await generateFaceImage({ prompt, referencePaths: [] });
    const saved = addFaceAttempt(characterId, { note, buffer, ext, styleRealism, source: "generated" });
    if (!saved) continue;
    const filePath = faceFilePath(characterId, saved.attempt.fileName);
    if (filePath) {
      try {
        await uploadMobileMedia({ styleId, folderName, kind: CANDIDATE_BLOB_KIND, localPath: filePath });
      } catch {
        /* best effort — approve falls back to local disk on the same instance */
      }
    }
    out.push({ id: saved.attempt.id, fileName: saved.attempt.fileName, approved: false });
  }
  return out;
}

/**
 * Approve one cast candidate: locks it as the Character's approvedFaceId
 * when the local record is still around (best effort — a different
 * instance than the one that generated it may have no faceAttempts entry
 * at all) and mirrors it into the style-card gallery — a separate cast
 * gallery plateCastIntoGen/crashVoice.ts read from, confirmed via research
 * to be distinct from Character.faceAttempts. Without this mirror the
 * plate-compositing and voice-reuse phases can't find this character by
 * name. Takes fileName directly (from the job's own candidate list, always
 * available regardless of instance) rather than depending on the local
 * faceAttempts record to supply it.
 */
export async function approveCastCandidate(
  styleId: ShowStyleId,
  folderName: string,
  characterId: string,
  attemptId: string,
  fileName: string,
): Promise<void> {
  const character = setAttemptStatus(characterId, attemptId, "approved");
  const name = character?.name || "";

  const localPath = faceFilePath(characterId, fileName);
  const resolved =
    (localPath && fs.existsSync(localPath) ? localPath : null) ||
    (await resolveMobileMedia({
      styleId,
      folderName,
      kind: CANDIDATE_BLOB_KIND,
      fileName,
      destPath: path.join(candidateGenDir(), fileName),
    }));
  if (!resolved) throw new Error("Approved face file missing");

  saveUploadAsStyleCard({
    buffer: fs.readFileSync(resolved),
    ext: path.extname(fileName) || ".png",
    styleId,
    name: name || fileName,
    brief: name || fileName,
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
  folderName: string,
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
    styleRealism: getShowStylePreset(styleId).defaultRealism,
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
    try {
      await uploadMobileMedia({
        styleId,
        folderName,
        kind: CANDIDATE_BLOB_KIND,
        localPath: path.join(candidateGenDir(), fileName),
      });
    } catch {
      /* best effort — approve falls back to local disk on the same instance */
    }
    out.push({ id: fileName, fileName, approved: false });
  }
  return out;
}

/** Approve one location candidate: registers it as a real World card, returns the thumb key. */
export async function approveLocationCandidate(
  styleId: ShowStyleId,
  folderName: string,
  placeName: string,
  fileName: string,
): Promise<string> {
  await resolveMobileMedia({
    styleId,
    folderName,
    kind: CANDIDATE_BLOB_KIND,
    fileName,
    destPath: path.join(candidateGenDir(), fileName),
  });
  const saved = saveGenStillAsWorldCard({
    genFileName: fileName,
    styleId,
    prompt: `${placeName} — Location`,
    placeType: "social_public",
  });
  return saved.thumbKey;
}
