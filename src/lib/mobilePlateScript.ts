import { rewriteStockStandingSoloStaging } from "./mobileImageMotion";

/** Scripted talking-plate Position — human only types the Line after this. */
export function compileScriptedPosition(opts: { name: string; place: string }): string {
  const name = opts.name.trim() || "The character";
  const place = opts.place.trim() || "this place";
  const onBed = /\b(bed|bedroom|cell)\b/i.test(place);
  const sit = onBed
    ? `${name} is sitting on the bed, butt on the mattress, knees forward. The bed frame is under and behind them — not on a chair, not standing, not in front of the bed.`
    : `${name} is sitting at ${place}, weight grounded.`;
  return [
    `Medium close-up of ${name} at ${place}. Upper chest and face fill the frame.`,
    sit,
    "Facing camera, mouth clear.",
    "Empty hands in her lap. No phone.",
    `Only ${name} in frame. No other people.`,
  ].join(" ");
}

/** Construction [VISUAL_ACTION] line — the still, not the spoken line. */
export function visualActionFromSummary(summary?: string): string {
  const m = String(summary || "").match(/\[VISUAL_ACTION\]\s*([^\n]+)/i);
  return (m?.[1] || "").trim();
}

/** Construction [BUDGET_TIER] — CHEAP_TAKE stays a talking-head. */
export function budgetTierFromSummary(summary?: string): string {
  const m = String(summary || "").match(/\[BUDGET_TIER\]\s*([^\n]+)/i);
  return (m?.[1] || "").trim().toUpperCase();
}

export function isCheapTalkingTake(summary?: string): boolean {
  return /^CHEAP_TAKE\b/.test(budgetTierFromSummary(summary));
}

/** True when Position is the talking-desk MCU default, not a shot camera. */
export function isTalkingMcuDefault(staging?: string): boolean {
  const t = String(staging || "");
  return (
    /Medium close-up of .+\. Upper chest and face fill the frame/i.test(t) &&
    /Facing camera, mouth clear/i.test(t) &&
    /Empty hands in her lap/i.test(t)
  );
}

/**
 * Named camera only. Empty string means talking-desk MCU — do not invent
 * "not a sitting talking-head" as a second camera.
 */
export function cameraLineFromVisual(visual: string, people: number): string {
  const t = visual.toLowerCase();
  if (/\bextreme close-up\b|\beye staring\b|\bblack-and-blue eye\b/.test(t)) {
    return "TIGHT CLOSE-UP, face fills the frame, shoulders barely visible, huge and near the camera. Do not pull back.";
  }
  if (/\blow-angle\b/.test(t) || /\bclimbs up onto\b/.test(t)) {
    return "LOW ANGLE medium shot, camera looks up, figure large in frame. Not a sitting talking-head.";
  }
  if (/\bover-the-shoulder\b|\bover the shoulder\b/.test(t)) {
    return "MEDIUM SHOT. Three-quarter back, looking back over the shoulder at the camera.";
  }
  if (
    /\bsurrounds\b|\btight circle\b|\bhaymaker\b|\bspins in the air\b|\bcrashes down\b|\bthrows him\b|\bwrestling\b/.test(
      t,
    )
  ) {
    return "WIDE full-body, head to toe, lots of the place around them. Show the ground. Not a close talking portrait.";
  }
  if (/\bstrolls\b|\bwalks past\b|\bwalks by\b|\bcharges past\b|\bscrambles\b|\bstruts\b/.test(t)) {
    return "MEDIUM CLOSE-UP. Walking toward camera, filling the frame, huge and near, one foot forward. Do not sit them. Do not leave them tiny in the distance.";
  }
  if (/\bleans?\b|\bleaning\b|\bleans out\b/.test(t)) {
    return "MEDIUM SHOT. Leaning, three-quarter body. Not dead-centre floating. Not a sitting portrait.";
  }
  if (/\bslumped\b|\bcot\b|\bbandages\b/.test(t)) {
    return "MEDIUM SHOT. Body using the bed — slumped, not sitting upright facing camera as a talking plate.";
  }
  void people;
  return "";
}

/** Construction still Position: named camera, or the talking MCU. */
export function compileConstructionStillPosition(opts: {
  visual: string;
  place: string;
  speakers: string[];
  cheap?: boolean;
}): string {
  const visual = opts.visual.trim();
  const place = opts.place.trim() || "this place";
  const speakers = [
    ...new Set(opts.speakers.map((s) => s.trim()).filter(Boolean)),
  ];
  const talkingName = speakers[0] || "";
  if (!visual || opts.cheap) {
    if (talkingName) return compileScriptedPosition({ name: talkingName, place });
    return "";
  }
  const camera = cameraLineFromVisual(visual, speakers.length);
  if (!camera) {
    if (talkingName) return compileScriptedPosition({ name: talkingName, place });
    return "";
  }
  const who =
    speakers.length <= 1
      ? talkingName
        ? `Only ${talkingName} in frame, no one else appears.`
        : ""
      : `Exactly ${speakers.length} people in frame: ${speakers.join(", ")}. No extras.`;
  return [visual, `Place: ${place}.`, camera, who].filter(Boolean).join(" ");
}

/** True once compileConstructionStillPosition has added a research camera. */
export function hasResearchCameraLine(staging?: string): boolean {
  return /TIGHT CLOSE-UP|WIDE full-body|LOW ANGLE|Walking toward camera|Leaning, three-quarter|Body using the bed/i.test(
    String(staging || ""),
  );
}

/** Lock stores raw [VISUAL_ACTION] as Position — that still needs a camera. */
export function isBareVisualAction(staging: string, visual: string): boolean {
  const a = staging.replace(/\s+/g, " ").trim();
  const b = visual.replace(/\s+/g, " ").trim();
  if (!a || !b) return false;
  if (a === b) return true;
  return a.startsWith(b) && !hasResearchCameraLine(a);
}

/**
 * One environment: talking-desk MCU unless the director typed a camera,
 * or [VISUAL_ACTION] names a real move and the shot is not CHEAP_TAKE.
 */
export function resolvePlateStaging(opts: {
  stagingIn?: string;
  existingStaging?: string;
  summary?: string;
  speaker: string;
  speakers?: string[];
  place: string;
}): string {
  const incoming = rewriteStockStandingSoloStaging(opts.stagingIn || "");
  const existing = rewriteStockStandingSoloStaging(opts.existingStaging || "");
  const visual = visualActionFromSummary(opts.summary);
  const cheap = isCheapTalkingTake(opts.summary);
  const speakers = (opts.speakers || [])
    .map((s) => s.trim())
    .filter(Boolean);
  const names = speakers.length ? speakers : opts.speaker.trim() ? [opts.speaker.trim()] : [];
  const place = opts.place.trim() || "this place";
  const namedCamera = !cheap && visual ? cameraLineFromVisual(visual, names.length) : "";

  if (
    incoming &&
    !isTalkingMcuDefault(incoming) &&
    !isBareVisualAction(incoming, visual)
  ) {
    return incoming;
  }
  if (
    existing &&
    !isTalkingMcuDefault(existing) &&
    !isBareVisualAction(existing, visual)
  ) {
    return existing;
  }
  if (namedCamera) {
    return compileConstructionStillPosition({
      visual,
      place,
      speakers: names,
      cheap: false,
    });
  }
  if (incoming) return incoming;
  if (existing) return existing;
  if (opts.speaker.trim()) {
    return compileScriptedPosition({ name: opts.speaker.trim(), place });
  }
  if (names[0]) {
    return compileScriptedPosition({ name: names[0], place });
  }
  return "";
}
