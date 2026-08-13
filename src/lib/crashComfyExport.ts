import fs from "fs";
import path from "path";
import {
  CRASH_COMFY_DEFAULT_GLOBAL,
  defaultImageMotion,
  defaultSegmentText,
  listComfyBeats,
  shotGroups,
} from "./crashComfyStack";
import { readCrashSpxManifest, crashSpxFilePath } from "./crashSpx";
import { findBeatInStory } from "./crashStorySpeak";
import type { CrashStoryDoc, CrashStorySfx } from "./crashStoryTypes";
import {
  dialogueFileName,
  sfxFileName,
  shotFolderName,
} from "./crashStoryNames";
import { mirrorCampaignToShowArchive } from "./mirrorShowArchive";
import {
  storyDialogueDir,
  writeExportManifest,
} from "./crashStoryLocations";
import {
  toShowMoviesPath,
} from "./showArchivePaths";
import { CRASH_DIR, MOVIES_ROOT } from "./paths";
import type { ShowStyleId } from "./showStylePresets";

export type ComfyExportResult = {
  outRoot: string;
  outRootRelative: string;
  archiveRoot: string | null;
  archiveRootRelative: string | null;
  comfyMd: string;
  comfyMdRelative: string;
  manifest: string[];
  shots: { shotId: string; title: string; folder: string; ready: number; total: number }[];
};

function slugLabel(label: string): string {
  return label
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 48);
}

function copyIfExists(src: string, dest: string): boolean {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

function resolveDialogueSrc(
  styleId: ShowStyleId,
  beatId: string,
  voiceFile: string | undefined,
  legacyAudioDir: string,
): string | null {
  const dialogueDir = storyDialogueDir(styleId);
  const candidates = [
    voiceFile ? path.join(dialogueDir, voiceFile) : "",
    voiceFile ? path.join(legacyAudioDir, voiceFile) : "",
    path.join(legacyAudioDir, `${beatId}.mp3`),
    path.join(dialogueDir, `${beatId}.mp3`),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function exportSfxCopy(opts: {
  styleId: ShowStyleId;
  sfx: CrashStorySfx;
  shotNum: number;
  destDir: string;
}): string | null {
  if (!opts.sfx.spxId) return null;
  const shelf = readCrashSpxManifest(opts.styleId);
  const hit = shelf.find((r) => r.id === opts.sfx.spxId);
  if (!hit) return null;
  const src = crashSpxFilePath(opts.styleId, hit.kind, hit.fileName);
  if (!src || !fs.existsSync(src)) return null;
  const name = sfxFileName({ shotNum: opts.shotNum, label: opts.sfx.label });
  copyIfExists(src, path.join(opts.destDir, name));
  return name;
}

function buildComfyMd(opts: {
  story: CrashStoryDoc;
  styleId: ShowStyleId;
  outRoot: string;
  shotFolders: ComfyExportResult["shots"];
}): string {
  const lines: string[] = [
    `# ${opts.story.campaignLabel || "Story"} — Comfy prompts`,
    ``,
    `768×512 · guide **0.45** on talk images · **AUDIO Inpaint OFF** when mp3 under IMAGE row`,
    ``,
    `## GLOBAL (paste once per shot queue)`,
    ``,
    "```",
    CRASH_COMFY_DEFAULT_GLOBAL,
    "```",
    ``,
    `## Folders`,
    ``,
    `- **Comfy upload:** each shot folder — plate PNG + mp3 (flat). All prompts in \`comfy/COMFY.md\` at campaign root.`,
    `- **Resolve later:** SFX only — each shot's \`sfx_for_resolve/\` subfolder (never in Comfy)`,
    ``,
    `Load checklist: \`MY MOVIES\\_DOCUMENTS\\06_Pod_And_ComfyUI_Setup\\02_ComfyUI_Load_Every_Time.md\``,
    ``,
    `Export root: \`${opts.outRoot}\``,
    ``,
    `---`,
    ``,
  ];

  let shotNum = 0;
  for (const scene of opts.story.scenes) {
    for (const shot of scene.shots) {
      shotNum += 1;
      const folder = opts.shotFolders.find((s) => s.shotId === shot.id);
      lines.push(`## Shot ${shotNum} — ${shot.title}`);
      lines.push(``);
      lines.push(`Folder: \`${folder?.folder || shot.id}/\``);
      if (shot.plateFile) lines.push(`Plate: \`${shot.plateFile}\``);
      lines.push(``);

      shot.beats.forEach((beat, i) => {
        const ctx = findBeatInStory(opts.story, beat.id);
        const mp3 = ctx
          ? dialogueFileName({
              shotNum: ctx.shotNum,
              beatNum: ctx.beatNum,
              speaker: ctx.speaker,
              text: ctx.text,
            })
          : beat.voiceFile || `${beat.id}.mp3`;
        const row = {
          beatId: beat.id,
          shotId: shot.id,
          shotTitle: shot.title,
          shotIndex: shotNum - 1,
          beatIndex: i,
          speaker: beat.speaker,
          text: beat.text,
          plateFile: shot.plateFile,
          voiceFile: mp3,
          sceneTitle: scene.title,
          placeName: scene.placeName,
        };
        lines.push(`### Beat ${i + 1} — ${beat.speaker}`);
        lines.push(`MP3: \`${mp3}\` (same folder as plate)`);
        lines.push(``);
        lines.push(`**IMAGE**`);
        lines.push("```");
        lines.push(defaultImageMotion(row));
        lines.push("```");
        lines.push(``);
        lines.push(`**SEGMENT TEXT**`);
        lines.push("```");
        lines.push(defaultSegmentText(row));
        lines.push("```");
        lines.push(``);
      });

      if (shot.sfx.length) {
        lines.push(`**SFX (Resolve only — folder sfx_for_resolve/)**`);
        for (const sfx of shot.sfx) {
          lines.push(`- ${sfxFileName({ shotNum, label: sfx.label })} — ${sfx.label}`);
        }
        lines.push(``);
      }
      lines.push(`---`);
      lines.push(``);
    }
  }

  return lines.join("\n");
}

export function exportComfyBundle(opts: {
  story: CrashStoryDoc;
  styleId: ShowStyleId;
  folderName?: string;
}): ComfyExportResult {
  const { story, styleId } = opts;
  const rows = listComfyBeats(story);
  const groups = shotGroups(rows);

  const label =
    opts.folderName ||
    slugLabel(story.campaignLabel || "cursor-gag") ||
    "cursor-gag";

  const outRoot = path.join(CRASH_DIR, "comfy-export", styleId, label);
  const genDir = path.join(CRASH_DIR, "gen");
  const legacyAudioDir = path.join(CRASH_DIR, "story", styleId, "audio");

  fs.mkdirSync(outRoot, { recursive: true });

  const shotResults: ComfyExportResult["shots"] = [];
  let shotNum = 0;

  for (const group of groups) {
    shotNum += 1;
    const folder = shotFolderName({
      shotNum,
      shotId: group.shotId,
      title: group.shotTitle,
    });
    const shotDir = path.join(outRoot, folder);
    const sfxDir = path.join(shotDir, "sfx_for_resolve");
    fs.mkdirSync(shotDir, { recursive: true });
    fs.mkdirSync(sfxDir, { recursive: true });

    for (const row of group.rows) {
      const ctx = findBeatInStory(story, row.beatId);
      const readable = ctx
        ? dialogueFileName({
            shotNum: ctx.shotNum,
            beatNum: ctx.beatNum,
            speaker: ctx.speaker,
            text: ctx.text,
          })
        : row.voiceFile || `${row.beatId}.mp3`;
      const src = resolveDialogueSrc(
        styleId,
        row.beatId,
        row.voiceFile,
        legacyAudioDir,
      );
      if (src) {
        copyIfExists(src, path.join(shotDir, readable));
      }
    }

    const plateName = group.rows[0]?.plateFile;
    if (plateName) {
      copyIfExists(path.join(genDir, plateName), path.join(shotDir, plateName));
    }

    const storyShot = story.scenes
      .flatMap((sc) => sc.shots)
      .find((s) => s.id === group.shotId);
    if (storyShot) {
      for (const sfx of storyShot.sfx) {
        exportSfxCopy({
          styleId,
          sfx,
          shotNum,
          destDir: sfxDir,
        });
      }
    }

    const ready = group.rows.filter((r) => {
      const src = resolveDialogueSrc(
        styleId,
        r.beatId,
        r.voiceFile,
        legacyAudioDir,
      );
      return Boolean(r.plateFile && src);
    }).length;

    shotResults.push({
      shotId: group.shotId,
      title: group.shotTitle,
      folder,
      ready,
      total: group.rows.length,
    });
  }

  const comfyMdPath = path.join(outRoot, "COMFY.md");
  const comfyMd = buildComfyMd({
    story,
    styleId,
    outRoot,
    shotFolders: shotResults,
  });
  fs.writeFileSync(comfyMdPath, comfyMd, "utf8");

  const storyComfyMd = path.join(CRASH_DIR, "story", styleId, "COMFY.md");
  fs.writeFileSync(storyComfyMd, comfyMd, "utf8");

  const manifest: string[] = [
    `# Comfy export — ${story.campaignLabel || label}`,
    `Style: ${styleId}`,
    ``,
    `Each shot folder (flat — only sfx_for_resolve/ nested):`,
    `- plate PNG + voice mp3`,
    `- sfx_for_resolve/ — SFX for Resolve only`,
    ``,
    `All Comfy prompts: comfy/COMFY.md`,
    ``,
    ...shotResults.map(
      (s) =>
        `- ${s.folder}/ — ${s.title} (${s.ready}/${s.total} beats ready)`,
    ),
  ];
  fs.writeFileSync(path.join(outRoot, "README.txt"), manifest.join("\n"), "utf8");

  const storyJsonSrc = path.join(CRASH_DIR, "story", styleId, "story.json");
  const mirror = mirrorCampaignToShowArchive({
    styleId,
    story,
    exportRoot: outRoot,
    comfyMd: comfyMdPath,
    storyJsonSrc,
  });

  writeExportManifest(styleId, {
    exportRoot: outRoot,
    comfyMd: mirror.archiveRoot
      ? path.join(mirror.archiveRoot, "comfy", "COMFY.md")
      : comfyMdPath,
    campaignLabel: story.campaignLabel || label,
    exportShots: shotResults.map((s) => ({
      shotId: s.shotId,
      title: s.title,
      folder: s.folder,
    })),
    archiveRoot: mirror.archiveRoot,
  });

  const outRootRelative = toShowMoviesPath(outRoot);
  const comfyMdRelative = mirror.archiveRoot
    ? toShowMoviesPath(path.join(mirror.archiveRoot, "comfy", "COMFY.md"))
    : toShowMoviesPath(comfyMdPath);

  return {
    outRoot,
    outRootRelative,
    archiveRoot: mirror.archiveRoot,
    archiveRootRelative: mirror.archiveRootDisplay,
    comfyMd: comfyMdPath,
    comfyMdRelative,
    manifest,
    shots: shotResults,
  };
}

export function readStoryJsonFile(storyPath: string): CrashStoryDoc {
  const abs = path.isAbsolute(storyPath)
    ? storyPath
    : path.join(MOVIES_ROOT, storyPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Story file not found: ${abs}`);
  }
  return JSON.parse(fs.readFileSync(abs, "utf8")) as CrashStoryDoc;
}
