import fs from "fs";
import path from "path";
import { swapDeepfakePlate } from "./deepfakePlateSwap";
import { exportComfyBundle } from "./crashComfyExport";
import { addCrashSpxGeneratedSound } from "./crashSpx";
import { readCrashStory, writeCrashStory } from "./crashStory";
import type { CrashStoryDoc, CrashStorySfx } from "./crashStoryTypes";
import { synthesizeStoryBeat, storyAudioPath } from "./crashStorySpeak";
import { generateSoundEffect } from "./elevenLabs";
import { ensureCursorVoiceReady, refreshCrashVoiceId } from "./crashVoice";
import { seedVoiceManifestForStyle } from "./crashVoiceSeed";
import { buildCrashGenLook, generateFaceImage } from "./imageGen";
import { CRASH_DIR } from "./paths";
import {
  clearPopulateProgress,
  writePopulateProgress,
} from "./cursorPopulateProgress";
import {
  cursorCastKeys,
  cursorPopulateConfigForStory,
  type CursorShotPlan,
} from "./cursorPopulateConfig";
import { plateCastIntoGen } from "./plateCast";
import { readStyleCardThumbByKey } from "./styleCardThumbs";
import { resolveWorldCardThumbPath } from "./worldCardThumbs";
import {
  getShowStylePreset,
  type ShowStyleId,
} from "./showStylePresets";
import { sortableId } from "./types";

function storyBackupPath(styleId: ShowStyleId): string | null {
  const dir = path.join(CRASH_DIR, "story", styleId);
  if (!fs.existsSync(dir)) return null;
  const backups = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("story_backup_") && f.endsWith(".json"))
    .sort()
    .reverse();
  if (!backups.length) return null;
  return path.join(dir, backups[0]);
}

function applyIntroOutroFromBackup(
  story: CrashStoryDoc,
  backup: CrashStoryDoc,
): CrashStoryDoc {
  return {
    ...story,
    intro: {
      ...story.intro,
      logoFile: backup.intro.logoFile || story.intro.logoFile,
      sfx: story.intro.sfx.map((row, i) => ({
        ...row,
        spxId: backup.intro.sfx[i]?.spxId ?? row.spxId,
      })),
    },
    outro: {
      ...story.outro,
      logoFile: backup.outro.logoFile || story.outro.logoFile,
      sfx: story.outro.sfx.map((row, i) => ({
        ...row,
        spxId: backup.outro.sfx[i]?.spxId ?? row.spxId,
      })),
    },
  };
}

function resolveCastKey(
  castKeys: Record<string, string>,
  name: string,
): string | undefined {
  if (castKeys[name]) return castKeys[name];
  const lower = name.trim().toLowerCase();
  for (const [label, key] of Object.entries(castKeys)) {
    if (label.trim().toLowerCase() === lower) return key;
  }
  return undefined;
}

function loadCastBuffers(
  styleId: ShowStyleId,
  names: string[],
): { buf: Buffer; ext: string; name: string }[] {
  const castKeys = cursorCastKeys(styleId);
  const out: { buf: Buffer; ext: string; name: string }[] = [];
  for (const name of names) {
    const key = resolveCastKey(castKeys, name);
    if (!key) throw new Error(`No cast key for ${name}`);
    const img = readStyleCardThumbByKey(styleId, key);
    if (!img) throw new Error(`Missing cast thumb for ${name}`);
    const ext = path.extname(img.fileName).toLowerCase() || ".png";
    out.push({ buf: img.buf, ext, name });
  }
  return out;
}

async function generateBookendCard(
  styleId: ShowStyleId,
  cardPrompt: string,
): Promise<string> {
  const realism = getShowStylePreset(styleId).defaultRealism;
  const look = buildCrashGenLook(styleId, realism);
  const prompt = `${cardPrompt}\n\n${look}\n\n16:9 title card still. No people.`;
  const { buffer, ext } = await generateFaceImage({
    prompt,
    referencePaths: [],
    aspectRatio: "16:9",
  });
  const fileName = `${sortableId("cgen")}${ext.startsWith(".") ? ext : `.${ext}`}`;
  const genDir = path.join(CRASH_DIR, "gen");
  if (!fs.existsSync(genDir)) fs.mkdirSync(genDir, { recursive: true });
  fs.writeFileSync(path.join(genDir, fileName), buffer);
  return fileName;
}

async function generateShotPlate(
  styleId: ShowStyleId,
  plan: CursorShotPlan,
): Promise<string> {
  const bgPath = resolveWorldCardThumbPath(styleId, plan.placeKey);
  if (!bgPath) throw new Error(`Missing world place ${plan.placeKey}`);

  const cast = loadCastBuffers(styleId, plan.cast);
  const genDir = path.join(CRASH_DIR, "gen");

  if (cast.length === 1) {
    const r = await plateCastIntoGen({
      styleId,
      bgPath,
      castFiles: [cast[0]],
      castNames: [cast[0].name],
      placeName: plan.placeName,
      note: plan.note,
    });
    return r.fileName;
  }

  const first = await plateCastIntoGen({
    styleId,
    bgPath,
    castFiles: cast.slice(0, 2),
    castNames: cast.slice(0, 2).map((c) => c.name),
    placeName: plan.placeName,
    note: plan.note,
    totalPeople: cast.length,
  });

  if (cast.length === 2) return first.fileName;

  const chainBg = path.join(genDir, first.fileName);
  const second = await plateCastIntoGen({
    styleId,
    bgPath: chainBg,
    castFiles: [cast[2]],
    castNames: [cast[2].name],
    placeName: plan.placeName,
    note: plan.note,
    chainPass: true,
    totalPeople: cast.length,
  });
  return second.fileName;
}

async function finishDeepfakePlate(
  styleId: ShowStyleId,
  plan: CursorShotPlan,
  plateFile: string,
  push: (msg: string) => void,
  onSwapTick?: (label: string) => void,
): Promise<void> {
  if (styleId !== "deepfake") return;
  onSwapTick?.(`FaceFusion — ${plan.placeName}`);
  push(`  ↻ FaceFusion swap (${plan.cast.join(", ")})…`);
  await swapDeepfakePlate(styleId, plan, plateFile);
  push(`  → swapped ${plateFile}`);
}

function patchShotPlate(
  doc: CrashStoryDoc,
  shotId: string,
  plateFile: string,
): CrashStoryDoc {
  return {
    ...doc,
    scenes: doc.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((sh) =>
        sh.id === shotId ? { ...sh, plateFile } : sh,
      ),
    })),
  };
}

function patchBookendLogo(
  doc: CrashStoryDoc,
  which: "intro" | "outro",
  logoFile: string,
): CrashStoryDoc {
  if (which === "intro") {
    return { ...doc, intro: { ...doc.intro, logoFile } };
  }
  return { ...doc, outro: { ...doc.outro, logoFile } };
}

function patchSfxSpaxId(
  doc: CrashStoryDoc,
  sfxId: string,
  spxId: string,
): CrashStoryDoc {
  const patchList = (rows: CrashStorySfx[]) =>
    rows.map((r) => (r.id === sfxId ? { ...r, spxId } : r));

  return {
    ...doc,
    intro: { ...doc.intro, sfx: patchList(doc.intro.sfx) },
    outro: { ...doc.outro, sfx: patchList(doc.outro.sfx) },
    scenes: doc.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((sh) => ({
        ...sh,
        sfx: patchList(sh.sfx),
      })),
    })),
  };
}

function allSfxRows(doc: CrashStoryDoc): CrashStorySfx[] {
  const rows: CrashStorySfx[] = [...doc.intro.sfx, ...doc.outro.sfx];
  for (const sc of doc.scenes) {
    for (const sh of sc.shots) rows.push(...sh.sfx);
  }
  return rows;
}

function spxFileExists(styleId: ShowStyleId, spxId: string): boolean {
  const manifest = path.join(CRASH_DIR, "spx", styleId, "manifest.json");
  if (!fs.existsSync(manifest)) return false;
  try {
    const items = JSON.parse(fs.readFileSync(manifest, "utf8")) as {
      id: string;
    }[];
    return items.some((i) => i.id === spxId);
  } catch {
    return false;
  }
}

/** Plates only — no voice, no SFX. Deep fake runs FaceFusion after each plate. */
export async function populateCursorPlates(
  styleId: ShowStyleId,
): Promise<{ ok: true; log: string[]; story: CrashStoryDoc }> {
  const log: string[] = [];
  const push = (msg: string) => {
    log.push(msg);
    console.log(msg);
  };

  let story = readCrashStory(styleId);
  const config = cursorPopulateConfigForStory(story);
  if (!config) throw new Error(`No cursor populate config for ${styleId}`);

  const { shotPlans } = config;
  story.scenes[0].worldThumbKey = shotPlans[0].placeKey;
  story.scenes[0].placeName = shotPlans[0].placeName;

  const total = shotPlans.length;
  let current = 0;

  for (const plan of shotPlans) {
    const existing = story.scenes
      .flatMap((sc) => sc.shots)
      .find((sh) => sh.id === plan.shotId);
    if (existing?.plateFile) {
      push(`Plate skip ${plan.shotId} — ${existing.plateFile}`);
      current += 1;
      continue;
    }
    writePopulateProgress({
      phase: "plates",
      current,
      total,
      label: `Plate ${current + 1}/${total} — ${plan.placeName}`,
    });
    push(`Plate: ${plan.shotId}…`);
    const plateFile = await generateShotPlate(styleId, plan);
    await finishDeepfakePlate(styleId, plan, plateFile, push, (label) => {
      writePopulateProgress({
        phase: "swap",
        current,
        total,
        label,
      });
    });
    story = patchShotPlate(story, plan.shotId, plateFile);
    writeCrashStory(story);
    if (styleId !== "deepfake") push(`  → ${plateFile}`);
    current += 1;
  }

  writePopulateProgress({
    phase: "done",
    current: total,
    total,
    label: styleId === "deepfake" ? "Plates + FaceFusion ready" : "Plates ready",
  });
  push(
    styleId === "deepfake"
      ? "Plates done — FaceFusion swapped."
      : "Plates done.",
  );

  return { ok: true, log, story: readCrashStory(styleId) };
}

/** Plates + voices + shot SFX. Sunny Banks reuses intro/outro cards from backup when present. */
export async function populateCursorGag(
  styleId: ShowStyleId = "skidmarks",
): Promise<{
  ok: true;
  log: string[];
  export?: import("./crashComfyExport").ComfyExportResult;
}> {
  seedVoiceManifestForStyle(styleId);

  const log: string[] = [];
  const push = (msg: string) => {
    log.push(msg);
    console.log(msg);
  };

  let story = readCrashStory(styleId);
  const config = cursorPopulateConfigForStory(story);
  if (!config) throw new Error(`No cursor populate config for ${styleId}`);
  const backupPath = storyBackupPath(styleId);
  if (backupPath) {
    const backup = JSON.parse(
      fs.readFileSync(backupPath, "utf8"),
    ) as CrashStoryDoc;
    if (backup.intro.logoFile || backup.outro.logoFile) {
      story = applyIntroOutroFromBackup(story, backup);
      push(`Intro/outro cards reused from previous run`);
      writeCrashStory(story);
    }
  }

  const { shotPlans, sfxPrompts, introPrompt, outroPrompt } = config;
  story.scenes[0].worldThumbKey = shotPlans[0].placeKey;
  story.scenes[0].placeName = shotPlans[0].placeName;

  type Work =
    | { kind: "intro" }
    | { kind: "outro" }
    | { kind: "plate"; plan: CursorShotPlan }
    | { kind: "voice"; beat: { id: string; speaker: string; text: string } }
    | { kind: "sfx"; row: CrashStorySfx };

  const work: Work[] = [];

  if (!story.intro.logoFile && introPrompt) work.push({ kind: "intro" });
  if (!story.outro.logoFile && outroPrompt) work.push({ kind: "outro" });

  for (const plan of shotPlans) {
    const existing = story.scenes
      .flatMap((sc) => sc.shots)
      .find((sh) => sh.id === plan.shotId);
    if (!existing?.plateFile) work.push({ kind: "plate", plan });
  }

  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      for (const beat of sh.beats) {
        if (!beat.text.trim()) continue;
        if (!storyAudioPath(styleId, beat.id)) {
          work.push({ kind: "voice", beat });
        }
      }
    }
  }

  for (const row of allSfxRows(story)) {
    if (row.spxId && spxFileExists(styleId, row.spxId)) continue;
    if (!sfxPrompts[row.id]) continue;
    work.push({ kind: "sfx", row });
  }

  const total = Math.max(1, work.length);
  let current = 0;

  const tick = (phase: "plates" | "swap" | "voices" | "sfx", label: string) => {
    writePopulateProgress({ phase, current, total, label });
  };

  clearPopulateProgress();
  writePopulateProgress({
    phase: "plates",
    current: 0,
    total,
    label: "Starting build…",
  });

  try {
    for (const item of work) {
      if (item.kind === "intro") {
        tick("plates", `Intro card ${current + 1}/${total}`);
        push("Intro title card…");
        const logoFile = await generateBookendCard(styleId, introPrompt);
        story = patchBookendLogo(story, "intro", logoFile);
        writeCrashStory(story);
        push(`  → ${logoFile}`);
      } else if (item.kind === "outro") {
        tick("plates", `Outro card ${current + 1}/${total}`);
        push("Outro title card…");
        const logoFile = await generateBookendCard(styleId, outroPrompt);
        story = patchBookendLogo(story, "outro", logoFile);
        writeCrashStory(story);
        push(`  → ${logoFile}`);
      } else if (item.kind === "plate") {
        const plan = item.plan;
        tick("plates", `Plate ${current + 1}/${total} — ${plan.placeName}`);
        push(`Plate: ${plan.shotId}…`);
        const plateFile = await generateShotPlate(styleId, plan);
        await finishDeepfakePlate(styleId, plan, plateFile, push, (label) => {
          tick("swap", `Swap ${current + 1}/${total} — ${label}`);
        });
        story = patchShotPlate(story, plan.shotId, plateFile);
        writeCrashStory(story);
        if (styleId !== "deepfake") push(`  → ${plateFile}`);
      } else if (item.kind === "voice") {
        const beat = item.beat;
        tick("voices", `Voice ${current + 1}/${total} — ${beat.speaker}`);
        push(`Voice: ${beat.speaker} — ${beat.text.slice(0, 40)}…`);
        await ensureCursorVoiceReady(styleId, beat.speaker);
        let result;
        try {
          result = await synthesizeStoryBeat({
            styleId,
            beatId: beat.id,
            speaker: beat.speaker,
            text: beat.text,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (
            msg.includes("was not found") ||
            msg.includes("no ElevenLabs voice")
          ) {
            push(`  ↻ refreshing ${beat.speaker} voice…`);
            await refreshCrashVoiceId(styleId, beat.speaker);
            result = await synthesizeStoryBeat({
              styleId,
              beatId: beat.id,
              speaker: beat.speaker,
              text: beat.text,
            });
          } else {
            throw e;
          }
        }
        story = result.story;
        push(`  → ${result.voiceFile}`);
      } else {
        const row = item.row;
        tick("sfx", `SFX ${current + 1}/${total} — ${row.label}`);
        push(`SFX: ${row.label}…`);
        const sfxItem = addCrashSpxGeneratedSound({
          styleId,
          buffer: await generateSoundEffect({
            text: sfxPrompts[row.id],
            durationSeconds: 3,
          }),
          label: row.label,
          prompt: sfxPrompts[row.id],
        });
        story = patchSfxSpaxId(story, row.id, sfxItem.id);
        writeCrashStory(story);
        push(`  → ${sfxItem.id}`);
      }
      current += 1;
    }

    writeCrashStory(story);
    writePopulateProgress({
      phase: "done",
      current: total,
      total,
      label: "Build complete",
    });
    push("Done — storyboard should be 6/6 filled.");

    const finalStory = readCrashStory(styleId);
    const exported = exportComfyBundle({ story: finalStory, styleId });
    push(`Archived → ${exported.archiveRootRelative || exported.outRootRelative}`);

    return { ok: true, log, export: exported };
  } catch (e) {
    writePopulateProgress({
      phase: "error",
      current,
      total,
      label: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
