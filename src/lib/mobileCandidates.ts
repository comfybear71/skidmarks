import fs from "fs";
import path from "path";
import { buildFacePrompt, buildLocationPrompt, generateFaceImage } from "./imageGen";
import { addFaceAttempt, faceFilePath, getCharacter, setAttemptStatus } from "./characters";
import { saveUploadAsStyleCard } from "./styleCardThumbs";
import { saveGenStillAsWorldCard } from "./worldCardThumbs";
import { CRASH_DIR } from "./paths";
import { sortableId } from "./types";
import { uploadMobileMedia, resolveMobileMedia, resolveMobileMediaByFilename } from "./mobileMediaStore";
import { getShowStylePreset, type ShowStyleId } from "./showStylePresets";
import { directorNote } from "./mobileJobReady";
import type { MobileImageCandidate } from "./mobileGenJob";

const CANDIDATES_PER_BATCH = 4;
/** Per-image ceiling, generous enough to cover imageGen's own rate-limit
 * retries. A batch runs in parallel, so this is also the batch's rough worst
 * case — sequential generation blew past the route's maxDuration and the
 * phone just sat on a spinner. */
const IMAGE_TIMEOUT_MS = 90_000;

/** Reject a slow image instead of hanging the request, and always clear the
 * timer so a resolved generation can't hold the process open. */
async function withImageTimeout<T>(work: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${IMAGE_TIMEOUT_MS / 1000}s`)),
          IMAGE_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
/** Pre-approval candidate stills reuse the "plates" Blob bucket — same
 * episode-scoped shape gen/file's cloudBlobRedirect("plates", …) already
 * checks, so location candidates need no separate lookup path. */
const CANDIDATE_BLOB_KIND = "plates" as const;

async function resolveCandidateStill(
  styleId: ShowStyleId,
  folderName: string,
  fileName: string,
  characterId?: string,
  altFolders: string[] = [],
): Promise<string | null> {
  const name = fileName.trim();
  if (!name) return null;
  if (characterId) {
    const face = faceFilePath(characterId, name);
    if (face && fs.existsSync(face)) return face;
  }
  const dest = path.join(candidateGenDir(), name);
  if (fs.existsSync(dest)) return dest;
  const folders = [...new Set([folderName, ...altFolders].map((f) => f.trim()).filter(Boolean))];
  for (const folder of folders) {
    const hit = await resolveMobileMedia({
      styleId,
      folderName: folder,
      kind: CANDIDATE_BLOB_KIND,
      fileName: name,
      destPath: dest,
    });
    if (hit) return hit;
  }
  // Faces often live under the job id while folderName is already the pack.
  return resolveMobileMediaByFilename({
    kind: CANDIDATE_BLOB_KIND,
    fileName: name,
    destPath: dest,
  });
}

/** The job's slider value when it has one, else undefined so the caller can
 * fall back to the style preset's default. */
function clampRealism(n: number | undefined): number | undefined {
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(100, Math.round(n as number)));
}

/** Generate N face candidates for a Character — pending faceAttempts, not yet approved. */
export async function generateCastCandidates(
  styleId: ShowStyleId,
  folderName: string,
  characterId: string,
  count = CANDIDATES_PER_BATCH,
  _jobPrompt?: string,
  customPrompt?: string,
  jobRealism?: number,
  referenceFileName?: string,
  priorPrompt?: string,
  altFolders: string[] = [],
): Promise<MobileImageCandidate[]> {
  const character = getCharacter(characterId);
  if (!character) throw new Error("Character not found");

  const styleRealism = clampRealism(jobRealism) ?? getShowStylePreset(styleId).defaultRealism;
  // lookNote is parsed as the first sentence of pastNote, so joining them blind
  // prints the appearance twice. The vibe (job prompt) is a story — using it
  // as the face made More draw anything. Tweak adds to the look, never replaces.
  const look = (character.lookNote || "").trim();
  const past = (character.pastNote || "").trim();
  const characterNote =
    look && past.includes(look) ? past : [look, past].filter(Boolean).join(". ");
  const note = directorNote(customPrompt, priorPrompt || characterNote);
  const prompt = buildFacePrompt({
    name: character.name,
    pastNote: character.pastNote,
    note,
    styleRealism,
    rejectHints: [],
    styleId,
  });
  const ref = referenceFileName
    ? await resolveCandidateStill(styleId, folderName, referenceFileName, characterId, altFolders)
    : null;

  // Whole batch at once — 4 sequential calls could not finish inside the
  // route's budget, which is what the endless spinner actually was.
  const settled = await Promise.allSettled(
    Array.from({ length: count }, () =>
      withImageTimeout(
        generateFaceImage({ prompt, referencePaths: ref ? [ref] : [] }),
        `Face image for ${character.name}`,
      ),
    ),
  );

  const out: MobileImageCandidate[] = [];
  const uploads: Promise<unknown>[] = [];
  const failures: string[] = [];
  for (const result of settled) {
    if (result.status === "rejected") {
      const why = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`Face generation failed for ${character.name}: ${why}`);
      failures.push(why);
      continue;
    }
    const { buffer, ext } = result.value;
    const saved = addFaceAttempt(characterId, { note, buffer, ext, styleRealism, source: "generated" });
    if (!saved) continue;
    const filePath = faceFilePath(characterId, saved.attempt.fileName);
    if (filePath) {
      uploads.push(
        uploadMobileMedia({ styleId, folderName, kind: CANDIDATE_BLOB_KIND, localPath: filePath }).catch(
          () => {
            /* best effort — approve falls back to local disk on the same instance */
          },
        ),
      );
    }
    out.push({
      id: saved.attempt.id,
      fileName: saved.attempt.fileName,
      approved: false,
      prompt: note,
    });
  }
  await Promise.allSettled(uploads);

  // An empty batch used to come back as a success with nothing to swipe —
  // indistinguishable from a hang on the phone. Say what went wrong instead.
  if (!out.length) {
    throw new Error(
      `Couldn't generate faces for ${character.name}: ${failures[0] || "no images returned"}`,
    );
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
  /** Job id + pack — faces minted before screenplay live under the job id. */
  altFolders: string[] = [],
): Promise<void> {
  const character = setAttemptStatus(characterId, attemptId, "approved");
  const name = character?.name || "";

  const resolved = await resolveCandidateStill(
    styleId,
    folderName,
    fileName,
    characterId,
    altFolders,
  );
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

function extFromUpload(fileName: string, mime: string): string {
  const fromName = path.extname(fileName).toLowerCase();
  if (fromName === ".jpeg") return ".jpg";
  if (fromName === ".png" || fromName === ".jpg" || fromName === ".webp") return fromName;
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  return ".png";
}

/** Drop / choose a photo as a take — same job list as a generated still.
 * Does not delete anything. */
export async function importUploadedCastCandidate(
  styleId: ShowStyleId,
  folderName: string,
  characterId: string,
  buffer: Buffer,
  fileName: string,
  mime: string,
): Promise<MobileImageCandidate> {
  const ext = extFromUpload(fileName, mime);
  const look = (getCharacter(characterId)?.lookNote || "").trim();
  const saved = addFaceAttempt(characterId, {
    note: look || "Dropped back in",
    buffer,
    ext,
    source: "upload",
  });
  if (!saved) throw new Error("Could not keep that photo");
  const filePath = faceFilePath(characterId, saved.attempt.fileName);
  if (filePath) {
    await uploadMobileMedia({
      styleId,
      folderName,
      kind: CANDIDATE_BLOB_KIND,
      localPath: filePath,
    }).catch(() => {
      /* same-instance approve can still read disk */
    });
  }
  return {
    id: saved.attempt.id,
    fileName: saved.attempt.fileName,
    approved: false,
    prompt: look,
  };
}

export async function importUploadedLocationCandidate(
  styleId: ShowStyleId,
  folderName: string,
  buffer: Buffer,
  fileName: string,
  mime: string,
): Promise<MobileImageCandidate> {
  const ext = extFromUpload(fileName, mime);
  const savedName = `${sortableId("mloc")}${ext}`;
  const dest = path.join(candidateGenDir(), savedName);
  fs.writeFileSync(dest, buffer);
  await uploadMobileMedia({
    styleId,
    folderName,
    kind: CANDIDATE_BLOB_KIND,
    localPath: dest,
  }).catch(() => {
    /* same-instance approve can still read disk */
  });
  return { id: savedName, fileName: savedName, approved: false, prompt: "" };
}

/** Generate N location-still candidates — plain files, not yet a World card. */
export async function generateLocationCandidates(
  styleId: ShowStyleId,
  folderName: string,
  placeName: string,
  customPrompt?: string,
  count = CANDIDATES_PER_BATCH,
  jobRealism?: number,
  referenceFileName?: string,
  priorPrompt?: string,
): Promise<MobileImageCandidate[]> {
  const name = directorNote(customPrompt, priorPrompt || placeName);
  const prompt = buildLocationPrompt({
    name,
    notes: "",
    lookNote: "",
    note: "",
    styleRealism: clampRealism(jobRealism) ?? getShowStylePreset(styleId).defaultRealism,
    rejectHints: [],
    residentNames: [],
    styleId,
  });
  const ref = referenceFileName
    ? await resolveCandidateStill(styleId, folderName, referenceFileName)
    : null;

  const settled = await Promise.allSettled(
    Array.from({ length: count }, () =>
      withImageTimeout(
        generateFaceImage({ prompt, referencePaths: ref ? [ref] : [], aspectRatio: "16:9" }),
        `Location image for ${placeName}`,
      ),
    ),
  );

  const out: MobileImageCandidate[] = [];
  const uploads: Promise<unknown>[] = [];
  const failures: string[] = [];
  for (const result of settled) {
    if (result.status === "rejected") {
      const why = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`Location generation failed for ${placeName}: ${why}`);
      failures.push(why);
      continue;
    }
    const { buffer, ext } = result.value;
    const fileName = `${sortableId("mloc")}${ext.startsWith(".") ? ext : `.${ext}`}`;
    fs.writeFileSync(path.join(candidateGenDir(), fileName), buffer);
    uploads.push(
      uploadMobileMedia({
        styleId,
        folderName,
        kind: CANDIDATE_BLOB_KIND,
        localPath: path.join(candidateGenDir(), fileName),
      }).catch(() => {
        /* best effort — approve falls back to local disk on the same instance */
      }),
    );
    out.push({ id: fileName, fileName, approved: false, prompt: name });
  }
  await Promise.allSettled(uploads);

  if (!out.length) {
    throw new Error(
      `Couldn't generate locations for ${placeName}: ${failures[0] || "no images returned"}`,
    );
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
