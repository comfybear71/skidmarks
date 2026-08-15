/**
 * LTX-2.3 IA2V on Comfy Cloud — plate + mp3 → mp4 (winning Shazza-shape prompt).
 */
import fs from "fs";
import path from "path";
import {
  cloudDownloadView,
  cloudQueuePrompt,
  cloudUploadInput,
  cloudWaitJob,
  comfyCloudConfigured,
  pickCloudVideo,
  COMFY_CLOUD_BASE,
} from "./comfyCloudClient";
import type { LtxSmokeInput, LtxSmokeResult } from "./ltxSmoke";
import { getEnv } from "./env";
import { CRASH_DIR } from "./paths";
import { sortableId } from "./types";
import { loadWorkflowTemplate } from "./workflowTemplates";

function estimateMp3DurationSec(filePath: string): number {
  try {
    const st = fs.statSync(filePath);
    const sec = (st.size * 8) / 128_000;
    if (Number.isFinite(sec) && sec > 0.4 && sec < 120) return sec;
  } catch {
    /* ignore */
  }
  return 3;
}

const IA2V_TEMPLATE_FILE = "LTX_2.3_IA2V_Cloud.json";

/** Dam done by hand + laundry Dazza (not on plate). */
export { LTX_CLOUD_SKIP_BEAT_IDS } from "./ltxCloudSkip";
const LOOK: Record<string, string> = {
  Nuggets: "skinny teen, buzz cut, blue and yellow jersey, meat pie",
  Shazza: "big blonde hair, leopard-print top, cigarette, arms folded",
  Dazza:
    "tall messy blonde, blue shirt — beers, coins, or pink hair dryer depending on the plate",
  "Ranger Bazza":
    "portly park ranger, mustache, khaki, clipboard, sunnies",
  Nan: "tiny elderly woman, hair bun, round glasses, purple housecoat, teacup, cricket bat",
};

function bgForPlate(plateFileName: string): string {
  const base = path.basename(plateFileName || "");
  if (base.includes("05512_wsl")) return "fence, dam, water tank, empty dirt";
  if (base.includes("20847_u5i")) {
    return "site laundry, coin machines, washers, laundry baskets";
  }
  if (base.includes("35488_gys")) return "demountable site office, steps";
  if (base.includes("50665_7ol")) {
    return "back shed, corrugated walls, lawnmower";
  }
  return "exactly as the start image";
}

const STYLE_LOCK =
  "Highly detailed stylised 3D animated feature render, clean simplified forms, believable materials, soft overcast lighting, shallow depth of field, cinematic quality, sharp focus. Not photographic, not a cartoon. Camera holds. Same people as the start image.";

function pronoun(speaker: string): "He" | "She" {
  if (/shazza|nan/i.test(speaker)) return "She";
  return "He";
}

export function parseSpeechFromImageMotion(imageMotion: string): {
  speaker: string;
  line: string;
} | null {
  const m = imageMotion.match(
    /\[SPEECH\]:\s*(.+?)\s+says:\s*"([^"]+)"/i,
  );
  if (!m) return null;
  return { speaker: m[1]!.trim(), line: m[2]!.trim() };
}

function parseVisualBody(imageMotion: string): string {
  const m = imageMotion.match(
    /\[VISUAL\]:\s*([\s\S]*?)(?=\[SPEECH\]|$)/i,
  );
  return (m?.[1] || "").trim();
}

/** Drop trailing style-lock so we can re-append STYLE_LOCK once. */
function stripStyleTail(visual: string): string {
  return visual
    .replace(/\s*highly detailed stylised[\s\S]*$/i, "")
    .replace(/\s*Not photographic[\s\S]*$/i, "")
    .trim();
}

export function buildCloudIa2vPrompt(opts: {
  imageMotion: string;
  plateFileName?: string;
}): string {
  const raw = opts.imageMotion.trim();
  // Already a Cloud paragraph (manual paste) — send as-is
  if (
    /^Use the provided start image/i.test(raw) &&
    !/\[VISUAL\]/i.test(raw)
  ) {
    return raw;
  }

  const parsed = parseSpeechFromImageMotion(raw);
  const speaker = parsed?.speaker || "the speaker";
  const line = parsed?.line || "";
  const visualCore = stripStyleTail(parseVisualBody(raw));
  const bg = bgForPlate(opts.plateFileName || "");
  const who = pronoun(speaker);
  const look = LOOK[speaker] || speaker;

  // Prefer Studio VISUAL (hair dryer, mouths closed, etc.) — old path ignored it
  const lead = visualCore
    ? visualCore
    : `${speaker} — ${look} — is prominent. Mouth and head move while speaking. Other people mouths closed, mostly still. Props stay put.`;

  return [
    "Use the provided start image as the first frame.",
    lead,
    `Only ${speaker} speaks. Other people keep their mouths closed.`,
    `Background stays as the start image: ${bg}.`,
    `${who} says: "${line}"`,
    STYLE_LOCK,
  ].join(" ");
}

function loadIa2vTemplate(): Record<string, unknown> {
  return loadWorkflowTemplate<Record<string, unknown>>({ fileName: IA2V_TEMPLATE_FILE });
}

function patchNodeInputs(
  prompt: Record<string, unknown>,
  nodeId: string,
  patch: Record<string, unknown>,
) {
  const node = prompt[nodeId] as
    | { inputs?: Record<string, unknown>; class_type?: string }
    | undefined;
  if (!node?.inputs) {
    throw new Error(`IA2V template missing node ${nodeId}`);
  }
  Object.assign(node.inputs, patch);
}

function ltxOutDir(): string {
  const d = path.join(CRASH_DIR, "ltx");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** Prefer Cloud when key is set, unless COMFY_LTX_BACKEND=pod. */
export function preferComfyCloudLtx(): boolean {
  const backend = getEnv("COMFY_LTX_BACKEND").toLowerCase();
  if (backend === "pod" || backend === "hotfix") return false;
  if (backend === "cloud") return comfyCloudConfigured();
  return comfyCloudConfigured();
}

export async function runLtxCloudIa2v(
  input: LtxSmokeInput,
): Promise<LtxSmokeResult> {
  const progress = (ev: Parameters<NonNullable<LtxSmokeInput["onProgress"]>>[0]) => {
    try {
      input.onProgress?.(ev);
    } catch {
      /* ignore */
    }
  };

  if (!comfyCloudConfigured()) {
    throw new Error("COMFY_CLOUD_API_KEY missing — set it in MY MOVIES\\.env");
  }
  if (!input.platePath || !fs.existsSync(input.platePath)) {
    throw new Error("Plate file missing on disk");
  }
  if (!input.audioPath || !fs.existsSync(input.audioPath)) {
    throw new Error("Cloud IA2V needs the beat mp3 — GEN MP3 first");
  }

  const imageMotion = (input.imageMotion || "").trim();
  if (!imageMotion) {
    throw new Error("IMAGE motion empty — fill LTX prompt before Send");
  }

  progress({
    step: "resolving",
    message: "Comfy Cloud · LTX-2.3 IA2V",
    comfyUrl: COMFY_CLOUD_BASE,
    comfySource: "cloud",
  });

  const cloudPrompt = buildCloudIa2vPrompt({
    imageMotion,
    plateFileName: path.basename(input.platePath),
  });
  const durationSec = Math.max(
    2,
    Math.min(
      12,
      Math.ceil(estimateMp3DurationSec(input.audioPath) + 0.25),
    ),
  );

  progress({
    step: "uploading",
    message: "Uploading plate + mp3 → Cloud",
    comfyUrl: COMFY_CLOUD_BASE,
    comfySource: "cloud",
  });
  const plateUp = await cloudUploadInput(input.platePath);
  const audioUp = await cloudUploadInput(input.audioPath);

  progress({
    step: "converting",
    message: "Patching IA2V workflow…",
    comfyUrl: COMFY_CLOUD_BASE,
    comfySource: "cloud",
  });
  const prompt = loadIa2vTemplate();
  patchNodeInputs(prompt, "269", { image: plateUp.name });
  patchNodeInputs(prompt, "276", { audio: audioUp.name });
  patchNodeInputs(prompt, "340:319", { value: cloudPrompt });
  patchNodeInputs(prompt, "340:331", { value: durationSec });
  patchNodeInputs(prompt, "341", {
    filename_prefix: input.beatId
      ? `video/studio_${input.beatId}`
      : "video/LTX_2.3_ia2v",
  });

  progress({
    step: "queued",
    message: `Queueing Cloud IA2V · ${durationSec}s…`,
    comfyUrl: COMFY_CLOUD_BASE,
    comfySource: "cloud",
  });
  const { promptId } = await cloudQueuePrompt(prompt);

  const outputs = await cloudWaitJob({
    promptId,
    timeoutMs: 600_000,
    pollMs: 2500,
    onPoll: ({ status, elapsedMs }) => {
      progress({
        step: status === "pending" || status === "queued" ? "queued" : "running",
        message: `Cloud ${status} · ${Math.round(elapsedMs / 1000)}s`,
        promptId,
        elapsedMs,
        comfyUrl: COMFY_CLOUD_BASE,
        comfySource: "cloud",
      });
    },
  });

  const vid = pickCloudVideo(outputs);
  if (!vid) {
    throw new Error("Cloud finished but no mp4 in outputs");
  }

  progress({
    step: "pulling",
    message: `Pulling ${vid.filename}…`,
    promptId,
    comfyUrl: COMFY_CLOUD_BASE,
    comfySource: "cloud",
  });
  const buf = await cloudDownloadView({
    filename: vid.filename,
    subfolder: vid.subfolder,
    type: vid.type,
  });

  const outName = `${sortableId("ltx")}_${vid.filename.replace(/[^\w.-]+/g, "_")}`;
  const localMp4 = path.join(
    ltxOutDir(),
    outName.endsWith(".mp4") ? outName : `${outName}.mp4`,
  );
  fs.writeFileSync(localMp4, buf);

  const relative = path
    .relative(path.join(process.cwd()), localMp4)
    .split(path.sep)
    .join("\\");

  const url = `/api/crash/comfy/ltx/file?name=${encodeURIComponent(path.basename(localMp4))}`;

  if (input.styleId && input.beatId) {
    const { writeLtxBeatResult } = await import("./ltxSmoke");
    writeLtxBeatResult({
      styleId: input.styleId,
      beatId: input.beatId,
      file: path.basename(localMp4),
      url,
      promptId,
      at: new Date().toISOString(),
    });
  }

  progress({
    step: "done",
    message: "Done (Cloud IA2V)",
    promptId,
    comfyUrl: COMFY_CLOUD_BASE,
    comfySource: "cloud",
  });

  return {
    ok: true,
    comfyUrl: COMFY_CLOUD_BASE,
    comfySource: "cloud",
    convertVia: "cloud-ia2v-template",
    promptId,
    uploadedPlate: plateUp.name,
    uploadedAudio: audioUp.name,
    localMp4,
    localMp4Relative: relative,
    url,
    manualNote: "Comfy Cloud LTX-2.3 IA2V — plate + mp3, Shazza-shape prompt.",
  };
}
