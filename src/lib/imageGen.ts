import fs from "fs";
import path from "path";
import { getEnv } from "./env";
import {
  getShowStylePreset,
  type ShowStyleId,
} from "./showStylePresets";
import { styleRealismLabel } from "./types";

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

/**
 * When the slider leaves the Skidmarks band, strip show-recipe lines that
 * fight the bias ("not a cartoon" / 3D feature language at the cel end,
 * "not photographic" at photo).
 */
function lookPromptForSlider(base: string, n: number): string {
  let out = base;
  if (n < 50) {
    out = out
      .replace(/,?\s*[Nn]ot a cartoon\.?/g, "")
      .replace(/,?\s*[Nn]ot cartoon\.?/g, "")
      .replace(/,?\s*[Nn]ot a flat cartoon\.?/g, "");
  }
  // Cartoon end: kill Skidmarks 3D lock words so they cannot leak past the bias.
  if (n <= 35) {
    out = out
      .replace(/\bhighly detailed\s+/gi, "")
      .replace(/\bstylised 3D animated feature render\b/gi, "")
      .replace(/\bstylised 3D animated feature\b/gi, "")
      .replace(/\bstylised 3D feature render\b/gi, "")
      .replace(/\bstylised 3D feature\b/gi, "")
      .replace(/\bclean simplified forms\b/gi, "")
      .replace(/\bbelievable materials\b/gi, "")
      .replace(/\bsoft overcast lighting\b/gi, "")
      .replace(/\bshallow depth of field(?: with blurred background)?\b/gi, "")
      .replace(/\bcinematic quality\b/gi, "")
      .replace(/\bsharp focus\b/gi, "")
      .replace(/,?\s*[Nn]ot photographic\.?/g, "")
      .replace(/,?\s*[Cc]learly made(?:[,.]?\s*not a camera photo)?\.?/gi, "")
      .replace(/,?\s*[Nn]ot a camera photo\.?/g, "");
  }
  if (n > 65) {
    out = out
      .replace(/,?\s*[Nn]ot photographic\.?/g, "")
      .replace(/,?\s*[Nn]ot a camera photo\.?/g, "")
      .replace(/,?\s*[Cc]learly made\.?/g, "");
  }
  return out
    .replace(/\s{2,}/g, " ")
    .replace(/\.\s*\./g, ".")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*\./g, ".")
    .trim();
}

/** Flat 2D / Sunny Banks cel — used when slider is on the cartoon end. */
const CEL_2D_LOOK =
  "rubbery adult cartoon, thick black outlines, flat cel colour, big heads, noodly arms, sun-bleached Aussie palette, dusty ochre, faded teal, washed-out yellow, heat haze, hand-drawn 2D cel animation still, flat colour fills, pure graphic 2D read";

/** One distinct bias line per slider step (0–100). Low=cel, mid=stylised 3D, high=photo. */
function crashGenRenderBias(n: number): string {
  const zone = styleRealismLabel(n);
  const head = `RENDER BIAS (slider ${n} — ${zone})`;
  const not3d =
    "Flat 2D only — hand-drawn cel cartoon like Sunny Banks. NOT stylised 3D, NOT a feature render, NOT sculpted materials, NOT shallow depth of field.";

  // Cel / cartoon end — strong 2D; no Skidmarks 3D leak.
  if (n <= 0) {
    return `${head}: extreme flat 2D Sunny Banks cel — thick black ink outlines, poster flat colour fills, rubbery adult cartoon, pure graphic 2D. ${not3d}`;
  }
  if (n <= 5) {
    return `${head}: hard flat 2D cel cartoon — bold black outlines, flat cel colour, simple graphic shapes, rubbery adult cartoon. ${not3d}`;
  }
  if (n <= 10) {
    return `${head}: strong flat 2D cel — thick outlines, flat fills, simplified hand-drawn 2D forms, Sunny Banks cartoon energy. ${not3d}`;
  }
  if (n <= 15) {
    return `${head}: clear flat 2D / cel cartoon — bold outlines, flat colour, graphic shapes, rubbery adult cartoon. ${not3d}`;
  }
  if (n <= 20) {
    return `${head}: hard cartoon cel push — flat cel colour, thick outline weight, 2D graphic read, Sunny Banks lane. ${not3d}`;
  }
  if (n <= 25) {
    return `${head}: rubbery flat 2D cartoon — cel colour, thick outlines, big graphic shapes, hand-drawn cel still. ${not3d}`;
  }
  if (n <= 30) {
    return `${head}: strong flat 2D cel cartoon — flat colour, clear outlines, Sunny Banks-style 2D read. ${not3d}`;
  }
  if (n <= 35) {
    return `${head}: clear 2D cel lean — flat colour and outline cartoon, still graphic 2D not sculpted 3D. ${not3d}`;
  }
  if (n <= 40) {
    return `${head}: slight cartoon lean — softer, simpler forms; still readable shapes, not full feature 3D.`;
  }
  if (n <= 45) {
    return `${head}: edge of stylised 3D — mostly sculpted forms, a touch more graphic/cel than the lock mid.`;
  }

  // Skidmarks band (~50–65): locked stylised 3D feature — wording intensity still steps.
  if (n <= 50) {
    return `${head}: stylised 3D animated feature — clean simplified forms, believable materials, soft overcast; lightly caricatured; closer to graphic than lock mid. Not photographic.`;
  }
  if (n <= 55) {
    return `${head}: stylised 3D animated feature render, clean simplified forms, believable materials, soft overcast lighting, shallow depth of field, sharp focus. Clearly made — not a camera photo, not a flat cartoon.`;
  }
  if (n <= 60) {
    return `${head}: highly detailed stylised 3D animated feature render, clean simplified forms, believable materials, soft overcast lighting, shallow depth of field with blurred background, cinematic quality, sharp focus. Not photographic, not a cartoon. Caricature modelled into forms — exaggeration sculpted, never drawn.`;
  }
  if (n <= 65) {
    return `${head}: highly detailed stylised 3D animated feature render — clean forms, richer believable materials, soft overcast, shallow depth of field, cinematic. Not photographic, not a cartoon. Lock still strong; materials a hair fuller than mid.`;
  }

  // Leaving lock toward photo — no "not photographic" fighting.
  if (n <= 70) {
    return `${head}: stylised 3D feature with richer materials and a little more natural light — still sculpted and clearly made, not flat cel.`;
  }
  if (n <= 75) {
    return `${head}: pull toward photographic realism — sharper surface texture, natural light, camera depth of field.`;
  }
  if (n <= 80) {
    return `${head}: clear photographic lean — real-world materials and light, lens depth, less stylised.`;
  }
  if (n <= 85) {
    return `${head}: strongly photographic cinematic still — accurate materials, real-world light, lens look.`;
  }
  if (n <= 90) {
    return `${head}: near-photographic cinematic still — accurate materials and light, camera framing.`;
  }
  if (n <= 95) {
    return `${head}: camera-real cinematic still — photographic detail, natural light, lens depth.`;
  }
  return `${head}: full photographic cinematic still — photo materials, photo light, lens depth of field.`;
}

/** Crash Lab Image gen — show recipe + cartoon←→photo slider. */
export function buildCrashGenLook(
  styleId: ShowStyleId,
  styleRealism: number,
): string {
  const n = Math.max(0, Math.min(100, Math.round(Number(styleRealism) || 0)));

  // Cartoon end (0–35): slider means flat 2D / Sunny Banks cel for THIS generate.
  // Do not let Skidmarks mid recipe ("stylised 3D feature") lead the prompt.
  if (n <= 35) {
    const celBase =
      styleId === "sunny_banks"
        ? getShowStylePreset("sunny_banks").lookPrompt
        : CEL_2D_LOOK;
    return `${lookPromptForSlider(celBase, n)}\n\n${crashGenRenderBias(n)}`;
  }

  const base = lookPromptForSlider(
    getShowStylePreset(styleId).lookPrompt,
    n,
  );
  return `${base}\n\n${crashGenRenderBias(n)}`;
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
  const bits = [
    "Empty establishing location still — architecture, furniture, weather and materials only. Cast arrives later on separate shot plates.",
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
    opts.styleId
      ? "Name real materials for THIS specific place — bank counters, cafe tables, street kerbs, lava rock, whatever the notes ask for."
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
    "Character face still.",
    // With a styleId the note is the whole story prompt (mobile Auto Studio),
    // so it has to read as background for ONE cast member — dumping it raw
    // made the generator draw the entire scene: both speakers, mid-dialogue.
    opts.styleId && who
      ? `Design ONE character only — ${opts.name}. ${opts.name} is: ${who}`
      : who
        ? `Who they are: ${who}`
        : "",
    opts.rejectHints.length
      ? `Fix previous rejects: ${opts.rejectHints.join("; ")}`
      : "",
    opts.styleId
      ? buildCrashGenLook(opts.styleId, opts.styleRealism)
      : stylePrompt(opts.styleRealism),
    opts.styleId
      ? "Use the reference image(s) for identity when provided. Portrait or upper body, facing camera."
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
      "Missing XAI_API_KEY. Add it to MY MOVIES\\.env then restart Studio.",
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
      " — Make a new key at https://console.x.ai → API Keys, paste into MY MOVIES\\.env as XAI_API_KEY=..., save, Generate again (Studio re-reads .env)."
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
): Promise<{ buffer: Buffer; ext: string }> {
  const models = [
    String(body.model || "grok-imagine-image"),
    "grok-imagine-image-quality",
  ];
  const tryModels = [...new Set(models)];

  let lastErr = "";
  for (const model of tryModels) {
    const payload = { ...body, model };
    // Without a signal this fetch can hang indefinitely, and the retry loop
    // makes it hang twice — that is what stalled the phone on a spinner with
    // nothing to show and no error.
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
      break;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return decodeImagePayload(data);
    lastErr = xaiErrorMessage(res.status, data);
    if (res.status !== 403 && res.status !== 404) break;
  }
  throw new Error(lastErr);
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
