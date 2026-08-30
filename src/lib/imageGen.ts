import fs from "fs";
import path from "path";
import { getEnv } from "./env";
import {
  getShowStylePreset,
  type ShowStyleId,
} from "./showStylePresets";
import { styleRealismLabel } from "./types";
import { buildCrashGenLook } from "./crashGenLook";
export { buildCrashGenLook } from "./crashGenLook";

/** DAP-proven look — same words every plate so the show holds. */
const STYLE_STILL =
  "Stylised 3D animated feature render, clean simplified forms, believable materials, soft overcast lighting, everything in sharp focus. Clearly made, not a camera photo. Not a cartoon.";

function stylePrompt(styleRealism: number): string {
  const zone = styleRealismLabel(styleRealism);
  if (styleRealism >= 50 && styleRealism <= 70) {
    return `LOOK (Skidmarks / DAP zone, slider ${styleRealism}): ${STYLE_STILL} Caricatured character — exaggeration modelled into the face (bigger features), never drawn.`;
  }
  if (styleRealism < 50) {
    return `LOOK (slider ${styleRealism} — ${zone}): pull toward stylised 3D with real materials and soft overcast light. Less flat/cartoon, more sculpted 3D weight. Still caricatured face.`;
  }
  return `LOOK (slider ${styleRealism} — ${zone}): pull back from photographic realism toward stylised 3D feature look — believable materials but clearly made, caricatured face.`;
}

function locationStylePrompt(styleRealism: number): string {
  const zone = styleRealismLabel(styleRealism);
  return `LOOK (Skidmarks location, slider ${styleRealism} — ${zone}): ${STYLE_STILL} Empty establishing place — street, room, bank, cafe, hellscape, whatever the notes say. Materials and light only. No people.`;
}

export function buildLocationPrompt(opts: {
  name: string;
  notes: string;
  lookNote: string;
  note: string;
  styleRealism: number;
  rejectHints: string[];
  residentNames: string[];
  styleId?: ShowStyleId;
}): string {
  // Positive-only: naming people/animals pulls them into the frame.
  const place = (opts.name || "").trim();
  const bits = [
    // opts.name used to be accepted and never printed. With notes/lookNote/note
    // all empty — which is every mobile location — nothing in the prompt said
    // what the place was, so the example materials below became the subject and
    // every location came back as the same cafe-table street.
    place
      ? `Empty establishing location still of: ${place}. Everything in frame must belong to ${place} — if that place has no buildings, streets or furniture, show none.`
      : "Empty establishing location still — architecture, furniture, weather and materials only.",
    // Naming architecture/furniture up front fights a place that has neither.
    place && opts.styleId
      ? "Environment only, no characters. Cast arrives later on separate shot plates."
      : "Architecture, furniture, weather and materials only. Cast arrives later on separate shot plates.",
    opts.residentNames.length
      ? `Place vibe associated with: ${opts.residentNames.join(", ")}. Show their mess and lived-in clutter in the environment only.`
      : "",
    opts.notes ? `Place notes: ${opts.notes}` : "",
    opts.lookNote ? `Look: ${opts.lookNote}` : "",
    opts.note ? `This attempt: ${opts.note}` : "",
    opts.rejectHints.length
      ? `Fix previous rejects: ${opts.rejectHints.join("; ")}`
      : "",
    opts.styleId
      ? buildCrashGenLook(opts.styleId, opts.styleRealism)
      : locationStylePrompt(opts.styleRealism),
    // The old wording listed bank counters / cafe tables / street kerbs as
    // examples. With no place named, the generator drew the examples.
    opts.styleId
      ? `Show the real materials, surfaces and light of ${place || "this specific place"} and nothing borrowed from anywhere else.`
      : "Name real materials for THIS specific place — bank counters, cafe tables, street kerbs, lava rock, whatever the notes ask for. Sculpted 3D diorama feel.",
    "Empty of people and animals. No writing, no signage text, no labels, no captions, no watermarks.",
  ];
  return bits.filter(Boolean).join("\n\n");
}

export function buildFacePrompt(opts: {
  name: string;
  pastNote: string;
  note: string;
  styleRealism: number;
  rejectHints: string[];
  styleId?: ShowStyleId;
}): string {
  // Prefer the live attempt note (what's on screen). Don't double-print the same line.
  const who = (opts.note || opts.pastNote || "").trim();
  const bits = [
    // "face still" biases toward a human head-shot on a non-human subject.
    opts.styleId ? "Single character reference still." : "Character face still.",
    // With a styleId the note is the whole story prompt (mobile Auto Studio),
    // so it has to read as background for ONE cast member — dumping it raw
    // made the generator draw the entire scene: both speakers, mid-dialogue.
    // A name with no note (e.g. a band member added with no bio) used to drop
    // out of the prompt entirely, leaving nothing but "do not humanise it" —
    // the generator drew the literal word ("Saxophone") as a creature/object
    // instead of a person. Always name the character, and when there's no
    // note, say outright that they're a person so a literal/instrument-sounding
    // name doesn't get taken at face value.
    opts.styleId
      ? who
        ? `Design ONE character only — ${opts.name}. ${opts.name} is: ${who}`
        : `Design ONE character only — ${opts.name}, a human being. ${opts.name} is a person — a band member nicknamed "${opts.name}" — not the literal object, animal or instrument the name might suggest.`
      : who
        ? `Who they are: ${who}`
        : `Who they are: ${opts.name}, a human being — not the literal object, animal or instrument the name might suggest.`,
    opts.rejectHints.length
      ? `Fix previous rejects: ${opts.rejectHints.join("; ")}`
      : "",
    opts.styleId
      ? buildCrashGenLook(opts.styleId, opts.styleRealism)
      : stylePrompt(opts.styleRealism),
    // "Portrait or upper body" is a human framing — it fights a fish, a bird or
    // a toaster. Let the subject decide the crop instead.
    opts.styleId
      ? "Use the reference image(s) for identity when provided. Facing camera, filling the frame: head and shoulders if it has them, otherwise the whole creature or object. Keep its real anatomy — do not humanise it, do not give it a human body or human hands unless the description says so."
      : "Use the reference image(s) for identity when provided. Portrait or upper body, facing camera. English/Australian grotesque comedy energy.",
    // Cast cards get composited onto plates later — a second body or a baked-in
    // speech bubble makes the card unusable.
    opts.styleId
      ? "Exactly one character alone in frame — no second character, no crowd. No speech bubbles, no dialogue balloons, no writing, no text, no captions, no subtitles, no watermarks."
      : "",
  ];
  return bits.filter(Boolean).join("\n\n");
}

/**
 * Shot plate — faces as refs (no empty-place image; that cloned people).
 * Place described in words. Same STYLE every time.
 */
export function buildShotPlatePrompt(opts: {
  people: { name: string; identity: string }[];
  placeDescription: string;
  poseNote: string;
}): string {
  const n = opts.people.length;
  const who =
    n === 0
      ? "Empty of people."
      : n === 1
        ? `Exactly one person: ${opts.people[0].name}. Match face reference 1. ${opts.people[0].identity}`
        : [
            `Exactly ${n} people — one of each, never doubles, never extras:`,
            ...opts.people.map(
              (p, i) =>
                `Face reference ${i + 1} = ${p.name}. ${p.identity}`,
            ),
          ].join("\n");

  const pose =
    opts.poseNote.trim() ||
    "start of the beat, feet on the floor, ready — not mid-kick or mid-punch";

  // Strip photo-slop from pose notes — pulls plates toward camera-real
  const poseClean = pose
    .replace(
      /\b(photo[- ]?real(?:istic)?(?:\s+textures)?|photoreal(?:istic)?(?:\s+textures)?|semi-photorealistic|8k|masterpiece|RAW|DSL[Rr]|shot on (?:imax|35mm)|hyper[- ]?detailed)\b/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .trim();

  return [
    STYLE_STILL,
    "LOOK LOCK: stylised 3D animated feature — sculpted characters, clean simplified forms, believable materials. Pull back from photographic realism. Clearly made, not a camera photo. Caricature modelled into the face.",
    who,
    `Place (background): ${opts.placeDescription}`,
    `Pose / beat: ${poseClean}`,
    "Wide shot, 768 by 512. No writing, no signage text, no labels anywhere. No captions, no subtitles, no watermarks.",
  ].join("\n\n");
}

export function imageKeyPresent(): boolean {
  return Boolean(getEnv("XAI_API_KEY") || getEnv("GROK_API_KEY"));
}

function xaiKey(): string {
  return getEnv("XAI_API_KEY") || getEnv("GROK_API_KEY");
}

function mimeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

function dataUri(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return `data:${mimeFor(filePath)};base64,${buf.toString("base64")}`;
}

type XaiImageRow = { b64_json?: string; url?: string };

export async function generateFaceImage(opts: {
  prompt: string;
  referencePaths: string[];
  aspectRatio?: string;
}): Promise<{ buffer: Buffer; ext: string }> {
  const key = xaiKey();
  if (!key) {
    throw new Error(
      "Missing XAI_API_KEY. Add it to your environment variables then restart Studio.",
    );
  }

  const paths = opts.referencePaths.slice(0, 3);
  const aspect = opts.aspectRatio || "3:4";

  if (paths.length > 0) {
    const imagePayloads = paths.map((p) => ({
      url: dataUri(p),
      type: "image_url" as const,
    }));

    // No aspect_ratio on edits — forcing portrait onto a wide reference
    // squashes the picture. Let the edit keep the source shape.
    const body: Record<string, unknown> = {
      model: "grok-imagine-image",
      prompt: opts.prompt,
      response_format: "b64_json",
    };

    if (imagePayloads.length === 1) {
      body.image = imagePayloads[0];
    } else {
      body.images = imagePayloads;
    }

    return await xaiImageRequest("https://api.x.ai/v1/images/edits", body, key);
  }

  return await xaiImageRequest(
    "https://api.x.ai/v1/images/generations",
    {
      model: "grok-imagine-image",
      prompt: opts.prompt,
      aspect_ratio: aspect,
      response_format: "b64_json",
    },
    key,
  );
}

/** /m GROK Imagine still — official Image 2.0. Does not change face/plate cooks. */
export async function generateImagineImage(opts: {
  prompt: string;
  referencePaths?: string[];
  aspectRatio?: string;
  resolution?: "1k" | "2k";
}): Promise<{ buffer: Buffer; ext: string }> {
  const key = xaiKey();
  if (!key) {
    throw new Error(
      "Missing XAI_API_KEY. Add it to your environment variables then restart Studio.",
    );
  }
  const prompt = (opts.prompt || "").trim();
  if (!prompt) throw new Error("Type something to imagine first.");
  const paths = (opts.referencePaths || []).slice(0, 3);
  const body: Record<string, unknown> = {
    model: "grok-imagine-image-2.0",
    prompt,
    response_format: "b64_json",
    quality: "medium",
  };
  if (opts.resolution === "1k" || opts.resolution === "2k") {
    body.resolution = opts.resolution;
  }
  if (paths.length > 0) {
    const imagePayloads = paths.map((p) => ({
      url: dataUri(p),
      type: "image_url" as const,
    }));
    if (imagePayloads.length === 1) body.image = imagePayloads[0];
    else body.images = imagePayloads;
    return await xaiImageRequest("https://api.x.ai/v1/images/edits", body, key, [
      "grok-imagine-image-2.0",
    ]);
  }
  body.aspect_ratio = opts.aspectRatio || "16:9";
  return await xaiImageRequest("https://api.x.ai/v1/images/generations", body, key, [
    "grok-imagine-image-2.0",
  ]);
}

function xaiErrorMessage(status: number, data: unknown): string {
  const d = data as {
    error?: string | { message?: string; code?: string };
    message?: string;
  };
  let detail = "";
  if (typeof d?.error === "string") detail = d.error;
  else if (d?.error && typeof d.error === "object")
    detail = [d.error.code, d.error.message].filter(Boolean).join(": ");
  else if (d?.message) detail = d.message;
  else {
    try {
      detail = JSON.stringify(data);
    } catch {
      detail = "";
    }
  }
  if (/expired/i.test(detail)) {
    return (
      detail +
      " — Make a new key at https://console.x.ai → API Keys, paste into your environment variables as XAI_API_KEY=..., save, then restart Studio."
    );
  }
  if (status === 403) {
    return (
      (detail || "xAI refused the request (403)") +
      " — Check credits + that this API key still works at https://console.x.ai"
    );
  }
  return detail || `xAI failed (${status})`;
}

/** Hard ceiling on a single xAI image call. Kept under the callers' own
 * per-image timeout so the abort fires first and the socket is released. */
const XAI_REQUEST_TIMEOUT_MS = 40_000;

async function xaiImageRequest(
  url: string,
  body: Record<string, unknown>,
  key: string,
  onlyModels?: string[],
): Promise<{ buffer: Buffer; ext: string }> {
  const models = onlyModels?.length
    ? onlyModels
    : [String(body.model || "grok-imagine-image"), "grok-imagine-image-quality"];
  const tryModels = [...new Set(models)];

  let lastErr = "";
  for (const model of tryModels) {
    const payload = { ...body, model };
    let status = 0;

    for (let attempt = 0; ; attempt++) {
      // Without a signal this fetch can hang indefinitely, and the model
      // fallback makes it hang twice — that is what stalled the phone on a
      // spinner with nothing to show and no error.
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(XAI_REQUEST_TIMEOUT_MS),
        });
      } catch (e) {
        const aborted = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
        lastErr = aborted
          ? `xAI image request timed out after ${XAI_REQUEST_TIMEOUT_MS / 1000}s (model ${model})`
          : `xAI image request failed: ${e instanceof Error ? e.message : String(e)}`;
        return Promise.reject(new Error(lastErr));
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok) return decodeImagePayload(data);
      status = res.status;
      lastErr = xaiErrorMessage(res.status, data);

      // Rate limits and server blips are the whole reason a second batch came
      // back empty in ~2s. They are transient — wait and ask again rather than
      // returning an empty batch that looks like a hang.
      const transient = res.status === 429 || res.status >= 500;
      if (!transient || attempt >= XAI_MAX_RETRIES) break;
      await sleep(retryDelayMs(res, attempt));
    }

    // Only a wrong/unavailable model is worth re-asking under the other name.
    if (status !== 403 && status !== 404) break;
  }
  throw new Error(lastErr);
}

const XAI_MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Honour Retry-After when xAI sends one, else exponential backoff. */
function retryDelayMs(res: Response, attempt: number): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, 10_000);
    }
    const when = Date.parse(header);
    if (Number.isFinite(when)) {
      return Math.min(Math.max(when - Date.now(), 0), 10_000);
    }
  }
  return Math.min(1000 * 2 ** attempt, 8000);
}

async function decodeImagePayload(data: {
  data?: XaiImageRow[];
}): Promise<{ buffer: Buffer; ext: string }> {
  const row = data.data?.[0];
  if (!row) throw new Error("xAI returned no image");
  if (row.b64_json) {
    return { buffer: Buffer.from(row.b64_json, "base64"), ext: ".png" };
  }
  if (row.url) {
    const img = await fetch(row.url);
    if (!img.ok) throw new Error("Failed to download generated image");
    return { buffer: Buffer.from(await img.arrayBuffer()), ext: ".png" };
  }
  throw new Error("xAI image had no b64 or url");
}
