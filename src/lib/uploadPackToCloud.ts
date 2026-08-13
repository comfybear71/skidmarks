/**
 * Copy one episode pack into Vercel Blob + Neon rows.
 * Does not delete local files. Call with dryRun: true first.
 */
import fs from "fs";
import path from "path";
import { cloudEnvReady } from "./cloudEnv";
import {
  blobContentType,
  blobPathname,
  putBlobFile,
  type BlobFileKind,
} from "./blobStore";
import {
  episodeRowId,
  upsertNeonEpisode,
  upsertNeonFile,
  upsertNeonShow,
} from "./neonStore";
import { episodePackDir } from "./crashLabEpisodes";
import { getShowStylePreset, type ShowStyleId } from "./showStylePresets";
import { parseStyleCardId } from "./styleCardThumbs";

const SAFE_FILE = /^[\w.\-]+$/;
const MEDIA_EXT: Record<BlobFileKind, RegExp> = {
  plates: /\.(png|jpe?g|webp|gif)$/i,
  audio: /\.(mp3|wav|ogg|m4a)$/i,
  mp4: /\.mp4$/i,
};

export type CloudUploadPlanFile = {
  kind: BlobFileKind;
  filename: string;
  bytes: number;
  absPath: string;
  pathname: string;
};

export type CloudUploadPlan = {
  showId: ShowStyleId;
  showName: string;
  folderName: string;
  episodeId: string;
  label: string;
  files: CloudUploadPlanFile[];
  hasStory: boolean;
  hasSceneKit: boolean;
  storyJson: unknown | null;
  sceneKitJson: unknown | null;
  comfyDraftJson: unknown | null;
};

function readJsonIfPresent(dir: string, names: string[]): unknown | null {
  for (const name of names) {
    const modern = path.join(dir, "_RECIPE", name);
    const legacy = path.join(dir, name);
    const fp = fs.existsSync(modern) ? modern : fs.existsSync(legacy) ? legacy : "";
    if (!fp) continue;
    try {
      return JSON.parse(fs.readFileSync(fp, "utf8"));
    } catch {
      return null;
    }
  }
  return null;
}

function listKindFiles(
  packDir: string,
  kind: BlobFileKind,
  subdirs: string[],
  showId: string,
  folderName: string,
): CloudUploadPlanFile[] {
  const out: CloudUploadPlanFile[] = [];
  const seen = new Set<string>();
  for (const sub of subdirs) {
    const dir = path.join(packDir, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!SAFE_FILE.test(name) || !MEDIA_EXT[kind].test(name)) continue;
      if (seen.has(name)) continue;
      const abs = path.join(dir, name);
      let st: fs.Stats;
      try {
        st = fs.statSync(abs);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;
      seen.add(name);
      out.push({
        kind,
        filename: name,
        bytes: st.size,
        absPath: abs,
        pathname: blobPathname(showId, folderName, kind, name),
      });
    }
  }
  return out;
}

export function planPackUpload(opts: {
  styleId: string;
  folderName: string;
}): CloudUploadPlan {
  const styleId = parseStyleCardId(opts.styleId);
  if (!styleId) throw new Error("Need a real show styleId");
  const folderName = String(opts.folderName || "").trim();
  if (!folderName || folderName.includes("..") || folderName.includes("/") || folderName.includes("\\")) {
    throw new Error("Need a pack folder name");
  }
  const packDir = episodePackDir(folderName, styleId);
  if (!fs.existsSync(packDir)) {
    throw new Error(`Pack not on this PC: ${folderName}`);
  }
  const meta = readJsonIfPresent(packDir, ["episode.json"]) as {
    label?: string;
  } | null;
  const story = readJsonIfPresent(packDir, ["story.json"]);
  const sceneKit = readJsonIfPresent(packDir, ["scene-kit.json"]);
  const comfyDraft = readJsonIfPresent(packDir, ["comfy-draft.json"]);
  const label =
    (meta && typeof meta.label === "string" && meta.label.trim()) ||
    (story &&
    typeof story === "object" &&
    story &&
    "campaignLabel" in story &&
    typeof (story as { campaignLabel?: string }).campaignLabel === "string"
      ? (story as { campaignLabel: string }).campaignLabel
      : "") ||
    folderName;
  const preset = getShowStylePreset(styleId);
  const files = [
    ...listKindFiles(packDir, "plates", ["plates"], styleId, folderName),
    ...listKindFiles(packDir, "audio", ["audio"], styleId, folderName),
    ...listKindFiles(packDir, "mp4", ["mp4", "ltx", "lipsync"], styleId, folderName),
  ];
  return {
    showId: styleId,
    showName: preset.label,
    folderName,
    episodeId: episodeRowId(styleId, folderName),
    label,
    files,
    hasStory: Boolean(story),
    hasSceneKit: Boolean(sceneKit),
    storyJson: story,
    sceneKitJson: sceneKit,
    comfyDraftJson: comfyDraft,
  };
}

export async function uploadPackToCloud(opts: {
  styleId: string;
  folderName: string;
  dryRun?: boolean;
}): Promise<{
  ok: true;
  dryRun: boolean;
  showId: ShowStyleId;
  folderName: string;
  label: string;
  fileCount: number;
  bytes: number;
  uploaded: number;
  files: { kind: BlobFileKind; filename: string; bytes: number; pathname: string }[];
}> {
  if (!cloudEnvReady()) {
    throw new Error("Need DATABASE_URL and BLOB_READ_WRITE_TOKEN");
  }
  const plan = planPackUpload(opts);
  const summaryFiles = plan.files.map((f) => ({
    kind: f.kind,
    filename: f.filename,
    bytes: f.bytes,
    pathname: f.pathname,
  }));
  const bytes = plan.files.reduce((n, f) => n + f.bytes, 0);
  if (opts.dryRun !== false) {
    return {
      ok: true,
      dryRun: true,
      showId: plan.showId,
      folderName: plan.folderName,
      label: plan.label,
      fileCount: plan.files.length,
      bytes,
      uploaded: 0,
      files: summaryFiles,
    };
  }

  await upsertNeonShow(plan.showId, plan.showName);
  await upsertNeonEpisode({
    showId: plan.showId,
    folderName: plan.folderName,
    name: plan.label,
    hasStory: plan.hasStory,
    hasSceneKit: plan.hasSceneKit,
    storyJson: plan.storyJson,
    sceneKitJson: plan.sceneKitJson,
    comfyDraftJson: plan.comfyDraftJson,
  });

  let uploaded = 0;
  for (const file of plan.files) {
    const body = fs.readFileSync(file.absPath);
    const put = await putBlobFile({
      pathname: file.pathname,
      body,
      contentType: blobContentType(file.kind, file.filename),
    });
    await upsertNeonFile({
      episodeId: plan.episodeId,
      kind: file.kind,
      blobUrl: put.url,
      filename: file.filename,
      blobPathname: put.pathname,
    });
    uploaded += 1;
  }

  return {
    ok: true,
    dryRun: false,
    showId: plan.showId,
    folderName: plan.folderName,
    label: plan.label,
    fileCount: plan.files.length,
    bytes,
    uploaded,
    files: summaryFiles,
  };
}
