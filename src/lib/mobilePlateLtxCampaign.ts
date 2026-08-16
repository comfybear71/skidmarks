import { motionStyleLock, onlyTheseInFrame } from "./mobileImageMotion";
import type { ShowStyleId } from "./showStylePresets";

/**
 * 20 plate + LTX pairs for one locked character at one locked place.
 * Speech is supplied at run time. Position and Image motion stay in harmony:
 * whatever the still is holding / wearing / doing, LTX names that and holds
 * frame 1. No leftover CAST. No random extra people.
 */

export const PLATE_LTX_CAMPAIGN_COUNT = 20;

export type PlateLtxCampaignPhase =
  | "plating"
  | "voicing"
  | "animating"
  | "done"
  | "error";

export type PlateLtxCampaign = {
  speaker: string;
  sceneId: string;
  sceneName: string;
  shotIds: string[];
  beatIds: string[];
  lines: string[];
  voicedFailed?: string[];
  phase: PlateLtxCampaignPhase;
  error?: string;
};

type Scenario = {
  id: string;
  label: string;
  /** Still compositor Position — pose, crop, clothes, props. */
  staging: (name: string, place: string) => string;
  /** LTX action clause that must match the still (no look-lock morph). */
  action: (name: string) => string;
};

function alone(name: string, place: string, body: string): string {
  return [
    `${name} alone at ${place}. Only ${name} in frame, no one else appears.`,
    body,
    `Do not keep the standing portrait pose from the face card unless this is a standing test.`,
    `Same face as the face card. Do not invent a second person, passer-by, or extra body.`,
  ].join(" ");
}

const SCENARIOS: Scenario[] = [
  {
    id: "mcu-phone",
    label: "01 Closer MCU + phone",
    staging: (n, p) =>
      alone(
        n,
        p,
        `MEDIUM CLOSE-UP, head and shoulders fill the frame, crop the waist and legs, ${n} is huge and near the camera. Sitting, mobile phone right under the chin, both thumbs on the glass, staring at the screen like a crazed maniac. Not a distant full-body. Not a wide of the place.`,
      ),
    action: () =>
      "holding a mobile phone close to the face, texting, staring at the screen like a crazed maniac",
  },
  {
    id: "wide-full",
    label: "02 Wide full-body",
    staging: (n, p) =>
      alone(
        n,
        p,
        `WIDE full-body, head to toe, lots of ${p} around them, smaller in frame. Standing in the place, mobile phone in both hands, staring at the screen like a crazed maniac. Show the building and the ground.`,
      ),
    action: () =>
      "standing full-body, holding a mobile phone, texting, staring at the screen like a crazed maniac",
  },
  {
    id: "sitting",
    label: "03 Sitting",
    staging: (n, p) =>
      alone(
        n,
        p,
        `MEDIUM SHOT. Sitting on the furniture or steps of ${p}, knees bent, planted. Mobile phone in both hands in the lap, head down, staring like a crazed maniac. Use the place as a seat, not a backdrop.`,
      ),
    action: () =>
      "sitting, holding a mobile phone in the lap, texting, staring at the screen like a crazed maniac",
  },
  {
    id: "standing",
    label: "04 Standing",
    staging: (n, p) =>
      alone(
        n,
        p,
        `MEDIUM SHOT, full upper body. Standing upright at ${p}, weight on both feet, facing camera. Mobile phone held at chest height, staring like a crazed maniac.`,
      ),
    action: () =>
      "standing, holding a mobile phone at chest height, texting, staring at the screen like a crazed maniac",
  },
  {
    id: "running",
    label: "05 Running freeze",
    staging: (n, p) =>
      alone(
        n,
        p,
        `WIDE full-body. Mid-stride running toward camera at ${p}, one foot off the ground, frozen, mobile phone still in one hand. Do not keep a standing portrait pose.`,
      ),
    action: () =>
      "frozen mid-stride running pose, mobile phone in one hand, mouth and body hold the run",
  },
  {
    id: "raining",
    label: "06 Raining",
    staging: (n, p) =>
      alone(
        n,
        p,
        `MEDIUM SHOT. Standing in heavy rain at ${p}, hair and clothes soaked, water dripping, mobile phone held close to the chest, staring like a crazed maniac. Wet weather in the still.`,
      ),
    action: () =>
      "standing in the rain, soaked clothes, holding a mobile phone close, staring at the screen like a crazed maniac",
  },
  {
    id: "clothes-dress",
    label: "07 Clothes change — dress",
    staging: (n, p) =>
      alone(
        n,
        p,
        `MEDIUM SHOT. Standing at ${p} in a tiny black dress and heels. Change the clothes from the face card. Same face, this outfit. Mobile phone in one hand, staring like a crazed maniac.`,
      ),
    action: () =>
      "wearing a tiny black dress, holding a mobile phone, staring at the screen like a crazed maniac",
  },
  {
    id: "clothes-underwear",
    label: "08 Clothes change — underwear",
    staging: (n, p) =>
      alone(
        n,
        p,
        `MEDIUM SHOT. Sitting at ${p} in underwear, bare legs. Change the clothes from the face card. Same face, this outfit. Mobile phone in both hands, staring like a crazed maniac.`,
      ),
    action: () =>
      "sitting in underwear, holding a mobile phone, staring at the screen like a crazed maniac",
  },
  {
    id: "beer-cig",
    label: "09 Beer + cigarette",
    staging: (n, p) =>
      alone(
        n,
        p,
        `MEDIUM SHOT. Sitting at ${p}, stubbie of beer in the left hand, lit cigarette in the right, smoke curling. Same face, these props in the hands. Not a clean empty-handed portrait.`,
      ),
    action: () =>
      "stubbie of beer in one hand, lit cigarette in the other, smoke curling",
  },
  {
    id: "wash-hair",
    label: "10 Washing hair",
    staging: (n, p) =>
      alone(
        n,
        p,
        `MEDIUM SHOT. Bent over a bucket of water at ${p}, washing hair, suds running. Mobile phone propped where it can still be seen, staring like a crazed maniac. Do not keep the standing portrait pose.`,
      ),
    action: () =>
      "bent over washing hair, suds, mobile phone nearby, staring at the screen like a crazed maniac",
  },
  {
    id: "handstand",
    label: "11 Handstand",
    staging: (n, p) =>
      alone(
        n,
        p,
        `WIDE full-body. Handstand on the ground at ${p}, legs up, mobile phone still in one hand, hair hanging, staring at the screen like a crazed maniac. Do not keep the standing portrait pose.`,
      ),
    action: () =>
      "holding a handstand, mobile phone in one hand, staring at the screen like a crazed maniac",
  },
  {
    id: "sprawl",
    label: "12 Sprawled",
    staging: (n, p) =>
      alone(
        n,
        p,
        `WIDE full-body. Lying sprawled across the steps or ground at ${p}, one leg up, mobile phone held above the face, staring like a crazed maniac. Use the place as furniture.`,
      ),
    action: () =>
      "lying sprawled, holding a mobile phone above the face, staring at the screen like a crazed maniac",
  },
  {
    id: "dance",
    label: "13 Dance freeze",
    staging: (n, p) =>
      alone(
        n,
        p,
        `WIDE full-body. Mid-dance freeze at ${p}, one arm up, hips cocked, weight on one foot, mobile phone in the other hand, staring like a crazed maniac. Frozen pose, not a blur.`,
      ),
    action: () =>
      "frozen mid-dance pose, one arm up, mobile phone in the other hand, staring at the screen like a crazed maniac",
  },
  {
    id: "tight-face",
    label: "14 Tight close-up",
    staging: (n, p) =>
      alone(
        n,
        p,
        `TIGHT CLOSE-UP, face fills the frame, shoulders barely visible, huge and near the camera at ${p}. Mobile phone just under the chin. Same face. Do not pull back. Do not invent a second person.`,
      ),
    action: () =>
      "tight on the face, mobile phone under the chin, mouth and head move naturally while speaking",
  },
  {
    id: "leaning",
    label: "15 Leaning on the wall",
    staging: (n, p) =>
      alone(
        n,
        p,
        `MEDIUM SHOT. Leaning a shoulder into the wall or donga of ${p}, one foot up, mobile phone up, staring like a crazed maniac. Three-quarter body. Not dead-centre floating.`,
      ),
    action: () =>
      "leaning on the wall, holding a mobile phone, staring at the screen like a crazed maniac",
  },
  {
    id: "steps",
    label: "16 On the steps",
    staging: (n, p) =>
      alone(
        n,
        p,
        `MEDIUM CLOSE-UP. Sitting on the steps of ${p}, body filling the frame, near the camera. Mobile phone in both hands, staring like a crazed maniac. Not tiny on distant steps. Not a second person on the stairs.`,
      ),
    action: () =>
      "sitting on the steps, holding a mobile phone, staring at the screen like a crazed maniac",
  },
  {
    id: "over-shoulder",
    label: "17 Over the shoulder",
    staging: (n, p) =>
      alone(
        n,
        p,
        `MEDIUM SHOT. Three-quarter back at ${p}, looking back over the shoulder at the camera, mobile phone held up, untrustworthy smile. Same face. Only ${n}.`,
      ),
    action: () =>
      "looking back over the shoulder, holding a mobile phone, staring at the screen like a crazed maniac",
  },
  {
    id: "crouch",
    label: "18 Crouching",
    staging: (n, p) =>
      alone(
        n,
        p,
        `MEDIUM SHOT. Crouching low at ${p}, elbows on knees, mobile phone in both hands, staring like a crazed maniac. Do not keep a standing portrait pose.`,
      ),
    action: () =>
      "crouching, holding a mobile phone, staring at the screen like a crazed maniac",
  },
  {
    id: "pie",
    label: "19 Object — meat pie",
    staging: (n, p) =>
      alone(
        n,
        p,
        `MEDIUM SHOT. Standing at ${p} holding a meat pie in both hands, about to bite, staring like a crazed maniac. Held prop is the pie, not a phone. Same face.`,
      ),
    action: () => "holding a meat pie in both hands, about to bite",
  },
  {
    id: "walk-in",
    label: "20 Walk toward camera",
    staging: (n, p) =>
      alone(
        n,
        p,
        `MEDIUM CLOSE-UP. Walking toward camera at ${p}, filling the frame, huge and near, one foot forward, mobile phone in one hand. Closer to the camera. Do not leave them tiny in the distance. Do not invent a second person.`,
      ),
    action: () =>
      "walking toward camera, filling the frame, mobile phone in one hand, staring at the screen like a crazed maniac",
  },
];

if (SCENARIOS.length !== PLATE_LTX_CAMPAIGN_COUNT) {
  throw new Error(`Need ${PLATE_LTX_CAMPAIGN_COUNT} plate/LTX campaigns`);
}

export function plateLtxCampaignScenarios(): { id: string; label: string }[] {
  return SCENARIOS.map((s) => ({ id: s.id, label: s.label }));
}

export function campaignStaging(index: number, name: string, place: string): string {
  const row = SCENARIOS[index];
  if (!row) throw new Error(`No campaign ${index}`);
  return row.staging(name.trim(), place.trim() || "this place");
}

export function campaignShotTitle(index: number): string {
  const row = SCENARIOS[index];
  if (!row) throw new Error(`No campaign ${index}`);
  return row.label;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** LTX body for this test — start image is the person. No CAST look morph. */
export function campaignImageMotion(opts: {
  index: number;
  styleId: ShowStyleId;
  speaker: string;
  line: string;
}): string {
  const row = SCENARIOS[opts.index];
  if (!row) throw new Error(`No campaign ${opts.index}`);
  const name = clean(opts.speaker) || "The character";
  const line = clean(opts.line);
  const action = row.action(name);
  return clean(
    [
      "Use the provided start image as the first frame.",
      `${name} is prominent, ${action}, mouth and head move naturally while speaking.`,
      onlyTheseInFrame([name]),
      "Props and background stay exactly as the start image, nothing new enters frame.",
      `${name} says: "${line}".`,
      "Camera holds. Same person and objects as the start image.",
      "No new people enter the frame.",
      motionStyleLock(opts.styleId),
    ].join(" "),
  );
}

/** 20 spoken lines — blank-line blocks, or one line each. Strips 1. numbering. */
export function parseCampaignLines(raw: string): string[] {
  const strip = (s: string) => s.replace(/^\s*\d+[.)]\s*/, "").trim();
  const blocks = raw
    .split(/\n\s*\n/)
    .map(strip)
    .filter(Boolean);
  if (blocks.length === PLATE_LTX_CAMPAIGN_COUNT) return blocks;
  return raw.split(/\n/).map(strip).filter(Boolean);
}
