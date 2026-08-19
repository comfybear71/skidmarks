/**
 * Scratch /m prompt bible — banks for still Draw (includes every old preset dropdown).
 * Accordion UI: pick chips to edit the prompt; Draw is separate. Future: user-added chips — see docs/FUTURE.md §6.
 */

import { campaignStagingForId, plateLtxCampaignScenarios } from "../mobilePlateLtxCampaign";

export type ScratchBibleSectionId =
  | "composition"
  | "pose"
  | "wardrobe"
  | "props"
  | "drama"
  | "atmosphere"
  | "crowd";

export type ScratchBibleEntry = {
  id: string;
  label: string;
  /** Staging / motion block with {{name}} {{place}} tokens. */
  template: string;
};

export type ScratchBibleSection = {
  id: ScratchBibleSectionId;
  label: string;
  hint: string;
  entries: ScratchBibleEntry[];
};

/** Every id that lived in the old Frame / Body / … dropdown rows (built-ins only). */
export const SCRATCH_DROPDOWN_PRESET_IDS = [
  "mcu-phone",
  "wide-full",
  "tight-face",
  "over-shoulder",
  "walk-in",
  "sitting",
  "standing",
  "running",
  "sprawl",
  "dance",
  "leaning",
  "steps",
  "crouch",
  "handstand",
  "beer-cig",
  "pie",
  "clothes-dress",
  "clothes-underwear",
  "clothes-partial",
  "clothes-nude",
  "clothes-man-partial",
  "clothes-man-nude",
  "raining",
  "wash-hair",
  "crowd-two-shot",
  "crowd-surround",
  "crowd-pile",
] as const;

const DROPDOWN_WEARING: Record<string, { label: string; template: string }> = {
  "clothes-partial": {
    label: "Partial nude",
    template:
      "Adult {{name}}, partial nudity at {{place}} — topless or underwear only. Change the clothes from the face card. Same face, this body, not the outfit on the reference. Natural body, not a catalogue pose.",
  },
  "clothes-nude": {
    label: "Nude",
    template:
      "Adult {{name}}, fully nude at {{place}}. {{cast}} together in ONE photograph of that room — full bodies in their marked positions, not a collage, not a picture-in-picture. Change the clothes from the face card. Same face, hair, age and body. Ignore the outfit on the face card. Human anatomy, two feet on the floor. No text or watermarks.",
  },
  "clothes-man-partial": {
    label: "Man partial",
    template:
      "Adult man {{name}}, partial nudity at {{place}} — shirtless, underwear only or bare. Adult male chest. Change the clothes from the face card. Same face, this male body, not the tee. Do not redraw as a woman. Natural body, not a catalogue pose.",
  },
  "clothes-man-nude": {
    label: "Man nude",
    template:
      "Adult man {{name}}, fully nude at {{place}}. {{cast}} together in ONE photograph of that room — full bodies in their marked positions, not a collage, not a picture-in-picture. Adult male body — bare chest, visible human penis and scrotum, two feet on the floor, no clothes. Not a Ken doll, not a mutation, no extra limbs. Same face, hair, age and build as the face card. Ignore the tee, shorts and undies on the face card. Do not redraw as a woman. Adults only, no one under 21. No text or watermarks.",
  },
};

const DROPDOWN_CROWD: Record<string, { label: string; template: string }> = {
  "crowd-two-shot": {
    label: "Two-shot",
    template:
      "{{cast}} in a tight two-shot at {{place}}. Only {{cast}} in frame, no one else appears. {{name}} is nearest the camera, speaking. Others stay in frame beside them, reacting. Same faces as the face cards. Do not invent extras.",
  },
  "crowd-surround": {
    label: "Surround",
    template:
      "{{cast}} crowded around each other at {{place}}. Only {{cast}} in frame, no one else appears. {{name}} is in the middle, prominent. Others flank and lean in — hands, shoulders, close. Same faces as the face cards. Do not invent extras.",
  },
  "crowd-pile": {
    label: "Pile / tangle",
    template:
      "{{cast}} piled together at {{place}}. Only {{cast}} in frame, no one else appears. {{name}} is prominent in the pile. Others are pressed in close — tangled bodies, using each other and the place. Same faces as the face cards. Do not invent extras.",
  },
};

const DROPDOWN_BY_SECTION: Record<ScratchBibleSectionId, readonly string[]> = {
  composition: ["mcu-phone", "wide-full", "tight-face", "over-shoulder", "walk-in"],
  pose: ["sitting", "standing", "running", "sprawl", "dance", "leaning", "steps", "crouch", "handstand", "wash-hair"],
  props: ["beer-cig", "pie"],
  wardrobe: [
    "clothes-dress",
    "clothes-underwear",
    "clothes-partial",
    "clothes-nude",
    "clothes-man-partial",
    "clothes-man-nude",
  ],
  drama: [],
  atmosphere: ["raining"],
  crowd: ["crowd-two-shot", "crowd-surround", "crowd-pile"],
};

const BASE_SCRATCH_PROMPT_BIBLE: ScratchBibleSection[] = [
  {
    id: "composition",
    label: "Composition",
    hint: "Zoom + frame + camera",
    entries: [
      {
        id: "comp-wide",
        label: "Wide zoom-out",
        template:
          "Wide establishing shot of {{name}} at {{place}}. Full environment readable; {{name}} smaller in frame so the room and body both read clearly.",
      },
      {
        id: "comp-full",
        label: "Full body",
        template:
          "Full-body shot of {{name}} at {{place}}. Head to feet visible, natural stance, clear silhouette against the place.",
      },
      {
        id: "comp-medium",
        label: "Medium",
        template:
          "Medium shot of {{name}} at {{place}}. Waist-up, face and hands readable, room still visible behind them.",
      },
      {
        id: "comp-mcu",
        label: "Medium close",
        template:
          "Medium close-up of {{name}} at {{place}}. Upper chest and face fill the frame; shallow depth of field.",
      },
      {
        id: "comp-tight",
        label: "Tight face",
        template:
          "Tight close-up of {{name}} at {{place}}. Face dominates the frame from forehead to chin; eyes and mouth are primary.",
      },
      {
        id: "comp-ucu",
        label: "Ultra close-up",
        template:
          "Extreme close-up of {{name}} at {{place}}. Camera locked to eye-level. Filling the frame from neck up. Head moves slightly with speech.",
      },
      {
        id: "comp-cinematic",
        label: "Medium cinematic",
        template:
          "Medium close-up of {{name}} at {{place}}. Upper torso and face visible. {{name}} holds an item naturally at chest height. Shallow depth of field.",
      },
      {
        id: "comp-ots",
        label: "Over-shoulder",
        template:
          "Over-the-shoulder perspective at {{place}}. Looking past a foreground silhouette toward {{name}} standing about three meters away.",
      },
      {
        id: "comp-thirds",
        label: "Rule of thirds",
        template:
          "Asymmetric framing at {{place}}. {{name}} positioned strictly on the left third of the frame, looking across open empty space on the right.",
      },
      {
        id: "comp-sil",
        label: "Full-body silhouette",
        template:
          "Wide full-body shot of {{name}} at {{place}}. Subject centered against a dominant back-lit environment, clear body outline and stride geometry.",
      },
      {
        id: "comp-push",
        label: "Z-axis push",
        template:
          "[Camera: Steady linear push-in. Frame smoothly tightens onto {{name}}'s face over the duration, increasing background blur.]",
      },
      {
        id: "comp-low",
        label: "Low-angle menace",
        template:
          "[Camera: Low-angle perspective looking upward at {{name}}. Track slightly left to right to build environmental tension at {{place}}.]",
      },
      {
        id: "comp-crane",
        label: "Drone crane drop",
        template:
          "[Camera: High-altitude crane shot descending smoothly at {{place}}. Shifting from bird's-eye to an eye-level medium wide on {{name}}.]",
      },
      {
        id: "comp-pan",
        label: "Side profile pan",
        template:
          "[Camera: Lateral tracking shot. Moving parallel to {{name}}'s path at {{place}}, keeping spacing constant.]",
      },
    ],
  },
  {
    id: "pose",
    label: "Pose & Action",
    hint: "Body position + motion",
    entries: [
      {
        id: "pose-sit",
        label: "Sitting",
        template:
          "{{name}} is sitting at {{place}}, weight grounded, natural posture, hands free or resting.",
      },
      {
        id: "pose-on-bed",
        label: "On the bed",
        template:
          "{{name}} is sitting on the bed at {{place}}, butt on the mattress, knees forward, bed frame readable behind or beside them — not on a chair, not standing.",
      },
      {
        id: "pose-stand",
        label: "Standing",
        template:
          "{{name}} stands at {{place}}, balanced on both feet, shoulders relaxed, ready to speak.",
      },
      {
        id: "pose-face-cam",
        label: "Facing camera",
        template:
          "{{name}} faces the camera at {{place}}, eyes toward lens, head square to frame, mouth clearly readable for speech.",
      },
      {
        id: "pose-alone",
        label: "Alone in frame",
        template:
          "Only {{name}} in frame at {{place}}. Empty room behind them. No other people, no walkers, no extras, no crowd.",
      },
      {
        id: "pose-lie",
        label: "Lying down",
        template:
          "{{name}} is lying down at {{place}}, body stretched along the surface, head supported, looking toward camera or phone.",
      },
      {
        id: "pose-lean",
        label: "Leaning",
        template:
          "{{name}} leans against a wall or furniture at {{place}}, one shoulder loaded, casual weight shift.",
      },
      {
        id: "pose-kneel",
        label: "Kneeling",
        template:
          "{{name}} kneels at {{place}}, upright torso, knees on the floor, hands busy in front of them.",
      },
      {
        id: "pose-handstand",
        label: "Handstand",
        template:
          "{{name}} is in a handstand at {{place}}, arms locked, legs up, face strained with effort, place still readable behind them.",
      },
      {
        id: "pose-bin",
        label: "In a bin",
        template:
          "{{name}} is half-inside a rubbish bin at {{place}}, absurd and undignified, torso and arms clear, bin rim cutting the frame.",
      },
      {
        id: "pose-wash",
        label: "Washing hair",
        template:
          "{{name}} is washing their hair at {{place}}, wet hair, hands in scalp, water or sink context, eyes half-closed.",
      },
      {
        id: "pose-change",
        label: "Changing clothes",
        template:
          "{{name}} is mid clothing-change at {{place}}, arms lifting or stepping into garments, natural awkward staging, not a fashion lineup.",
      },
      {
        id: "pose-smoke",
        label: "Having a smoke",
        template:
          "{{name}} is having a smoke at {{place}}, cigarette or rollie at the lips or between fingers, exhale implied, casual stance.",
      },
      {
        id: "pose-beer",
        label: "Having a beer",
        template:
          "{{name}} is having a beer at {{place}}, can or bottle in hand near the mouth or resting on a knee, relaxed.",
      },
      {
        id: "pose-text",
        label: "Texting hard",
        template:
          "{{name}} is a keyboard warrior at {{place}}, phone in both hands, thumbs hammering keys, staring at the screen.",
      },
      {
        id: "pose-spin",
        label: "Rapid spin",
        template:
          "Dynamic rotational motion. {{name}} performs a swift 360-degree pivot mid-stride at {{place}}. Kinetic motion blur on background details.",
      },
      {
        id: "pose-stride",
        label: "Kinetic stride",
        template:
          "Brisk forward locomotion. Steady tracking camera retreats at identical speed. Continuous rhythmic footsteps matching head bobbing. {{name}} at {{place}}.",
      },
      {
        id: "pose-handcam",
        label: "Jerky hand-cam",
        template:
          "Unstable handheld documentation style. Rapid micro-jitters and organic camera shakes. {{name}} remains locked in sharp focus at {{place}}.",
      },
      {
        id: "pose-joints",
        label: "Multi-joint stressor",
        template:
          "Complex coordination. {{name}} hammers fingers rapidly against a surface while rhythmically nodding and shifting weight side-to-side at {{place}}.",
      },
      {
        id: "pose-reveal",
        label: "Spatial reveal",
        template:
          "Fast linear camera progression. Camera passes closely by static foreground obstacles to reveal {{name}} standing behind them at {{place}}.",
      },
    ],
  },
  {
    id: "wardrobe",
    label: "Wardrobe",
    hint: "What they're wearing — adult subjects only",
    entries: [
      {
        id: "ward-everyday",
        label: "Everyday clothes",
        template:
          "{{name}} wears ordinary everyday clothes at {{place}} — tee and jeans or similar, nothing fancy.",
      },
      {
        id: "ward-messy",
        label: "Messed-up clothes",
        template:
          "{{name}}'s clothes are messed up at {{place}} — wrinkled, half-tucked, slept-in look.",
      },
      {
        id: "ward-towel",
        label: "Towel only",
        template:
          "{{name}} is wrapped in a towel only at {{place}}, damp skin, just out of a wash.",
      },
      {
        id: "ward-robe",
        label: "Open robe",
        template:
          "{{name}} wears a loosely open robe at {{place}}, fabric slipping off one shoulder.",
      },
      {
        id: "ward-partial",
        label: "Partial nude",
        template:
          "Adult {{name}}, partial nudity at {{place}} — topless or underwear only, natural body, not a catalogue pose. Change the clothes from the face card. Same face, this body, not the outfit on the reference.",
      },
      {
        id: "ward-nude",
        label: "Nude",
        template:
          "Adult {{name}}, fully nude at {{place}}, natural proportions, unposed everyday body language. Change the clothes from the face card. Same face and body, not the outfit on the reference. No text or watermarks.",
      },
      {
        id: "ward-man-partial",
        label: "Man partial",
        template:
          "Adult man {{name}}, partial nudity at {{place}} — shirtless, underwear only or bare. Adult male chest. Change the clothes from the face card. Same face, this male body, not the tee. Do not redraw as a woman.",
      },
      {
        id: "ward-man-nude",
        label: "Man nude",
        template:
          "Adult man {{name}}, fully nude at {{place}}. Adult male body — bare chest, visible human penis and scrotum, two feet on the floor, no clothes. Not a Ken doll, not a mutation. Same face as the face card, not the tee. Do not redraw as a woman. One photograph. No text or watermarks.",
      },
      {
        id: "ward-wet",
        label: "Wet clothes",
        template:
          "{{name}} wears wet clinging clothes at {{place}}, fabric heavy with water, hair damp.",
      },
      {
        id: "ward-blanket",
        label: "Under a blanket",
        template:
          "{{name}} is under a blanket at {{place}}, shoulders and face out, cocooned, intimate and messy.",
      },
    ],
  },
  {
    id: "props",
    label: "Props",
    hint: "What they're holding or using",
    entries: [
      {
        id: "prop-phone",
        label: "Phone",
        template:
          "{{name}} holds a phone at {{place}}, screen toward them, thumbs ready, phone is the clear hero prop.",
      },
      {
        id: "prop-beer",
        label: "Beer",
        template:
          "{{name}} holds a beer can or bottle at {{place}}, label unreadable, drink is the clear hero prop.",
      },
      {
        id: "prop-smoke",
        label: "Cigarette",
        template:
          "{{name}} holds a cigarette or rollie at {{place}}, thin smoke optional, fingers natural.",
      },
      {
        id: "prop-mug",
        label: "Mug / cup",
        template:
          "{{name}} holds a mug or cup at {{place}}, both hands or one hand wrapped around it.",
      },
      {
        id: "prop-towel",
        label: "Towel in hands",
        template:
          "{{name}} holds or wrings a towel at {{place}}, fabric bunched, damp.",
      },
      {
        id: "prop-bag",
        label: "Bag / backpack",
        template:
          "{{name}} holds or wears a bag at {{place}}, strap or handles clear, everyday mess.",
      },
      {
        id: "prop-remote",
        label: "Remote / controller",
        template:
          "{{name}} holds a TV remote or game controller at {{place}}, pointed or idle in the lap.",
      },
      {
        id: "prop-nothing",
        label: "Empty hands",
        template:
          "{{name}} has empty hands at {{place}}, no new props, gesture only.",
      },
    ],
  },
  {
    id: "drama",
    label: "Drama & Intensity",
    hint: "Emotion + danger + horror",
    entries: [
      {
        id: "drama-breakdown",
        label: "Emotional breakdown",
        template:
          "Tight macro close-up of {{name}} at {{place}}. Subtle jaw trembling. Eyes watering with intense focus. Head shakes slightly in disbelief.",
      },
      {
        id: "drama-interrogation",
        label: "Interrogation",
        template:
          "Harsh top-down key light on {{name}} at {{place}}. Subject leans forward across a dark void. Shadow cuts across eyes. Minimalist dark environment.",
      },
      {
        id: "drama-confront",
        label: "Sudden confrontation",
        template:
          "Camera tracks backward rapidly. {{name}} steps forward abruptly at {{place}}. Eyes widen. Hand grasps at throat. Sharp focus shifts.",
      },
      {
        id: "drama-regret",
        label: "Quiet regret",
        template:
          "Profile silhouette of {{name}} at {{place}}. Stares out a rainy window. Droplets cast moving shadows across the cheek.",
      },
      {
        id: "drama-miss",
        label: "Near miss",
        template:
          "Extreme camera shake. {{name}} ducks violently to the left at {{place}}. Debris fragments fly past the lens. High motion blur.",
      },
      {
        id: "drama-escape",
        label: "Active escape",
        template:
          "Low-angle tracking shot. {{name}} sprints forward at {{place}}. Breath mist visible. Knees lifting high. Background blurs into streaks.",
      },
      {
        id: "drama-fall",
        label: "Sudden fall",
        template:
          "Vertical camera plunge. {{name}} slips backward into darkness at {{place}}. Hands reach upward toward the camera. Spatial depth distortion.",
      },
      {
        id: "drama-shock",
        label: "Shockwave",
        template:
          "Instantaneous screen jitter. {{name}} is thrown slightly off-balance at {{place}}. Dust particles swirl rapidly around the frame.",
      },
      {
        id: "drama-glitch",
        label: "Uncanny glitch",
        template:
          "Static medium shot of {{name}} at {{place}}. Subject stands frozen. Head snaps 45 degrees instantly. Eyes wide and unblinking. Strobe lighting.",
      },
      {
        id: "drama-shadow",
        label: "Shadow creep",
        template:
          "Dim monochromatic lighting at {{place}}. High-contrast silhouettes. A dark shape expands on the wall behind oblivious {{name}}.",
      },
      {
        id: "drama-reveal",
        label: "Abrupt reveal",
        template:
          "Pitch black frame. Sudden flashlight beam illuminates {{name}}'s pale face inches from the lens at {{place}}. Jaw open wide.",
      },
      {
        id: "drama-corrupt",
        label: "Corrupted frame",
        template:
          "Atmospheric visual noise at {{place}}. {{name}} moves with jagged, missing-frame stutter. Limbs appear unnaturally elongated in shadow.",
      },
    ],
  },
  {
    id: "atmosphere",
    label: "Atmosphere & Vision",
    hint: "Mood light first, then FX",
    entries: [
      {
        id: "atm-lighten",
        label: "Lighten",
        template:
          "Lifted exposure on {{name}} at {{place}}. Soft fill opens the shadows; face and room stay readable, no harsh contrast.",
      },
      {
        id: "atm-bright",
        label: "Bright",
        template:
          "Bright high-key light on {{name}} at {{place}}. Clean whites, open midtones, cheerful clarity without blowing out the face.",
      },
      {
        id: "atm-sunny",
        label: "Sunny",
        template:
          "Hard sunny daylight on {{name}} at {{place}}. Warm sun from a clear sky, crisp shadows on the ground, summer heat in the air.",
      },
      {
        id: "atm-sunset",
        label: "Sunset",
        template:
          "Warm sunset grade on {{name}} at {{place}}. Low orange sun, long soft shadows, golden rim light on hair and shoulders.",
      },
      {
        id: "atm-sunrise",
        label: "Sunrise",
        template:
          "Cool-to-warm sunrise light on {{name}} at {{place}}. Soft pink and pale gold wash, gentle shadows, early-morning quiet.",
      },
      {
        id: "atm-twilight",
        label: "Twilight",
        template:
          "Blue-hour twilight on {{name}} at {{place}}. Deep azure sky, soft purple shadows, faces lit by residual dusk and window glow.",
      },
      {
        id: "atm-eerie",
        label: "Eerie",
        template:
          "Eerie unsettled light on {{name}} at {{place}}. Sickly cool key, wrong-direction shadows, quiet dread without jump-scare FX.",
      },
      {
        id: "atm-gloomy",
        label: "Gloomy",
        template:
          "Gloomy overcast light on {{name}} at {{place}}. Flat grey skylight, muted colours, heavy mood, no hard sun.",
      },
      {
        id: "atm-radiant",
        label: "Radiant",
        template:
          "Radiant bloom around {{name}} at {{place}}. Soft luminous wrap, gentle halo on edges, warm hopeful glow without losing face detail.",
      },
      {
        id: "atm-golden",
        label: "Golden hour",
        template:
          "Golden-hour wrap on {{name}} at {{place}}. Honey side-light, long warm shadows, skin and fabric catch amber highlights.",
      },
      {
        id: "atm-moon",
        label: "Moonlight",
        template:
          "Cool moonlight on {{name}} at {{place}}. Soft silver key from above, deep blue shadows, night quiet without neon.",
      },
      {
        id: "atm-overcast",
        label: "Overcast",
        template:
          "Soft overcast daylight on {{name}} at {{place}}. Even sky fill, almost no hard shadow, muted honest colour.",
      },
      {
        id: "atm-candle",
        label: "Candlelit",
        template:
          "Candlelit warmth on {{name}} at {{place}}. Small flickering key near the face, falloff into dark corners, intimate room light.",
      },
      {
        id: "atm-storm",
        label: "Storm light",
        template:
          "Storm light on {{name}} at {{place}}. Cold green-grey sky, sudden bright flashes, wet air and restless contrast.",
      },
      {
        id: "atm-glow",
        label: "Volumetric glow",
        template:
          "Centred symmetrical framing of {{name}} at {{place}}. Golden light rays burst from behind the subject. Floating dust motes in the beams.",
      },
      {
        id: "atm-awaken",
        label: "Awakening",
        template:
          "Slo-motion upward camera tilt on {{name}} at {{place}}. Looks skyward. Irises shift color subtly. Micro-particles float upward against gravity.",
      },
      {
        id: "atm-aura",
        label: "Aura shift",
        template:
          "Ethereal soft-focus render of {{name}} at {{place}}. Subtle prismatic light leaks ripple across the face. Shimmering bokeh background.",
      },
      {
        id: "atm-float",
        label: "Floating calm",
        template:
          "Weightless environment at {{place}}. {{name}} hovers millimeters off the ground. Hair and loose fabric float gently upward.",
      },
      {
        id: "atm-mirror",
        label: "Liquid mirror",
        template:
          "Ground ripples like water with every footstep at {{place}}. {{name}} walks on a reflective cloud layer. Twin horizons.",
      },
      {
        id: "atm-kaleido",
        label: "Kaleidoscope",
        template:
          "Geometric background shapes shift and rotate slowly at {{place}}. Gravity appears inverted for props. {{name}} remains stable.",
      },
      {
        id: "atm-echo",
        label: "Echoing silhouette",
        template:
          "{{name}} walks forward at {{place}}, leaving fading transparent trails of previous movements in sequence.",
      },
      {
        id: "atm-scale",
        label: "Shifting scale",
        template:
          "Macro details of everyday objects appear massive behind {{name}} at {{place}}. Giant floating keys and ticking clocks. Deep focus.",
      },
      {
        id: "atm-neon",
        label: "Neon rain deck",
        template:
          "High-contrast cyber styling. {{name}} stands under a flickering neon sign at {{place}}. Rain bounces off shoulders. Deep blacks.",
      },
      {
        id: "atm-smog",
        label: "Industrial smog",
        template:
          "Thick volumetric green haze at {{place}}. Looming pipes and brutalist concrete. {{name}} in sleek hazard activewear.",
      },
      {
        id: "atm-wall",
        label: "Monolithic watcher",
        template:
          "Extreme low angle. {{name}} looks up at a massive wall of screens flashing synchronized static at {{place}}.",
      },
      {
        id: "atm-grime",
        label: "Tech grime",
        template:
          "Harsh fluorescent side-lighting on {{name}} at {{place}}. Subtle metallic mesh plating on skin. Dust and rust flakes in the air.",
      },
      {
        id: "atm-normal",
        label: "Normal",
        template:
          "Clean base look of {{name}} at {{place}}. Natural light, no stylised FX, no surreal overlays — just the room and the person.",
      },
    ],
  },
  {
    id: "crowd",
    label: "Crowd / multi",
    hint: "Two or more faces on the pad",
    entries: [],
  },
];

function stripCampaignLabel(label: string): string {
  return label.replace(/^\d+\s+/, "");
}

function mergeDropdownPresets(sections: ScratchBibleSection[]): ScratchBibleSection[] {
  const labels = new Map(plateLtxCampaignScenarios().map((s) => [s.id, stripCampaignLabel(s.label)]));
  return sections.map((section) => {
    const presetIds = DROPDOWN_BY_SECTION[section.id] || [];
    if (!presetIds.length) return section;
    const seen = new Set(section.entries.map((e) => e.id));
    const appended: ScratchBibleEntry[] = [];
    for (const id of presetIds) {
      if (seen.has(id)) continue;
      const wearing = DROPDOWN_WEARING[id];
      const crowd = DROPDOWN_CROWD[id];
      if (wearing) {
        appended.push({ id, label: wearing.label, template: wearing.template });
        continue;
      }
      if (crowd) {
        appended.push({ id, label: crowd.label, template: crowd.template });
        continue;
      }
      try {
        appended.push({
          id,
          label: labels.get(id) || id,
          template: campaignStagingForId(id, "{{name}}", "{{place}}"),
        });
      } catch {
        /* unknown campaign id */
      }
    }
    return appended.length ? { ...section, entries: [...section.entries, ...appended] } : section;
  });
}

export const SCRATCH_PROMPT_BIBLE = mergeDropdownPresets(BASE_SCRATCH_PROMPT_BIBLE);

export function applyBibleTokens(
  template: string,
  opts: { name: string; place: string; cast?: string[] },
): string {
  const name = opts.name.trim() || "Character";
  const place = opts.place.trim() || "this place";
  const cast = (opts.cast?.length ? opts.cast : [name]).join(", ");
  return template
    .replaceAll("{{name}}", name)
    .replaceAll("{{place}}", place)
    .replaceAll("{{cast}}", cast);
}

/** Build the rapid multi-genre 4-block layout. */
export function composeBibleBlocks(parts: {
  camera?: string;
  subject?: string;
  action?: string;
  style?: string;
}): string {
  const lines: string[] = [];
  if (parts.camera?.trim()) lines.push(parts.camera.trim());
  if (parts.subject?.trim()) lines.push(`[Subject] ${parts.subject.trim()}`);
  if (parts.action?.trim()) lines.push(`[Action] ${parts.action.trim()}`);
  if (parts.style?.trim()) lines.push(`[Style] ${parts.style.trim()}`);
  return lines.join("\n\n");
}

export const SCRATCH_BIBLE_DEFAULT_STYLE =
  "Stylized cinematic composition, sharp focus, consistent character identity with the face card.";
