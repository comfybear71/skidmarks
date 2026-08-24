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
 * Camera sentence from the 20-position campaign + plateFramingLine research.
 * Visual action stays the body. Do not invent props.
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
  if (people >= 2) {
    return "MEDIUM SHOT. Wide enough to show everyone clearly. Not a one-person talking portrait.";
  }
  return "MEDIUM SHOT. Pose from the visual — not a sitting talking-head default.";
}

/** Construction still Position: visual action + campaign camera + who is in frame. */
export function compileConstructionStillPosition(opts: {
  visual: string;
  place: string;
  speakers: string[];
}): string {
  const visual = opts.visual.trim();
  const place = opts.place.trim() || "this place";
  const speakers = [
    ...new Set(opts.speakers.map((s) => s.trim()).filter(Boolean)),
  ];
  if (!visual) {
    if (speakers.length === 1) {
      return compileScriptedPosition({ name: speakers[0], place });
    }
    return "";
  }
  const camera = cameraLineFromVisual(visual, speakers.length);
  const who =
    speakers.length <= 1
      ? speakers[0]
        ? `Only ${speakers[0]} in frame, no one else appears.`
        : ""
      : `Exactly ${speakers.length} people in frame: ${speakers.join(", ")}. No extras.`;
  return [visual, `Place: ${place}.`, camera, who].filter(Boolean).join(" ");
}

/**
 * Prefer the construction camera / existing Position. Only fall back to the
 * talking MCU default when the shot has no visual and no Position.
 */
export function resolvePlateStaging(opts: {
  stagingIn?: string;
  existingStaging?: string;
  summary?: string;
  speaker: string;
  speakers?: string[];
  place: string;
}): string {
  const incoming = (opts.stagingIn || "").trim();
  const existing = (opts.existingStaging || "").trim();
  const visual = visualActionFromSummary(opts.summary);
  const speakers = (opts.speakers || [])
    .map((s) => s.trim())
    .filter(Boolean);
  const names = speakers.length ? speakers : opts.speaker.trim() ? [opts.speaker.trim()] : [];
  const place = opts.place.trim() || "this place";

  if (incoming && !isTalkingMcuDefault(incoming)) return incoming;
  if (existing && !isTalkingMcuDefault(existing)) return existing;
  if (visual) {
    return compileConstructionStillPosition({ visual, place, speakers: names });
  }
  if (incoming) return incoming;
  if (existing) return existing;
  if (opts.speaker.trim()) {
    return compileScriptedPosition({ name: opts.speaker.trim(), place });
  }
  return "";
}
