/**
 * Show look + slider words. Client-safe (no fs). Draw preview and server
 * send both use this so the pad can show the same lock Siray gets.
 */

import type { ShowStyleId } from "./showStylePresets";
import { styleRealismLabel } from "./types";

const LOOK_PROMPT: Record<ShowStyleId, string> = {
  skidmarks:
    "highly detailed stylised 3D animated feature render, clean simplified forms, believable materials, soft overcast lighting, shallow depth of field, cinematic quality, sharp focus. Not photographic, not a cartoon",
  sunny_banks:
    "rubbery adult cartoon, thick black outlines, flat cel colour, big heads, noodly arms, sun-bleached Aussie palette, dusty ochre, faded teal, washed-out yellow, heat haze",
  doc: "documentary interview framing, natural available light, shallow depth of field, handheld feel, believable skin and fabric",
  music_video:
    "music video cinematography, bold colour grade, performance lighting, stylised but not cartoon",
  deepfake:
    "photographic portrait lighting, believable skin pores, slight uncanny smoothness, locked identity",
  photoreal:
    "photorealistic cinematic still, natural materials, accurate lighting, shallow depth of field, sharp focus",
};

function lookPromptForSlider(base: string, n: number): string {
  let out = base;
  if (n < 50) {
    out = out
      .replace(/,?\s*[Nn]ot a cartoon\.?/g, "")
      .replace(/,?\s*[Nn]ot cartoon\.?/g, "")
      .replace(/,?\s*[Nn]ot a flat cartoon\.?/g, "");
  }
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

const CEL_2D_LOOK =
  "rubbery adult cartoon, thick black outlines, flat cel colour, big heads, noodly arms, sun-bleached Aussie palette, dusty ochre, faded teal, washed-out yellow, heat haze, hand-drawn 2D cel animation still, flat colour fills, pure graphic 2D read";

function crashGenRenderBias(n: number): string {
  const zone = styleRealismLabel(n);
  const head = `RENDER BIAS (slider ${n} — ${zone})`;
  const not3d =
    "Flat 2D only — hand-drawn cel cartoon like Sunny Banks. NOT stylised 3D, NOT a feature render, NOT sculpted materials, NOT shallow depth of field.";

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
export function buildCrashGenLook(styleId: ShowStyleId, styleRealism: number): string {
  const n = Math.max(0, Math.min(100, Math.round(Number(styleRealism) || 0)));
  if (n <= 35) {
    const celBase = styleId === "sunny_banks" ? LOOK_PROMPT.sunny_banks : CEL_2D_LOOK;
    return `${lookPromptForSlider(celBase, n)}\n\n${crashGenRenderBias(n)}`;
  }
  const base = lookPromptForSlider(LOOK_PROMPT[styleId] || LOOK_PROMPT.skidmarks, n);
  return `${base}\n\n${crashGenRenderBias(n)}`;
}
