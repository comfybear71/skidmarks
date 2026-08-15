import fs from "fs";
import path from "path";
import {
  comfyDownloadView,
  comfyLtxMissingVideoError,
  comfyQueuePrompt,
  comfyUploadFile,
  comfyWaitHistory,
  pickComfyVideoOutput,
  resolveComfyLtxVideoToPull,
  resolveComfyUrl,
} from "./comfyClient";
import {
  assertLtxDirectorInputsSane,
  findApiNodesByClass,
  patchApiNodeInputs,
  sanitizeApiPromptCombos,
  uiWorkflowToApiPrompt,
  type UiWorkflow,
} from "./comfyWorkflowApi";
import { comfyLtxPreflight } from "./ltxPreflight";
import { CRASH_DIR, MOVIES_ROOT } from "./paths";
import { sortableId } from "./types";
import { activePackDir } from "./crashActivePack";

const HOTFIX_CANDIDATES = [
  path.join(MOVIES_ROOT, "workflow", "LTX_Director_2_Workflow_Hotfix.json"),
  path.join(
    process.env.USERPROFILE || "",
    "Desktop",
    "LTX_Director_2_Workflow_Hotfix.json",
  ),
  // Both paths above only exist on the PC. A copy committed to the repo is
  // the only one a deploy can carry.
  path.join(process.cwd(), "workflow", "LTX_Director_2_Workflow_Hotfix.json"),
];

const UPLOAD_SUB = "studio_ltx";
const FPS = 24;

export type LtxProgressStep =
  | "resolving"
  | "uploading"
  | "converting"
  | "queued"
  | "running"
  | "pulling"
  | "done";

export type LtxProgressEvent = {
  step: LtxProgressStep;
  message: string;
  promptId?: string;
  elapsedMs?: number;
  comfyUrl?: string;
  comfySource?: string;
};

export type LtxSmokeInput = {
  platePath: string;
  audioPath?: string | null;
  /** IMAGE — [VISUAL] / [SPEECH] */
  imageMotion: string;
  /** SEGMENT TEXT — Add Text */
  segmentText: string;
  /** GLOBAL lip polish */
  globalPrompt: string;
  /** Guide strength for the plate (talk = 0.45) */
  guideStrength?: number;
  /** Override duration in frames; else from audio estimate or 72 (3s) */
  durationFrames?: number;
  comfyUrl?: string;
  /** For results manifest → Animate player after refresh */
  styleId?: string;
  beatId?: string;
  onProgress?: (ev: LtxProgressEvent) => void;
};

export type LtxBeatResult = {
  styleId: string;
  beatId: string;
  file: string;
  url: string;
  promptId: string;
  at: string;
  /** Stuie QC — fail = redo (Send all will pick it up again) */
  verdict?: "pass" | "fail";
};

export type LtxResultsManifest = {
  byBeat: Record<string, LtxBeatResult>;
};

export type LtxSmokeResult = {
  ok: true;
  comfyUrl: string;
  comfySource: string;
  convertVia: string;
  promptId: string;
  uploadedPlate: string;
  uploadedAudio: string | null;
  localMp4: string;
  localMp4Relative: string;
  url: string;
  manualNote: string;
};

function loadHotfixUi(): UiWorkflow {
  for (const p of HOTFIX_CANDIDATES) {
    if (p && fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8")) as UiWorkflow;
    }
  }
  throw new Error(
    "Hotfix JSON not found. Expected MY MOVIES\\workflow\\LTX_Director_2_Workflow_Hotfix.json",
  );
}

function segId(prefix: string): string {
  return `${Date.now()}${prefix}${Math.random().toString(36).slice(2, 7)}`;
}

/** Rough MP3 duration from Xing/VBRI-less file size (CBR-ish). Fallback 3s. */
export function estimateMp3DurationSec(filePath: string): number {
  try {
    const st = fs.statSync(filePath);
    // Assume ~128 kbps if unknown
    const sec = (st.size * 8) / (128_000);
    if (Number.isFinite(sec) && sec > 0.4 && sec < 120) return sec;
  } catch {
    /* ignore */
  }
  return 3;
}

function buildTimeline(opts: {
  plateRel: string;
  plateFileName: string;
  audioRel: string | null;
  audioFileName: string | null;
  imageMotion: string;
  segmentText: string;
  globalPrompt: string;
  frames: number;
  guideStrength: number;
}): { timelineJson: string; localPrompts: string; segmentLengths: string } {
  const imagePrompt = opts.imageMotion.trim();
  const textPrompt = opts.segmentText.trim() || imagePrompt;

  const segments: Array<Record<string, unknown>> = [
    {
      id: segId("img"),
      type: "image",
      start: 0,
      length: opts.frames,
      prompt: imagePrompt,
      imageFile: opts.plateRel,
      imageB64: `/api/view?filename=${encodeURIComponent(opts.plateFileName)}&type=input&subfolder=${encodeURIComponent(UPLOAD_SUB)}`,
    },
  ];
  if (textPrompt) {
    segments.push({
      id: segId("txt"),
      type: "text",
      start: 0,
      length: opts.frames,
      prompt: textPrompt,
    });
  }

  const audioSegments: Array<Record<string, unknown>> = [];
  if (opts.audioRel && opts.audioFileName) {
    audioSegments.push({
      id: segId("aud"),
      type: "audio",
      start: 0,
      length: opts.frames,
      trimStart: 0,
      audioDurationFrames: opts.frames,
      audioFile: opts.audioRel,
      fileName: opts.audioFileName,
      waveformPeaks: [],
    });
  }

  const timeline = {
    mainTrackEnabled: true,
    audioTrackEnabled: Boolean(opts.audioRel),
    motionTrackEnabled: false,
    propHeight: 90,
    globalPropHeight: 60,
    showFilenames: true,
    overrideAudio: false,
    // Gold stack: AUDIO Inpaint OFF when mp3 under IMAGE
    inpaint_audio: !opts.audioRel,
    global_prompt: opts.globalPrompt.trim(),
    retake_global_prompt: "",
    retakeMode: false,
    retakeStart: 24,
    retakeLength: 48,
    retakePrompt: "",
    retakeStrength: 1,
    retakeVideo: null,
    normalStartFrame: 0,
    normalDurationFrames: opts.frames,
    segments,
    motionSegments: [],
    audioSegments,
  };

  // Prompt relay locals = text segments (action / speech motion)
  const localPrompts = textPrompt;
  const segmentLengths = String(opts.frames);

  return {
    timelineJson: JSON.stringify(timeline),
    localPrompts,
    segmentLengths,
  };
}

function patchUiHotfix(opts: {
  workflow: UiWorkflow;
  timelineJson: string;
  localPrompts: string;
  segmentLengths: string;
  globalPrompt: string;
  frames: number;
  guideStrength: number;
  hasAudio: boolean;
}): void {
  const sec = opts.frames / FPS;
  for (const node of opts.workflow.nodes || []) {
    if (node.type === "ModelPreviewOverrideKJ" && Array.isArray(node.widgets_values)) {
      const w = [...node.widgets_values];
      while (w.length < 6) w.push("");
      w[5] = "none";
      node.widgets_values = w;
    }
    if (node.type === "LTXDirector" && Array.isArray(node.widgets_values)) {
      const w = [...node.widgets_values] as unknown[];
      // Observed Hotfix layout — keep length
      while (w.length < 22) w.push("");
      w[0] = 0; // start_second
      w[1] = sec; // end_second
      w[2] = sec; // duration_seconds
      w[3] = 0; // start_frame
      w[4] = opts.frames; // end_frame
      w[5] = opts.frames; // duration_frames
      w[6] = opts.timelineJson;
      w[7] = opts.localPrompts;
      w[8] = opts.segmentLengths;
      w[9] = 0.001; // epsilon
      w[10] = String(opts.guideStrength); // guide_strength
      w[11] = opts.hasAudio; // use_custom_audio
      w[12] = true; // use_custom_motion
      w[13] = !opts.hasAudio; // inpaint_audio OFF when mp3
      w[14] = FPS;
      w[15] = "seconds";
      w[16] = 768; // custom_width
      w[17] = 512; // custom_height
      // Hotfix indices: [18] resize_method string, [19] divisible_by, [20] img_compression
      // Never leave a number in resize_method (convert used to shift 32 here).
      w[18] = "maintain aspect ratio";
      w[19] = typeof w[19] === "number" && Number.isFinite(w[19]) ? w[19] : 32;
      w[20] = typeof w[20] === "number" && Number.isFinite(w[20]) ? w[20] : 18;
      if (w.length > 21) w[21] = false; // override_audio
      node.widgets_values = w;
    }
    if (node.type === "LTXDirectorGuide" && Array.isArray(node.widgets_values)) {
      // Leave image widget None — guides come from Director timeline
      const w = [...node.widgets_values];
      // Talk guide node historically strength 0.5 — nudge toward 0.45 if this is the softer one
      if (typeof w[2] === "number" && w[2] > 0 && w[2] < 1) {
        w[2] = opts.guideStrength;
      }
      node.widgets_values = w;
    }
  }

  // Also stash global on timeline — force_input socket may be empty
  void opts.globalPrompt;
}

function patchApiAfterConvert(opts: {
  prompt: Record<string, unknown>;
  timelineJson: string;
  localPrompts: string;
  segmentLengths: string;
  globalPrompt: string;
  frames: number;
  guideStrength: number;
  hasAudio: boolean;
}): void {
  const sec = opts.frames / FPS;
  for (const id of findApiNodesByClass(opts.prompt, "LTXDirector")) {
    patchApiNodeInputs(opts.prompt, id, {
      global_prompt: opts.globalPrompt,
      start_second: 0,
      end_second: sec,
      duration_seconds: sec,
      start_frame: 0,
      end_frame: opts.frames,
      duration_frames: opts.frames,
      timeline_data: opts.timelineJson,
      local_prompts: opts.localPrompts,
      segment_lengths: opts.segmentLengths,
      guide_strength: String(opts.guideStrength),
      use_custom_audio: opts.hasAudio,
      inpaint_audio: !opts.hasAudio,
      use_custom_motion: true,
      frame_rate: FPS,
      display_mode: "seconds",
      custom_width: 768,
      custom_height: 512,
      resize_method: "maintain aspect ratio",
      divisible_by: 32,
      img_compression: 18,
      override_audio: false,
    });
  }
  for (const id of findApiNodesByClass(opts.prompt, "ModelPreviewOverrideKJ")) {
    patchApiNodeInputs(opts.prompt, id, { tiny_vae: "none" });
  }
  sanitizeApiPromptCombos(opts.prompt);
  assertLtxDirectorInputsSane(opts.prompt);
}

function ltxOutDir(): string {
  const d = path.join(CRASH_DIR, "ltx");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function ltxResultsPath(): string {
  return path.join(ltxOutDir(), "results.json");
}

export function readLtxResults(): LtxResultsManifest {
  try {
    const p = ltxResultsPath();
    if (!fs.existsSync(p)) return { byBeat: {} };
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as LtxResultsManifest;
    return { byBeat: raw.byBeat || {} };
  } catch {
    return { byBeat: {} };
  }
}

export function writeLtxBeatResult(entry: LtxBeatResult): void {
  const cur = readLtxResults();
  cur.byBeat[`${entry.styleId}::${entry.beatId}`] = entry;
  fs.writeFileSync(ltxResultsPath(), JSON.stringify(cur, null, 2), "utf8");
}

/** Pass / fail a landed take — never deletes the mp4. */
export function patchLtxBeatVerdict(
  styleId: string,
  beatId: string,
  verdict: "pass" | "fail" | "",
): LtxBeatResult | null {
  const key = `${styleId}::${beatId}`;
  const cur = readLtxResults();
  const entry = cur.byBeat[key];
  if (!entry) return null;
  if (verdict === "pass" || verdict === "fail") {
    entry.verdict = verdict;
  } else {
    delete entry.verdict;
  }
  cur.byBeat[key] = entry;
  fs.writeFileSync(ltxResultsPath(), JSON.stringify(cur, null, 2), "utf8");
  return entry;
}

export function listLtxResultsForStyle(styleId: string): LtxBeatResult[] {
  const all = readLtxResults();
  return Object.values(all.byBeat).filter((r) => r.styleId === styleId);
}

function ltxClearedDir(): string {
  const d = path.join(ltxOutDir(), "_cleared");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** Move one LTX mp4 into data/crash/ltx/_cleared/ — never delete. */
function quarantineLtxFile(file: string): string | null {
  if (!file || file.includes("..") || file.includes("/") || file.includes("\\")) {
    return null;
  }
  const src = path.join(ltxOutDir(), file);
  if (!fs.existsSync(src)) return null;
  const destDir = ltxClearedDir();
  let dest = path.join(destDir, file);
  if (fs.existsSync(dest)) {
    dest = path.join(destDir, `${Date.now()}_${file}`);
  }
  fs.renameSync(src, dest);
  return path.basename(dest);
}

/**
 * Clear Animate LTX results for a show (or one beat).
 * Moves mp4s to data/crash/ltx/_cleared/ and drops results.json entries.
 * Never deletes media. Does not touch Story.
 */
export function clearLtxResultsForStyle(
  styleId: string,
  beatId?: string,
): { cleared: number; moved: string[] } {
  const cur = readLtxResults();
  const moved: string[] = [];
  let cleared = 0;
  for (const [key, entry] of Object.entries(cur.byBeat)) {
    if (entry.styleId !== styleId) continue;
    if (beatId && entry.beatId !== beatId) continue;
    const parked = quarantineLtxFile(entry.file);
    if (parked) moved.push(parked);
    delete cur.byBeat[key];
    cleared++;
  }
  fs.writeFileSync(ltxResultsPath(), JSON.stringify(cur, null, 2), "utf8");
  return { cleared, moved };
}

/**
 * Copy an mp4 onto a beat for Animate (no Comfy).
 * Previous LTX for that beat is parked in _cleared/ — never deleted.
 * Source file is only read/copied, never moved or wiped.
 */
export function attachLtxMp4ToBeat(opts: {
  styleId: string;
  beatId: string;
  buffer: Buffer;
  sourceName?: string;
}): LtxBeatResult {
  const styleId = opts.styleId.trim();
  const beatId = opts.beatId.trim();
  if (!styleId || !beatId) throw new Error("Need styleId and beatId");
  if (!opts.buffer?.length) throw new Error("Empty mp4");

  clearLtxResultsForStyle(styleId, beatId);

  const base = (opts.sourceName || "clip.mp4")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^\.+/, "");
  const safeBase = base.toLowerCase().endsWith(".mp4")
    ? base
    : `${base || "clip"}.mp4`;
  const outName = `${sortableId("ltx")}_${safeBase}`;
  const dest = path.join(ltxOutDir(), outName);
  fs.writeFileSync(dest, opts.buffer);

  const file = path.basename(dest);
  const entry: LtxBeatResult = {
    styleId,
    beatId,
    file,
    url: `/api/crash/comfy/ltx/file?name=${encodeURIComponent(file)}`,
    promptId: "attach",
    at: new Date().toISOString(),
  };
  writeLtxBeatResult(entry);
  return entry;
}

/**
 * Smoke path: upload plate (+ optional mp3) → inject one-beat timeline into Hotfix →
 * convert UI→API → /prompt → poll → download mp4 into data/crash/ltx/
 */
export async function runLtxSmoke(input: LtxSmokeInput): Promise<LtxSmokeResult> {
  const progress = (ev: LtxProgressEvent) => {
    try {
      input.onProgress?.(ev);
    } catch {
      /* UI callback must not break the job */
    }
  };

  const { preferComfyCloudLtx, runLtxCloudIa2v } = await import("./ltxCloudIa2v");
  if (preferComfyCloudLtx()) {
    return runLtxCloudIa2v(input);
  }

  if (!input.platePath || !fs.existsSync(input.platePath)) {
    throw new Error("Plate file missing on disk");
  }

  const imageMotion = (input.imageMotion || "").trim();
  const segmentText = (input.segmentText || "").trim();
  const globalPrompt = (input.globalPrompt || "").trim();
  if (!imageMotion && !segmentText) {
    throw new Error(
      "Nothing to send — IMAGE motion and SEGMENT TEXT are both empty. Fill one, then Send.",
    );
  }
  if (!globalPrompt) {
    throw new Error(
      "GLOBAL is empty — paste the lip-sync line (or Reset GLOBAL), then Send. Not queueing an empty job.",
    );
  }
  if (!String(input.globalPrompt || "").trim()) {
    throw new Error(
      "GLOBAL prompt is empty — paste lip-sync GLOBAL before Send to LTX",
    );
  }

  progress({ step: "resolving", message: "Finding Comfy…" });
  const resolved = await resolveComfyUrl(input.comfyUrl);
  if (!resolved.ok) throw new Error(resolved.error);
  const baseUrl = resolved.url;
  const hostShort = baseUrl.replace(/^https?:\/\//, "").slice(0, 48);

  // Prove Comfy answers + Hotfix nodes exist (don't queue into missing-node errors)
  const pre = await comfyLtxPreflight(baseUrl);
  if (!pre.reachable) {
    throw new Error(
      `Comfy not answering at ${hostShort} (${resolved.source}): ${
        pre.error || pre.hint
      }`,
    );
  }
  if (!pre.ok) {
    const miss = pre.missing.slice(0, 8).join(", ");
    throw new Error(
      `Comfy missing nodes (${miss}${pre.missing.length > 8 ? "…" : ""}). ${pre.hint}`,
    );
  }
  progress({
    step: "resolving",
    message: `Comfy ready · ${hostShort} (${resolved.source})`,
    comfyUrl: baseUrl,
    comfySource: resolved.source,
  });

  const hasAudio = Boolean(input.audioPath && fs.existsSync(input.audioPath));
  const guideStrength = input.guideStrength ?? 0.45;

  let frames = input.durationFrames;
  if (!frames || frames < 8) {
    const sec = hasAudio
      ? estimateMp3DurationSec(input.audioPath!)
      : 3;
    frames = Math.max(24, Math.min(240, Math.round(sec * FPS)));
  }

  progress({
    step: "uploading",
    message: hasAudio
      ? `Uploading plate + mp3 → ${hostShort}`
      : `Uploading plate → ${hostShort}`,
    comfyUrl: baseUrl,
    comfySource: resolved.source,
  });
  const plateUp = await comfyUploadFile({
    baseUrl,
    filePath: input.platePath,
    subfolder: UPLOAD_SUB,
  });
  const plateRel = plateUp.subfolder
    ? `${plateUp.subfolder}/${plateUp.name}`
    : plateUp.name;

  let audioRel: string | null = null;
  let audioName: string | null = null;
  if (hasAudio) {
    const audioUp = await comfyUploadFile({
      baseUrl,
      filePath: input.audioPath!,
      subfolder: UPLOAD_SUB,
    });
    audioName = audioUp.name;
    audioRel = audioUp.subfolder
      ? `${audioUp.subfolder}/${audioUp.name}`
      : audioUp.name;
  }

  const built = buildTimeline({
    plateRel,
    plateFileName: plateUp.name,
    audioRel,
    audioFileName: audioName,
    imageMotion,
    segmentText,
    globalPrompt,
    frames,
    guideStrength,
  });

  progress({
    step: "converting",
    message: "Building Hotfix prompt…",
    comfyUrl: baseUrl,
    comfySource: resolved.source,
  });
  const workflow = loadHotfixUi();
  patchUiHotfix({
    workflow,
    timelineJson: built.timelineJson,
    localPrompts: built.localPrompts,
    segmentLengths: built.segmentLengths,
    globalPrompt,
    frames,
    guideStrength,
    hasAudio,
  });

  // Name-map convert (skips broken /workflow/convert for LTXDirector)
  const { prompt, via } = await uiWorkflowToApiPrompt(baseUrl, workflow);
  patchApiAfterConvert({
    prompt,
    timelineJson: built.timelineJson,
    localPrompts: built.localPrompts,
    segmentLengths: built.segmentLengths,
    globalPrompt,
    frames,
    guideStrength,
    hasAudio,
  });
  // Final gate — never queue shifted widgets
  assertLtxDirectorInputsSane(prompt);

  progress({
    step: "converting",
    message: `Queueing Hotfix (${via})…`,
    comfyUrl: baseUrl,
    comfySource: resolved.source,
  });
  const { promptId } = await comfyQueuePrompt({ baseUrl, prompt });
  progress({
    step: "queued",
    message: `Queued on ${hostShort} · ${promptId.slice(0, 8)}…`,
    promptId,
    comfyUrl: baseUrl,
    comfySource: resolved.source,
  });

  // Poll patiently — never interrupt / cancel the Comfy job from Studio
  const { outputs } = await comfyWaitHistory({
    baseUrl,
    promptId,
    timeoutMs: 900_000,
    pollMs: 3000,
    onPoll: ({ phase, elapsedMs }) => {
      progress({
        step: phase === "queued" ? "queued" : "running",
        message:
          phase === "queued"
            ? `Queued (${promptId.slice(0, 8)}…) · ${Math.round(elapsedMs / 1000)}s`
            : `Running… ${Math.round(elapsedMs / 1000)}s — leave it`,
        promptId,
        elapsedMs,
      });
    },
  });

  // SaveVideo → history.images (animated), subfolder "video",
  // name like LTX_Director_00001_.mp4 (trailing _ before .mp4)
  let vid = pickComfyVideoOutput(outputs);
  if (!vid) {
    progress({
      step: "pulling",
      message: "No mp4 on this job — checking Comfy history / video/LTX_Director_#####_.mp4…",
      promptId,
    });
    const found = await resolveComfyLtxVideoToPull(baseUrl);
    vid = found.video;
    if (!vid) {
      throw new Error(
        `Job ${promptId.slice(0, 8)}… finished but no mp4. ${comfyLtxMissingVideoError(found)}`,
      );
    }
  }

  progress({
    step: "pulling",
    message: `Pulling ${vid.subfolder ? `${vid.subfolder}/` : ""}${vid.filename}…`,
    promptId,
  });
  const buf = await comfyDownloadView({
    baseUrl,
    filename: vid.filename,
    subfolder: vid.subfolder,
    type: vid.type,
  });

  const outName = `${sortableId("ltx")}_${vid.filename.replace(/[^\w.-]+/g, "_")}`;
  const localMp4 = path.join(ltxOutDir(), outName.endsWith(".mp4") ? outName : `${outName}.mp4`);
  fs.writeFileSync(localMp4, buf);

  const relative = path
    .relative(path.join(process.cwd()), localMp4)
    .split(path.sep)
    .join("\\");

  const url = `/api/crash/comfy/ltx/file?name=${encodeURIComponent(path.basename(localMp4))}`;

  if (input.styleId && input.beatId) {
    writeLtxBeatResult({
      styleId: input.styleId,
      beatId: input.beatId,
      file: path.basename(localMp4),
      url,
      promptId,
      at: new Date().toISOString(),
    });
  }

  const result: LtxSmokeResult = {
    ok: true,
    comfyUrl: baseUrl,
    comfySource: resolved.source,
    convertVia: via,
    promptId,
    uploadedPlate: plateRel,
    uploadedAudio: audioRel,
    localMp4,
    localMp4Relative: relative,
    url,
    manualNote:
      "Timeline auto-fill is one IMAGE + one TEXT + optional AUDIO for this beat only — not a full shot stack. Multi-beat Director mapping is next.",
  };
  progress({
    step: "done",
    message: "Done",
    promptId,
  });
  return result;
}

export function ltxFilePath(name: string): string | null {
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }
  const studio = path.join(ltxOutDir(), name);
  if (fs.existsSync(studio)) return studio;
  const pack = activePackDir();
  if (pack) {
    const p = path.join(pack, "mp4", name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
