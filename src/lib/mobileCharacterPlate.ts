import fs from "fs";
import path from "path";
import { generateFaceImage, imageKeyPresent } from "./imageGen";
import { faceFilePath } from "./characters";
import { CRASH_DIR } from "./paths";
import { resolveMobileMedia } from "./mobileMediaStore";
import { mobileMediaFolder } from "./mobileJobFolder";
import { approvedCandidateFileName } from "./mobileJobReady";
import {
  buildCharacterPlatePrompt,
  findCharacterPlate,
  saveCharacterPlate,
  type CharacterPlate,
} from "./characterPlates";
import type { MobileGenJob } from "./mobileGenJob";
import { getShowStylePreset } from "./showStylePresets";

async function resolveApprovedFace(job: MobileGenJob, name: string): Promise<string | null> {
  const fileName = approvedCandidateFileName(job.castCandidates, name);
  if (!fileName) return null;
  const dest = path.join(CRASH_DIR, "gen", fileName);
  if (fs.existsSync(dest)) return dest;
  return resolveMobileMedia({
    styleId: job.styleId,
    folderName: mobileMediaFolder(job),
    kind: "plates",
    fileName,
    destPath: dest,
  });
}

/** After a face is picked: reuse the series sheet if one exists, else
 * build it from that face. Never overwrites an existing series plate
 * (Baby stays Baby). Never handed to plateCastIntoGen. */
export async function ensureCharacterPlate(
  job: MobileGenJob,
  name: string,
  characterId?: string,
): Promise<CharacterPlate> {
  const existing = await findCharacterPlate(job.styleId, name);
  if (existing) return existing;

  if (!imageKeyPresent()) {
    throw new Error("Need XAI_API_KEY to make the character plate");
  }

  const fileName = approvedCandidateFileName(job.castCandidates, name);
  const face =
    (characterId && fileName ? faceFilePath(characterId, fileName) : null) ||
    (await resolveApprovedFace(job, name));
  if (!face) throw new Error(`Picked face for ${name} is not on disk or in Blob`);

  const look =
    job.castCandidates[name]?.find((c) => c.approved)?.prompt ||
    job.roster.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())
      ?.appearance ||
    "";
  const prompt = buildCharacterPlatePrompt({
    styleId: job.styleId,
    name,
    look,
    styleRealism: job.styleRealism ?? getShowStylePreset(job.styleId).defaultRealism,
  });
  const { buffer, ext } = await generateFaceImage({
    prompt,
    referencePaths: [face],
    aspectRatio: "16:9",
  });
  return saveCharacterPlate({
    styleId: job.styleId,
    name,
    buffer,
    ext,
    note: look,
  });
}
