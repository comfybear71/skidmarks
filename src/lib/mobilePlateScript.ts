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
      : `Exactly ${speakers.length} people in frame: ${speakers.join(", ")}. ${speakers[0]} nearest camera, others reacting. No extras.`;
  return [visual, `Place: ${place}.`, camera, who].filter(Boolean).join(" ");
}

/** True once compileConstructionStillPosition has added a research camera. */
export function hasResearchCameraLine(staging?: string): boolean {
  return /TIGHT CLOSE-UP|WIDE full-body|LOW ANGLE|Walking toward camera|Leaning, three-quarter|Body using the bed|Pose from the visual|Wide enough to show everyone/i.test(
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

function escapeNameRe(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function visualNameAliases(rosterName: string): string[] {
  const n = rosterName.trim();
  const aliases = [n];
  if (/crazy big hole jo too/i.test(n)) aliases.push("Jo Too", "Jo Too's");
  if (/ladder one/i.test(n)) aliases.push("Ladder One");
  if (/land landy/i.test(n)) aliases.push("Land Landy", "LandLady");
  if (/big sexy/i.test(n)) aliases.push("Big Sexy");
  return aliases;
}

/** CAST names written in [VISUAL_ACTION] — two-shot stills use these, not only the line speaker. */
export function castNamedInVisual(visual: string, roster: string[]): string[] {
  const text = String(visual || "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const found: string[] = [];
  const seen = new Set<string>();
  const names = roster
    .map((s) => s.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    const hit = visualNameAliases(name).some((alias) =>
      new RegExp(`\\b${escapeNameRe(alias)}\\b`, "i").test(text),
    );
    if (!hit) continue;
    seen.add(key);
    found.push(name);
  }
  return found;
}

/** Speaker first, then other CAST named in the visual. No extras. */
export function speakersForConstructionStill(opts: {
  speaker?: string;
  speakers?: string[];
  visual?: string;
  roster?: string[];
}): string[] {
  const beat = (opts.speakers || []).map((s) => s.trim()).filter(Boolean);
  const fromVisual = castNamedInVisual(opts.visual || "", opts.roster || []);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of [opts.speaker || "", ...beat, ...fromVisual]) {
    const n = name.trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

/** Construction compiled as solo while the visual names more CAST. */
export function isStaleSoloConstruction(staging: string, names: string[]): boolean {
  if (names.length < 2) return false;
  const t = String(staging || "");
  if (/Exactly \d+ people in frame/i.test(t)) return false;
  return /Only .+ in frame/i.test(t);
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
  roster?: string[];
  place: string;
}): string {
  const incoming = (opts.stagingIn || "").trim();
  const existing = (opts.existingStaging || "").trim();
  const visual = visualActionFromSummary(opts.summary);
  const names = speakersForConstructionStill({
    speaker: opts.speaker,
    speakers: opts.speakers,
    visual,
    roster: opts.roster,
  });
  const place = opts.place.trim() || "this place";

  if (
    incoming &&
    !isTalkingMcuDefault(incoming) &&
    !isBareVisualAction(incoming, visual) &&
    !isStaleSoloConstruction(incoming, names)
  ) {
    return incoming;
  }
  if (
    existing &&
    !isTalkingMcuDefault(existing) &&
    !isBareVisualAction(existing, visual) &&
    !isStaleSoloConstruction(existing, names)
  ) {
    return existing;
  }
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
