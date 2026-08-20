/**
 * Scratch gold scenarios — one proven example per situation, not a bible dump.
 * Promote a Pass here only after Scratch proves it. Refine in place until
 * automation can rely on the base. Tokens: {{name}} {{place}} {{line}}
 *
 * Pipeline note (2026-08-20): spicy Siray plates (Seedream / i2v 2.0) can be
 * spoken later on LTX — still Draw first, Save mp3, then LTX Image motion.
 * GLOBAL lip-sync lead is hard-wired on send (`LTX_LIP_SYNC_LEAD`) — do not
 * paste it into the Image motion box.
 */

export type ScratchGoldTarget = "staging" | "motion";

export type ScratchGoldScenario = {
  id: string;
  /** Short chip label on the Gold prompts menu. */
  label: string;
  /** One-line "for what" — when to pick this. */
  forWhat: string;
  /** Engine / surface this gold was proven on (human note). */
  provenOn: string;
  target: ScratchGoldTarget;
  /** Prompt body with optional {{name}} {{place}} {{line}}. */
  template: string;
  /** Optional spoken line to drop into the dialogue box when empty. */
  defaultLine?: string;
};

/**
 * Seed set — situations we already know we incur.
 * Replace templates with Stuie's Pass wording when a better Pass lands.
 */
export const SCRATCH_GOLD_SCENARIOS: readonly ScratchGoldScenario[] = [
  {
    id: "still-one-person-mcu",
    label: "Still · 1 person MCU",
    forWhat: "Draw — solo face lock, no extras, mouth clear",
    provenOn: "Scratch Draw (archive one-character MCU)",
    target: "staging",
    template: [
      "Medium close-up of {{name}} at {{place}}. Upper chest and face fill the frame.",
      "{{name}} is sitting at {{place}}, weight grounded. Facing camera, mouth clear.",
      "Empty hands in her lap. No phone.",
      "Only {{name}} in frame. No other people.",
      "Same face as the locked cast card. Highly detailed stylised 3D animated feature render,",
      "clean forms, believable materials, soft overcast lighting, cinematic quality, sharp focus.",
      "Not photographic, not a cartoon, not photorealistic.",
    ].join(" "),
  },
  {
    id: "still-anti-cartoon",
    label: "Still · anti-cartoon lock",
    forWhat: "Draw — stop Skidmarks 3D slipping into cel / Pixar",
    provenOn: "Scratch Draw (style-slip Fail archive)",
    target: "staging",
    template: [
      "{{name}} at {{place}} — keep the exact face and body from the locked cast card.",
      "Highly detailed stylised 3D animated feature render with clean forms, believable materials,",
      "soft overcast lighting, cinematic quality, sharp focus.",
      "Not photographic, not a cartoon, not soft Pixar, not photorealistic.",
      "Do not flatten into cel outlines or big anime eyes.",
      "Only {{name}} in frame. No other people.",
    ].join(" "),
  },
  {
    id: "still-anti-crowd",
    label: "Still · no extras",
    forWhat: "Draw — stop strangers / doubles appearing in the room",
    provenOn: "Scratch Draw (hallucination Fail examples)",
    target: "staging",
    template: [
      "{{name}} alone at {{place}}.",
      "Only {{name}} in frame. No other people. No crowd. No background figures.",
      "No twin, no duplicate of {{name}}. Empty hands. No phone unless named.",
      "Same person as the locked cast card — not a cousin, not a stranger.",
    ].join(" "),
  },
  {
    id: "still-spicy-edit-from-still",
    label: "Still · spicy edit from still",
    forWhat: "Draw (Siray Spicy) — same room/camera as attached; one clear wardrobe/pose change",
    provenOn: "Siray Spicy plate Pass 2026-08-20 (LADDER ONE squat / skirt)",
    target: "staging",
    template: [
      "Same as the attached image — same room, camera, topless with visible nipples, not smoothed,",
      "cream ribbed knit mini-skirt with twisted knot, heels, same lean and angle.",
      "Only change: squat down at the knees, both hands pull the skirt right down to her ankles —",
      "bunched low around ankles. Pink underpants clearly visible. Still topless, bare breasts with nipples visible.",
      "Do not add a top. Do not sit on the bed.",
      "Only {{name}} in frame. No other people.",
      "Same face and body as the start image. Not cartoon, not smoothed.",
    ].join(" "),
  },
  {
    id: "clip-one-person-siray20",
    label: "Clip · Siray 2.0 one person",
    forWhat: "Generate Siray i2v 2.0 — one person, locked pose, hip sway",
    provenOn: "Siray Seedance 2.0 i2v Spicy (Scratch Pass, many poses)",
    target: "motion",
    template: [
      "A wide full-body video sequence where the single female subject from the source frame",
      "remains in her exact standing pose. The camera is locked completely static.",
      "Flirtatious hip sway, feet planted. Her head and mouth move fluidly as she speaks to the lens.",
      "Delivering: '{{line}}'",
      "Highly detailed, stylised 3D animated feature render with clean forms, believable materials,",
      "soft overcast lighting, cinematic quality, sharp focus.",
      "Only the subject from the source frame. No new people enter the frame.",
      "Props and background stay exactly as the start image.",
    ].join(" "),
  },
  {
    id: "clip-ltx-after-spicy",
    label: "Clip · LTX after spicy plate",
    forWhat: "After spicy still Pass — LTX lip-sync on Saved mp3 (start image lock)",
    provenOn: "Siray Spicy plate → LTX speaking Pass 2026-08-20",
    target: "motion",
    defaultLine: "[playfully]you know i am a slut, you 2 dirty little tiprats!",
    template: [
      "Use the provided start image as the first frame.",
      "{{name}}, She is a beutiful Thai lady, lovely body, black hair brown eyse, not cartoon is prominent,",
      "empty hands stay as the start image, no phone, mouth and head move naturally while speaking, subtle gesture.",
      "Only {{name}} in frame, no one else appears.",
      "Props and background stay exactly as the start image, nothing new enters frame.",
      "No new objects. No readable text or signage. Background stays as the start image.",
      '{{name}} says: "{{line}}".',
      "Camera holds. Same person and objects as the start image.",
      "No new people enter the frame. Nobody mentioned in the spoken line appears on screen.",
      "highly detailed stylised 3D animated feature render, clean simplified forms, believable materials,",
      "soft overcast lighting, shallow depth of field, cinematic quality, sharp focus.",
      "Not photographic, not a cartoon. Not photographic, not photorealistic.",
    ].join(" "),
  },
  {
    id: "clip-speaking-ltx",
    label: "Clip · LTX speaking gold",
    forWhat: "Generate LTX — lip-sync on Saved mp3, start-image lock (generic)",
    provenOn: "First Fleet /m Cloud LTX IA2V gold",
    target: "motion",
    template: [
      "Use the provided start image as the first frame.",
      "{{name}} is prominent, mouth and head move naturally while speaking, subtle gesture.",
      "Only {{name}} in frame, no one else appears.",
      "Props and background stay exactly as the start image, nothing new enters frame.",
      '{{name}} says: "{{line}}".',
      "Camera holds. Same person and objects as the start image.",
      "No new people enter the frame. Nobody mentioned in the spoken line appears on screen.",
      "Highly detailed stylised 3D animated feature render, clean simplified forms, believable materials,",
      "soft overcast lighting, cinematic quality, sharp focus.",
      "Not photographic, not a cartoon, not photorealistic.",
    ].join(" "),
  },
  {
    id: "clip-anti-hallucination",
    label: "Clip · anti-hallucination",
    forWhat: "Generate — extras / phone ghosts / walkers entering mid-clip",
    provenOn: "Scratch /m Fail examples (strangers in frame)",
    target: "motion",
    template: [
      "Use the provided start image as the first frame.",
      "The single subject from the source frame stays in their exact pose.",
      "Camera locked completely static. Absolute zero background movement or scene changes.",
      "Only the subject from the source frame. No new people enter the frame.",
      "Nobody mentioned in the spoken line appears on screen.",
      "No readable text or signage. Props and background stay exactly as the start image,",
      "nothing new enters frame. Same person and objects as the start image.",
      "Head and mouth move naturally while speaking. Delivering: '{{line}}'",
      "Highly detailed, stylised 3D animated feature render with clean forms, believable materials,",
      "soft overcast lighting, cinematic quality, sharp focus.",
      "Not photographic, not a cartoon.",
    ].join(" "),
  },
];

export function scratchGoldById(id: string): ScratchGoldScenario | undefined {
  return SCRATCH_GOLD_SCENARIOS.find((row) => row.id === id);
}

export function applyGoldTokens(
  template: string,
  tokens: { name: string; place: string; line: string },
): string {
  return template
    .replace(/\{\{name\}\}/g, tokens.name.trim() || "Character")
    .replace(/\{\{place\}\}/g, tokens.place.trim() || "this place")
    .replace(/\{\{line\}\}/g, tokens.line.trim() || "…");
}
