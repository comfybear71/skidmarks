/**
 * Crash Lab episode packs — under MY MOVIES\{SHOW}\_CRASH_LAB\{Episode name}\
 * Show is locked by style (Skidmarks vs Sunny Banks). Copy-only. Never deletes.
 */
import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import {
  backupCrashStory,
  readCrashStory,
  writeCrashStory,
} from "./crashStory";
import {
  readSceneKitDiskDraft,
  writeSceneKitDiskDraft,
  type SceneKitDiskDraft,
} from "./crashSceneKitStore";
import { campaignBaseSlug } from "./showArchivePaths";
import type { ShowStyleId } from "./showStylePresets";
import type { CrashStoryDoc } from "./crashStoryTypes";
import {
  listLtxResultsForStyle,
  writeLtxBeatResult,
  type LtxBeatResult,
} from "./ltxSmoke";
import {
  listLipsyncResultsForStyle,
  writeLipsyncBeatResult,
  type LipsyncBeatResult,
} from "./lipsyncSmoke";
import type { ComfyDraft } from "./crashComfyStack";
import { CRASH_COMFY_DEFAULT_GLOBAL } from "./crashComfyStack";
import { storyDialogueDir } from "./crashStoryLocations";
import {
  resolveWorldCardThumbPath,
  readWorldCardManifest,
  writeWorldCardManifestLabel,
  ensureWorldCardDirs,
} from "./worldCardThumbs";
import {
  resolveStyleCardThumbPath,
  readStyleCardManifest,
  writeStyleCardManifestLabel,
  ensureStyleCardDirs,
} from "./styleCardThumbs";
import {
  crashVoiceFilePath,
  findCrashVoiceByName,
} from "./crashVoice";
import { resolveGenOrPackPlate, writeActivePack } from "./crashActivePack";
import {
  crashLabRootForStyle,
  crashLabShowFolderName,
} from "./showArchivePaths";

/** Clone sample name in pack audio\\ — e.g. Sharon → sharon.mp3 */
function characterCloneAudioName(castName: string): string {
  return (
    String(castName)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/['']/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") + ".mp3"
  );
}


export type CrashLabEpisodeMeta = {
  label: string;
  styleId: ShowStyleId;
  folderName: string;
  savedAt: string;
};

export type CrashLabEpisodeListItem = CrashLabEpisodeMeta & {
  path: string;
  hasStory: boolean;
  hasSceneKit: boolean;
};

const FORBIDDEN = new Set(["gen", "morph"]);

export function crashLabRoot(styleId: ShowStyleId): string {
  return crashLabRootForStyle(styleId);
}

/** Safe folder name from label — keeps spaces, strips path junk. */
export function episodeFolderName(label: string): string {
  const cleaned = label
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || campaignBaseSlug(label) || "Untitled episode";
}

export function episodePackDir(
  folderName: string,
  styleId: ShowStyleId,
): string {
  const name = episodeFolderName(folderName);
  if (!name || name === "." || name === ".." || FORBIDDEN.has(name.toLowerCase())) {
    throw new Error(`Bad episode folder name: ${folderName}`);
  }
  const root = crashLabRoot(styleId);
  const full = path.resolve(root, name);
  if (!full.startsWith(path.resolve(root) + path.sep) && full !== path.resolve(root)) {
    throw new Error(`Episode path escaped ${crashLabShowFolderName(styleId)}\\_CRASH_LAB`);
  }
  return full;
}

function recipeDir(packDir: string): string {
  return path.join(packDir, "_RECIPE");
}

/** Prefer _RECIPE\{name}; fall back to pack-root legacy copy. */
function resolveRecipeFile(packDir: string, fileName: string): string | null {
  const modern = path.join(recipeDir(packDir), fileName);
  if (fs.existsSync(modern)) return modern;
  const legacy = path.join(packDir, fileName);
  if (fs.existsSync(legacy)) return legacy;
  return null;
}

/** Always write recipe JSON under pack\_RECIPE\ */
function recipeWritePath(packDir: string, fileName: string): string {
  const d = recipeDir(packDir);
  fs.mkdirSync(d, { recursive: true });
  return path.join(d, fileName);
}

function metaPath(dir: string): string {
  return recipeWritePath(dir, "episode.json");
}
function storyPath(dir: string): string {
  return recipeWritePath(dir, "story.json");
}
function sceneKitPath(dir: string): string {
  return recipeWritePath(dir, "scene-kit.json");
}
function comfyDraftPath(dir: string): string {
  return recipeWritePath(dir, "comfy-draft.json");
}
function ltxSnapPath(dir: string): string {
  return recipeWritePath(dir, "ltx-results.json");
}
function lipsyncSnapPath(dir: string): string {
  return recipeWritePath(dir, "lipsync-results.json");
}
function whereFilesLivePath(dir: string): string {
  return recipeWritePath(dir, "WHERE_FILES_LIVE.txt");
}

function packHasStory(dir: string): boolean {
  return Boolean(resolveRecipeFile(dir, "story.json"));
}
function packHasSceneKit(dir: string): boolean {
  return Boolean(resolveRecipeFile(dir, "scene-kit.json"));
}
function readPackJsonPath(dir: string, fileName: string): string | null {
  return resolveRecipeFile(dir, fileName);
}
function platesDir(dir: string): string {
  return path.join(dir, "plates");
}
function audioDir(dir: string): string {
  return path.join(dir, "audio");
}
function ltxMediaDir(dir: string): string {
  // Episode pack: LTX mp4s live under mp4\ (Stuie's preferred name)
  return path.join(dir, "mp4");
}
function lipsyncMediaDir(dir: string): string {
  return path.join(dir, "lipsync");
}

function safeBase(name: string): string | null {
  const n = String(name || "").trim();
  if (!n || n.includes("..") || n.includes("/") || n.includes("\\")) return null;
  return n;
}

/** Copy file into destDir — never deletes. Overwrites same name so Save refreshes. */
function copyInto(destDir: string, srcPath: string, fileName: string): boolean {
  if (!fs.existsSync(srcPath)) return false;
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(srcPath, path.join(destDir, fileName));
  return true;
}

function collectStoryMediaNames(story: CrashStoryDoc): {
  plates: string[];
  audio: string[];
} {
  const plates = new Set<string>();
  const audio = new Set<string>();
  const intro = safeBase(story.intro?.logoFile || "");
  const outro = safeBase(story.outro?.logoFile || "");
  if (intro) plates.add(intro);
  if (outro) plates.add(outro);
  const introVo = safeBase(story.intro?.voiceFile || "");
  const outroVo = safeBase(story.outro?.voiceFile || "");
  if (introVo) audio.add(introVo);
  if (outroVo) audio.add(outroVo);
  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      const p = safeBase(sh.plateFile || "");
      if (p) plates.add(p);
      for (const b of sh.beats) {
        const a = safeBase(b.voiceFile || "");
        if (a) audio.add(a);
      }
    }
  }
  return { plates: [...plates], audio: [...audio] };
}

function copyMediaIntoPack(
  packDir: string,
  styleId: ShowStyleId,
  story: CrashStoryDoc,
  scene: SceneKitDiskDraft,
  ltxSnap: LtxBeatResult[],
  lipsyncSnap: LipsyncBeatResult[],
): {
  plates: number;
  audio: number;
  ltx: number;
  lipsync: number;
  worlds: number;
  faces: number;
} {
  const genDir = path.join(CRASH_DIR, "gen");
  const dialogueDir = storyDialogueDir(styleId);
  const legacyAudio = path.join(CRASH_DIR, "story", styleId, "audio");
  const studioLtx = path.join(CRASH_DIR, "ltx");
  const studioLipsync = path.join(CRASH_DIR, "lipsync");
  const { plates, audio } = collectStoryMediaNames(story);
  const plateNames = new Set(plates);
  for (const f of scene.plateFiles || []) {
    const b = safeBase(f);
    if (b) plateNames.add(b);
  }

  let plateN = 0;
  let audioN = 0;
  let ltxN = 0;
  let lipsyncN = 0;
  let worldN = 0;
  let faceN = 0;

  const packPlates = platesDir(packDir);
  for (const name of plateNames) {
    const dest = path.join(packPlates, name);
    const src = resolveGenOrPackPlate(name) || path.join(genDir, name);
    if (path.resolve(src) === path.resolve(dest) && fs.existsSync(dest)) {
      plateN += 1;
      continue;
    }
    if (copyInto(packPlates, src, name)) plateN += 1;
  }
  for (const name of audio) {
    const src = fs.existsSync(path.join(dialogueDir, name))
      ? path.join(dialogueDir, name)
      : path.join(legacyAudio, name);
    if (copyInto(audioDir(packDir), src, name)) audioN += 1;
  }
  for (const r of ltxSnap) {
    const name = safeBase(r.file);
    if (!name) continue;
    if (copyInto(ltxMediaDir(packDir), path.join(studioLtx, name), name)) {
      ltxN += 1;
    }
  }
  for (const r of lipsyncSnap) {
    const name = safeBase(r.file);
    if (!name) continue;
    if (
      copyInto(lipsyncMediaDir(packDir), path.join(studioLipsync, name), name)
    ) {
      lipsyncN += 1;
    }
  }

  const worldKeys = new Set<string>();
  for (const sc of story.scenes) {
    const k = String(sc.worldThumbKey || "").trim();
    if (k) worldKeys.add(k);
  }
  for (const k of scene.worldKeys) {
    if (k.trim()) worldKeys.add(k.trim());
  }
  const placesOut = path.join(packDir, "images", "places");
  const placeLines: string[] = [
    "# Places — prompts",
    "",
    "Empty BG only (no characters). One entry per place image in this folder.",
    "",
  ];
  const liveWorldMan = readWorldCardManifest(styleId);
  for (const key of worldKeys) {
    const src = resolveWorldCardThumbPath(styleId, key);
    if (!src) continue;
    const base = key.startsWith("g:") ? key.slice(2) : path.basename(src);
    if (!safeBase(base)) continue;
    if (copyInto(placesOut, src, base)) {
      worldN += 1;
      const lab = liveWorldMan[key];
      const name = lab?.name || base;
      const brief = lab?.brief || "";
      placeLines.push(`## ${name}`);
      placeLines.push(`- file: \`${base}\``);
      if (lab?.placeType) placeLines.push(`- type: ${lab.placeType}`);
      placeLines.push("");
      placeLines.push(brief.trim() || "(no prompt saved on this place card)");
      placeLines.push("");
    }
  }
  if (worldN > 0) {
    fs.writeFileSync(path.join(placesOut, "PROMPTS.md"), placeLines.join("\n"));
  }

  const faceKeys = new Set<string>();
  if (scene.arseholeKey.trim()) faceKeys.add(scene.arseholeKey.trim());
  for (const k of scene.castKeys) {
    if (k.trim()) faceKeys.add(k.trim());
  }
  const charsOut = path.join(packDir, "images", "characters");
  const charLines: string[] = [
    "# Characters — prompts",
    "",
    "Face / look cards for this episode. One entry per image in this folder.",
    "",
  ];
  const liveFaceMan = readStyleCardManifest(styleId);
  let arseDone = false;
  for (const key of faceKeys) {
    const src = resolveStyleCardThumbPath(styleId, key);
    if (!src) continue;
    const base = key.includes(":")
      ? key.slice(key.indexOf(":") + 1)
      : path.basename(src);
    if (!safeBase(base)) continue;
    if (copyInto(charsOut, src, base)) {
      faceN += 1;
      const lab = liveFaceMan[key];
      const name = lab?.name || base;
      const brief = lab?.brief || "";
      const role =
        !arseDone && key === scene.arseholeKey.trim()
          ? "arsehole"
          : "cast";
      if (role === "arsehole") arseDone = true;
      charLines.push(`## ${name}`);
      charLines.push(`- file: \`${base}\``);
      charLines.push(`- role: ${role}`);
      charLines.push("");
      charLines.push(brief.trim() || "(no prompt saved on this face card)");
      charLines.push("");
    }
  }
  if (faceN > 0) {
    fs.writeFileSync(path.join(charsOut, "PROMPTS.md"), charLines.join("\n"));
  }

  // Clone / lock samples — one mp3 per cast name (sharon.mp3, tom.mp3, …)
  const cloneNames = new Set<string>();
  for (const key of faceKeys) {
    const n = String(liveFaceMan[key]?.name || "").trim();
    if (n && n.toLowerCase() !== "file") cloneNames.add(n);
  }
  cloneNames.add("Narrator");
  for (const name of cloneNames) {
    const slot = findCrashVoiceByName(styleId, name);
    if (!slot?.approvedAttemptId) continue;
    const attempt = slot.attempts.find((a) => a.id === slot.approvedAttemptId);
    const fileName = String(attempt?.fileName || "").trim();
    if (!fileName) continue;
    const src = crashVoiceFilePath(styleId, slot.castKey, fileName);
    if (!src) continue;
    const destName = characterCloneAudioName(name);
    if (!safeBase(destName)) continue;
    if (copyInto(audioDir(packDir), src, destName)) {
      audioN += 1;
    }
  }

  return {
    plates: plateN,
    audio: audioN,
    ltx: ltxN,
    lipsync: lipsyncN,
    worlds: worldN,
    faces: faceN,
  };
}

/** Fill empty Scene kit trays from the cut, then persist disk draft. */
function enrichAndPersistSceneKit(
  styleId: ShowStyleId,
  story: CrashStoryDoc,
): SceneKitDiskDraft {
  const prev = readSceneKitDiskDraft();
  const plateFiles: string[] = [];
  const seenPlate = new Set<string>();
  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      const f = String(sh.plateFile || "").trim();
      if (!f || seenPlate.has(f)) continue;
      seenPlate.add(f);
      plateFiles.push(f);
    }
  }
  const worldKeys: string[] = [];
  const seenWorld = new Set<string>();
  for (const sc of story.scenes) {
    const k = String(sc.worldThumbKey || "").trim();
    if (!k || seenWorld.has(k)) continue;
    seenWorld.add(k);
    worldKeys.push(k);
  }
  // Places: story wins if it has any. Plates: keep Scene kit slots, then add story extras.
  const nextWorlds = worldKeys.length ? worldKeys : prev?.worldKeys || [];
  const prevPlates = Array.isArray(prev?.plateFiles)
    ? prev.plateFiles.map((f) => String(f || "").trim())
    : [];
  const prevFilled = prevPlates.filter(Boolean);
  let nextPlates: string[];
  if (prevFilled.length) {
    nextPlates = [...prevPlates];
    for (const f of plateFiles) {
      if (!nextPlates.includes(f)) nextPlates.push(f);
    }
  } else {
    nextPlates = plateFiles.length ? plateFiles : prevPlates;
  }

  const sceneTitle =
    prev?.sceneTitle?.trim() ||
    story.scenes[0]?.title?.trim() ||
    story.campaignLabel ||
    "Scene 01";

  return writeSceneKitDiskDraft({
    sceneId: prev?.sceneId || "scene_01",
    sceneTitle,
    styleId: prev?.styleId || styleId,
    arseholeKey: prev?.arseholeKey || "",
    castKeys: prev?.castKeys || [],
    castSlotCount: Math.max(3, prev?.castSlotCount || 3, (prev?.castKeys || []).length),
    worldKeys: nextWorlds,
    placeSlotCount: Math.max(5, prev?.placeSlotCount || 5, nextWorlds.length),
    activePlaceIndex: prev?.activePlaceIndex || 0,
    plateFiles: nextPlates,
    plateSlotCount: Math.max(9, prev?.plateSlotCount || 9, nextPlates.length),
  });
}

/** Copy pack media into Studio working folders so Storyboard / Comfy find them. */
function copyMediaFromPack(
  packDir: string,
  styleId: ShowStyleId,
): { plates: number; audio: number; ltx: number; lipsync: number } {
  const genDir = path.join(CRASH_DIR, "gen");
  const dialogueDir = storyDialogueDir(styleId);
  const studioLtx = path.join(CRASH_DIR, "ltx");
  const studioLipsync = path.join(CRASH_DIR, "lipsync");
  fs.mkdirSync(genDir, { recursive: true });
  fs.mkdirSync(dialogueDir, { recursive: true });
  fs.mkdirSync(studioLtx, { recursive: true });
  fs.mkdirSync(studioLipsync, { recursive: true });

  let plateN = 0;
  let audioN = 0;
  let ltxN = 0;
  let lipsyncN = 0;

  const pDir = platesDir(packDir);
  if (fs.existsSync(pDir)) {
    for (const name of fs.readdirSync(pDir)) {
      const base = safeBase(name);
      if (!base) continue;
      if (copyInto(genDir, path.join(pDir, base), base)) plateN += 1;
    }
  }
  const aDir = audioDir(packDir);
  if (fs.existsSync(aDir)) {
    for (const name of fs.readdirSync(aDir)) {
      const base = safeBase(name);
      if (!base) continue;
      if (copyInto(dialogueDir, path.join(aDir, base), base)) audioN += 1;
    }
  }
  for (const sub of [ltxMediaDir(packDir), path.join(packDir, "ltx")]) {
    if (!fs.existsSync(sub)) continue;
    for (const name of fs.readdirSync(sub)) {
      const base = safeBase(name);
      if (!base) continue;
      if (copyInto(studioLtx, path.join(sub, base), base)) ltxN += 1;
    }
  }
  const sDir = lipsyncMediaDir(packDir);
  if (fs.existsSync(sDir)) {
    for (const name of fs.readdirSync(sDir)) {
      const base = safeBase(name);
      if (!base) continue;
      if (copyInto(studioLipsync, path.join(sDir, base), base)) lipsyncN += 1;
    }
  }

  const worldsDirCandidates = [
    path.join(packDir, "images", "places"),
    path.join(packDir, "worlds"),
  ];
  for (const worldsDir of worldsDirCandidates) {
  if (fs.existsSync(worldsDir)) {
    ensureWorldCardDirs(styleId);
    let packMan: Record<string, { name?: string; brief?: string; placeType?: string }> = {};
    const manPath = path.join(worldsDir, "manifest.json");
    if (fs.existsSync(manPath)) {
      try {
        packMan = JSON.parse(fs.readFileSync(manPath, "utf8")) as typeof packMan;
      } catch {
        packMan = {};
      }
    }
    for (const name of fs.readdirSync(worldsDir)) {
      const base = safeBase(name);
      if (!base || base === "manifest.json" || /\.md$/i.test(base)) continue;
      const key = `g:${base}`;
      const dest = resolveWorldCardThumbPath(styleId, key);
      const destDir = path.dirname(
        dest ||
          path.join(
            path.join(CRASH_DIR, "world-cards", styleId),
            base,
          ),
      );
      if (copyInto(destDir, path.join(worldsDir, base), base)) {
        const lab = packMan[key];
        if (lab?.name) {
          writeWorldCardManifestLabel(styleId, key, {
            name: lab.name,
            brief: lab.brief || lab.name,
            placeType: (lab.placeType as "social_public") || "social_public",
          });
        }
      }
    }
    break;
  }
  }

  const facesDirCandidates = [
    path.join(packDir, "images", "characters"),
    path.join(packDir, "faces"),
  ];
  for (const facesDir of facesDirCandidates) {
  if (fs.existsSync(facesDir)) {
    ensureStyleCardDirs(styleId);
    let packMan: Record<string, { name?: string; brief?: string }> = {};
    const manPath = path.join(facesDir, "manifest.json");
    if (fs.existsSync(manPath)) {
      try {
        packMan = JSON.parse(fs.readFileSync(manPath, "utf8")) as typeof packMan;
      } catch {
        packMan = {};
      }
    }
    for (const name of fs.readdirSync(facesDir)) {
      const base = safeBase(name);
      if (!base || base === "manifest.json" || /\.md$/i.test(base)) continue;
      const key = `g:${base}`;
      const existing = resolveStyleCardThumbPath(styleId, key);
      const destDir = path.dirname(
        existing || path.join(CRASH_DIR, "style-cards", styleId, base),
      );
      if (copyInto(destDir, path.join(facesDir, base), base)) {
        const lab = packMan[key];
        if (lab?.name) {
          writeStyleCardManifestLabel(styleId, key, {
            name: lab.name,
            brief: lab.brief || lab.name,
          });
        }
      }
    }
    break;
  }
  }

  return { plates: plateN, audio: audioN, ltx: ltxN, lipsync: lipsyncN };
}

function beatIdsInStory(story: CrashStoryDoc): Set<string> {
  const ids = new Set<string>();
  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      for (const b of sh.beats) ids.add(b.id);
    }
  }
  return ids;
}

function normalizeComfyDraft(raw: unknown): ComfyDraft {
  const d = (raw || {}) as Partial<ComfyDraft>;
  return {
    global: String(d.global || CRASH_COMFY_DEFAULT_GLOBAL),
    beats:
      d.beats && typeof d.beats === "object" && !Array.isArray(d.beats)
        ? d.beats
        : {},
  };
}

export function listCrashLabEpisodes(
  styleId: ShowStyleId,
): CrashLabEpisodeListItem[] {
  const root = crashLabRoot(styleId);
  if (!fs.existsSync(root)) return [];
  const out: CrashLabEpisodeListItem[] = [];
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (FORBIDDEN.has(ent.name.toLowerCase())) continue;
    if (ent.name.startsWith("crash_")) continue; // old empty placeholders
    if (ent.name === "_RECIPE") continue;
    const dir = path.join(root, ent.name);
    const storyFp = readPackJsonPath(dir, "story.json");
    const kitFp = readPackJsonPath(dir, "scene-kit.json");
    const hasStory = Boolean(storyFp);
    const hasSceneKit = Boolean(kitFp);
    if (!hasStory && !hasSceneKit) continue;
    let meta: Partial<CrashLabEpisodeMeta> = {};
    try {
      const metaFp = readPackJsonPath(dir, "episode.json");
      if (metaFp) {
        meta = JSON.parse(fs.readFileSync(metaFp, "utf8")) as CrashLabEpisodeMeta;
      }
    } catch {
      /* ignore */
    }
    let packStyle = (meta.styleId || styleId) as ShowStyleId;
    if (storyFp) {
      try {
        const st = JSON.parse(fs.readFileSync(storyFp, "utf8")) as CrashStoryDoc;
        if (st.styleId) packStyle = st.styleId;
      } catch {
        /* ignore */
      }
    }
    if (packStyle !== styleId) continue;
    out.push({
      label: String(meta.label || ent.name),
      styleId: packStyle,
      folderName: ent.name,
      savedAt: String(meta.savedAt || ""),
      path: dir,
      hasStory,
      hasSceneKit,
    });
  }
  out.sort((a, b) => {
    const ta = a.savedAt || "";
    const tb = b.savedAt || "";
    if (ta !== tb) return tb.localeCompare(ta);
    return a.label.localeCompare(b.label);
  });
  return out;
}

export function saveCrashLabEpisode(opts: {
  styleId: ShowStyleId;
  label?: string;
  /** Exact _CRASH_LAB folder name — overwrites that pack when it exists. */
  folderName?: string;
  /** Browser Edit prompts — pass from client on Save. */
  comfyDraft?: ComfyDraft | null;
  /**
   * If true, always make a new dated folder.
   * Default false — refresh the same folder (Stuie's overwrite save).
   */
  asNewVersion?: boolean;
}): CrashLabEpisodeListItem {
  let story = readCrashStory(opts.styleId);
  const label =
    (opts.label || story.campaignLabel || "Untitled episode").trim() ||
    "Untitled episode";
  const asNew = opts.asNewVersion === true;

  if (story.campaignLabel !== label) {
    story = { ...story, campaignLabel: label, updatedAt: new Date().toISOString() };
    writeCrashStory(story);
  }

  let folderName = episodeFolderName(
    opts.folderName?.trim() || label,
  );
  let dir = episodePackDir(folderName, opts.styleId);
  if (asNew && resolveRecipeFile(dir, "episode.json")) {
    const stamp = new Date()
      .toISOString()
      .slice(0, 16)
      .replace("T", " ")
      .replace(/:/g, "");
    let n = 2;
    folderName = episodeFolderName(`${label} — save ${stamp}`);
    dir = episodePackDir(folderName, opts.styleId);
    while (resolveRecipeFile(dir, "episode.json")) {
      folderName = episodeFolderName(`${label} — save ${stamp} v${n}`);
      dir = episodePackDir(folderName, opts.styleId);
      n += 1;
    }
  }
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(storyPath(dir), JSON.stringify(story, null, 2));

  const scene = enrichAndPersistSceneKit(opts.styleId, story);
  fs.writeFileSync(sceneKitPath(dir), JSON.stringify(scene, null, 2));

  if (opts.comfyDraft) {
    fs.writeFileSync(
      comfyDraftPath(dir),
      JSON.stringify(normalizeComfyDraft(opts.comfyDraft), null, 2),
    );
  }

  const beatIds = beatIdsInStory(story);
  const ltxSnap = listLtxResultsForStyle(opts.styleId).filter((r) =>
    beatIds.has(r.beatId),
  );
  const lipsyncSnap = listLipsyncResultsForStyle(opts.styleId).filter((r) =>
    beatIds.has(r.beatId),
  );
  fs.writeFileSync(ltxSnapPath(dir), JSON.stringify({ results: ltxSnap }, null, 2));
  fs.writeFileSync(
    lipsyncSnapPath(dir),
    JSON.stringify({ results: lipsyncSnap }, null, 2),
  );

  const media = copyMediaIntoPack(
    dir,
    opts.styleId,
    story,
    scene,
    ltxSnap,
    lipsyncSnap,
  );

  const meta: CrashLabEpisodeMeta = {
    label,
    styleId: opts.styleId,
    folderName,
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(metaPath(dir), JSON.stringify(meta, null, 2));
  fs.writeFileSync(
    whereFilesLivePath(dir),
    [
      "This folder is the episode pack (copy-only — nothing deleted).",
      "",
      "plates\\   — shot stills + title/credits cards",
      "audio\\    — dialogue mp3s for beats + clone samples (sharon.mp3, tom.mp3, …)",
      "mp4\\      — LTX mp4s (after Send)",
      "lipsync\\  — lipsync mp4s (if used)",
      "images\\characters\\ — face cards + PROMPTS.md",
      "images\\places\\     — empty BG places + PROMPTS.md",
      "_RECIPE\\  — story.json / scene-kit.json / episode.json / comfy-draft / ltx+lipsync results",
      "",
      `Last save: plates ${media.plates}, audio ${media.audio}, mp4 ${media.ltx}, lipsync ${media.lipsync}, places ${media.worlds}, characters ${media.faces}`,
      "",
      "Open episode in Crash Lab uses this pack. Recipe lives under _RECIPE\\.",
      "Save refreshes THIS pack — it does not make a dated copy unless you ask for a new version.",
    ].join("\n"),
  );

  return {
    ...meta,
    path: dir,
    hasStory: true,
    hasSceneKit: true,
  };
}

export function openCrashLabEpisode(opts: {
  folderName: string;
  styleId: ShowStyleId;
}): {
  story: CrashStoryDoc;
  sceneKit: SceneKitDiskDraft | null;
  comfyDraft: ComfyDraft | null;
  ltxCount: number;
  lipsyncCount: number;
  backupFile: string | null;
  meta: CrashLabEpisodeMeta;
} {
  const dir = episodePackDir(opts.folderName, opts.styleId);
  const storyFp = readPackJsonPath(dir, "story.json");
  if (!storyFp) {
    throw new Error(
      `No story.json in ${crashLabShowFolderName(opts.styleId)}\\_CRASH_LAB\\${opts.folderName}`,
    );
  }
  const story = JSON.parse(fs.readFileSync(storyFp, "utf8")) as CrashStoryDoc;
  if (!story.styleId) throw new Error("Episode story missing styleId");
  if (story.styleId !== opts.styleId) {
    throw new Error(
      `That pack is ${story.styleId}, not ${opts.styleId}. Switch the style dropdown.`,
    );
  }

  const backupFile = backupCrashStory(story.styleId);
  writeActivePack({
    folderName: opts.folderName,
    styleId: story.styleId,
  });
  // Work IN the pack — do not duplicate media into Studio gen/dialogue.
  writeCrashStory(story);

  let sceneKit: SceneKitDiskDraft | null = null;
  const kitFp = readPackJsonPath(dir, "scene-kit.json");
  if (kitFp) {
    const raw = JSON.parse(fs.readFileSync(kitFp, "utf8")) as SceneKitDiskDraft;
    sceneKit = writeSceneKitDiskDraft(raw);
  }

  let comfyDraft: ComfyDraft | null = null;
  const draftFp = readPackJsonPath(dir, "comfy-draft.json");
  if (draftFp) {
    try {
      comfyDraft = normalizeComfyDraft(JSON.parse(fs.readFileSync(draftFp, "utf8")));
    } catch {
      comfyDraft = null;
    }
  }

  let ltxCount = 0;
  let lipsyncCount = 0;
  const ltxFp = readPackJsonPath(dir, "ltx-results.json");
  if (ltxFp) {
    try {
      const snap = JSON.parse(fs.readFileSync(ltxFp, "utf8")) as {
        results?: LtxBeatResult[];
      };
      for (const r of snap.results || []) {
        if (!r?.beatId || !r.file) continue;
        writeLtxBeatResult({ ...r, styleId: story.styleId });
        ltxCount += 1;
      }
    } catch {
      /* ignore */
    }
  }
  const lipsFp = readPackJsonPath(dir, "lipsync-results.json");
  if (lipsFp) {
    try {
      const snap = JSON.parse(fs.readFileSync(lipsFp, "utf8")) as {
        results?: LipsyncBeatResult[];
      };
      for (const r of snap.results || []) {
        if (!r?.beatId || !r.file) continue;
        writeLipsyncBeatResult({ ...r, styleId: story.styleId });
        lipsyncCount += 1;
      }
    } catch {
      /* ignore */
    }
  }

  let meta: CrashLabEpisodeMeta = {
    label: story.campaignLabel || opts.folderName,
    styleId: story.styleId,
    folderName: opts.folderName,
    savedAt: "",
  };
  const metaFp = readPackJsonPath(dir, "episode.json");
  if (metaFp) {
    try {
      meta = {
        ...meta,
        ...(JSON.parse(fs.readFileSync(metaFp, "utf8")) as CrashLabEpisodeMeta),
      };
    } catch {
      /* ignore */
    }
  }

  return {
    story,
    sceneKit,
    comfyDraft,
    ltxCount,
    lipsyncCount,
    backupFile,
    meta,
  };
}
