import type { CrashStoryDoc } from "./crashStoryTypes";
import { sanitizeDialogueForSpeech } from "./sanitizeDialogue";

/** Gold stack GLOBAL — lip polish + Skidmarks look lock (stops photo drift). */
export const CRASH_COMFY_DEFAULT_GLOBAL =
  "perfect lip sync, clear lip movement, citing the dialogue clearly, facial expressions and hand gestures are lively, dication is perfect. highly detailed stylised 3D animated feature render, clean simplified forms, believable materials, soft overcast lighting, cinematic quality, sharp focus. Not photographic, not a cartoon, not photorealistic";

export const SKIDMARKS_LTX_STYLE_LOCK =
  "highly detailed stylised 3D animated feature render, clean simplified forms, believable materials, soft overcast lighting, shallow depth of field with blurred background, cinematic quality, sharp focus. Not photographic, not a cartoon, not photorealistic";

export type ComfyBeatRow = {
  beatId: string;
  shotId: string;
  shotTitle: string;
  shotIndex: number;
  beatIndex: number;
  speaker: string;
  text: string;
  plateFile: string;
  voiceFile?: string;
  sceneId: string;
  sceneTitle: string;
  placeName: string;
};

export type ComfyDraft = {
  global: string;
  beats: Record<
    string,
    {
      imageMotion: string;
      segmentText: string;
    }
  >;
};

export function comfyDraftKey(styleId: string): string {
  return `crash-comfy-draft-${styleId}`;
}

export function readComfyDraft(styleId: string): ComfyDraft {
  try {
    const raw = localStorage.getItem(comfyDraftKey(styleId));
    if (raw) {
      const parsed = JSON.parse(raw) as ComfyDraft;
      return {
        global: parsed.global || CRASH_COMFY_DEFAULT_GLOBAL,
        beats: parsed.beats || {},
      };
    }
  } catch {
    /* ignore */
  }
  return { global: CRASH_COMFY_DEFAULT_GLOBAL, beats: {} };
}

export function ensureLtxStyleLock(global: string): string {
  const g = (global || "").trim() || CRASH_COMFY_DEFAULT_GLOBAL;
  if (/not photographic/i.test(g) && /stylised 3D/i.test(g)) return g;
  return `${g}. ${SKIDMARKS_LTX_STYLE_LOCK}`;
}

export function writeComfyDraft(styleId: string, draft: ComfyDraft): void {
  try {
    localStorage.setItem(comfyDraftKey(styleId), JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

/** Synthetic ids for title/credits cards in Animatic / LTX. */
export const COMFY_INTRO_BEAT_ID = "__intro__";
export const COMFY_OUTRO_BEAT_ID = "__outro__";

export function listComfyBeats(doc: CrashStoryDoc): ComfyBeatRow[] {
  const out: ComfyBeatRow[] = [];
  const firstPlace = doc.scenes[0]?.placeName || "";

  if (doc.intro.logoFile?.trim()) {
    out.push({
      beatId: COMFY_INTRO_BEAT_ID,
      shotId: "__intro_shot__",
      shotTitle: doc.intro.title || "Intro",
      shotIndex: -1,
      beatIndex: 0,
      speaker: "Title card",
      text: doc.intro.title || doc.campaignLabel || "Intro",
      plateFile: doc.intro.logoFile,
      voiceFile: doc.intro.voiceFile,
      sceneId: "__intro__",
      sceneTitle: doc.intro.title || "Intro",
      placeName: firstPlace || "Title",
    });
  }

  for (const scene of doc.scenes) {
    scene.shots.forEach((shot, shotIndex) => {
      shot.beats.forEach((beat, beatIndex) => {
        out.push({
          beatId: beat.id,
          shotId: shot.id,
          shotTitle: shot.title,
          shotIndex,
          beatIndex,
          speaker: beat.speaker,
          text: beat.text,
          plateFile: shot.plateFile,
          voiceFile: beat.voiceFile,
          sceneId: scene.id,
          sceneTitle: scene.title,
          placeName: scene.placeName,
        });
      });
    });
  }

  if (doc.outro.logoFile?.trim()) {
    out.push({
      beatId: COMFY_OUTRO_BEAT_ID,
      shotId: "__outro_shot__",
      shotTitle: doc.outro.title || "Credits",
      shotIndex: 999,
      beatIndex: 0,
      speaker: "Credits card",
      text: doc.outro.title || "Credits",
      plateFile: doc.outro.logoFile,
      voiceFile: doc.outro.voiceFile,
      sceneId: "__outro__",
      sceneTitle: doc.outro.title || "Credits",
      placeName: "Credits",
    });
  }

  return out;
}

export function beatsForShot(rows: ComfyBeatRow[], shotId: string): ComfyBeatRow[] {
  return rows.filter((r) => r.shotId === shotId);
}

export function defaultImageMotion(
  beat: Pick<ComfyBeatRow, "speaker" | "text" | "shotTitle" | "beatId">,
): string {
  if (
    beat.beatId === COMFY_INTRO_BEAT_ID ||
    beat.beatId === COMFY_OUTRO_BEAT_ID
  ) {
    const label = beat.text.trim() || beat.shotTitle || "Title";
    return [
      `[VISUAL]: Title card holds — slow gentle push-in, subtle lettering shimmer, soft overcast grade, props and layout stay locked to the plate. ${SKIDMARKS_LTX_STYLE_LOCK}`,
      `[SPEECH]: Announcer says: "${label}"`,
    ].join("\n");
  }
  const who = beat.speaker.trim() || "Character";
  const line = sanitizeDialogueForSpeech(beat.text.trim());
  if (!line) {
    const action =
      beat.shotTitle.trim() || "Action hold from the plate starting pose";
    return [
      `[VISUAL]: ${action}, props stay locked to the plate, soft overcast grade, no new dialogue. ${SKIDMARKS_LTX_STYLE_LOCK}`,
      `[SPEECH]:`,
    ].join("\n");
  }
  // Prominent speaker rule: the named speaker is the hero of the plate — mouth moves on THEM.
  const visual = `${who} is the prominent character in frame (largest / nearest / centre). ${who}'s mouth and head move while speaking, other people stay secondary and mostly still, props stay where they are in the plate. ${SKIDMARKS_LTX_STYLE_LOCK}`;
  const speech = `[SPEECH]: ${who} says: "${line}"`;
  return `[VISUAL]: ${visual}\n${speech}`;
}

export function defaultSegmentText(
  beat: Pick<ComfyBeatRow, "speaker" | "text" | "beatId" | "shotTitle">,
): string {
  if (
    beat.beatId === COMFY_INTRO_BEAT_ID ||
    beat.beatId === COMFY_OUTRO_BEAT_ID
  ) {
    return "Title card — slow push-in, hold, no new props";
  }
  const who = beat.speaker.trim() || "Character";
  if (!beat.text.trim()) {
    return (
      beat.shotTitle.trim() ||
      `${who} holds — small idle movement only`
    );
  }
  return `${who} delivers the line — subtle lean and gesture, cartoon timing`;
}

export function beatDraftFields(
  row: ComfyBeatRow,
  draft: ComfyDraft,
): { imageMotion: string; segmentText: string } {
  const saved = draft.beats[row.beatId];
  const freshMotion = defaultImageMotion(row);
  if (!saved?.imageMotion?.trim()) {
    return {
      imageMotion: freshMotion,
      segmentText: saved?.segmentText || defaultSegmentText(row),
    };
  }
  // Keep custom VISUAL edits, but always refresh SPEECH from the live line
  // (stops stuck em-dashes / wrong wording in local drafts).
  const speechBlock = freshMotion.match(/\[SPEECH\]:[\s\S]*$/);
  const visualOnly = saved.imageMotion.replace(/\[SPEECH\]:[\s\S]*$/, "").trimEnd();
  const imageMotion = speechBlock
    ? `${visualOnly}\n${speechBlock[0]}`
    : saved.imageMotion;
  return {
    imageMotion,
    segmentText: saved.segmentText || defaultSegmentText(row),
  };
}

export function formatBeatComfyPack(opts: {
  row: ComfyBeatRow;
  global: string;
  imageMotion: string;
  segmentText: string;
  styleId: string;
}): string {
  const { row, global, imageMotion, segmentText, styleId } = opts;
  const plateUrl = row.plateFile
    ? `/api/crash/gen/file?name=${encodeURIComponent(row.plateFile)}`
    : "(no plate — drop still in Story first)";
  const mp3 = row.voiceFile
    ? `data/crash/story/${styleId}/audio/${row.voiceFile}`
    : "(no mp3 — Gen mp3 in Story first)";

  return [
    "=== GLOBAL ===",
    global.trim(),
    "",
    `=== BEAT ${row.beatIndex + 1} — ${row.speaker || "?" } ===`,
    `Shot: ${row.shotTitle}`,
    `PLATE file: ${row.plateFile || "missing"}`,
    `PLATE url: ${plateUrl}`,
    `MP3: ${mp3}`,
    "",
    "IMAGE (guide 0.45 · 768×512 · mp3 under this row in Comfy):",
    imageMotion.trim(),
    "",
    "SEGMENT TEXT (Add Text after this beat):",
    segmentText.trim(),
  ].join("\n");
}

export function formatShotComfyPack(opts: {
  shotId: string;
  rows: ComfyBeatRow[];
  draft: ComfyDraft;
  styleId: string;
}): string {
  const shotRows = beatsForShot(opts.rows, opts.shotId);
  if (!shotRows.length) return "";
  const blocks = shotRows.map((row) => {
    const fields = beatDraftFields(row, opts.draft);
    return formatBeatComfyPack({
      row,
      global: opts.draft.global,
      imageMotion: fields.imageMotion,
      segmentText: fields.segmentText,
      styleId: opts.styleId,
    });
  });
  return blocks.join("\n\n---\n\n");
}

export function shotGroups(rows: ComfyBeatRow[]): {
  shotId: string;
  shotTitle: string;
  placeName: string;
  rows: ComfyBeatRow[];
}[] {
  const map = new Map<
    string,
    { shotId: string; shotTitle: string; placeName: string; rows: ComfyBeatRow[] }
  >();
  for (const row of rows) {
    let g = map.get(row.shotId);
    if (!g) {
      g = {
        shotId: row.shotId,
        shotTitle: row.shotTitle,
        placeName: row.placeName,
        rows: [],
      };
      map.set(row.shotId, g);
    }
    g.rows.push(row);
  }
  return [...map.values()];
}

export function beatReady(row: ComfyBeatRow): {
  ok: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!row.plateFile?.trim()) missing.push("plate");
  const silent = !row.text.trim();
  // Silent cutaways / action holds — plate only (no mp3, no dialogue line)
  if (!silent) {
    if (!row.voiceFile?.trim()) missing.push("mp3");
    if (!row.text.trim()) missing.push("line");
  }
  return { ok: missing.length === 0, missing };
}
