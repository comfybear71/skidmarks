import { motionStyleLock, onlyTheseInFrame } from "./mobileImageMotion";
import type { ShowStyleId } from "./showStylePresets";

/**
 * Thorough plate + LTX test: 20 positions, each with SHORT and LONG speech.
 * Same still, two mp3s, two Image motion bodies (same pose, different NAME says).
 * MCU + wide longs are the duration PUSH (full Jummie letter, not split).
 * One locked character, one locked place. Not leftover CAST.
 *
 * Each clip is a numbered test (T01…) with a 1–5 score + comment so we
 * know plating, distance, artifacts, and hallucination before this is
 * a product.
 */

export const PLACEMENT_COUNT = 20;
export const PLATE_LTX_CAMPAIGN_COUNT = PLACEMENT_COUNT;
export const SPEECH_BANDS = ["short", "long", "push"] as const;
export const CAMPAIGN_CLIP_COUNT = PLACEMENT_COUNT * 2;
/** MCU (0) and wide (1) get the marathon letter as their long take. */
export const PUSH_PLACEMENT_INDEXES = [0, 1] as const;

export type PlateLtxCampaignPhase =
  | "plating"
  | "voicing"
  | "animating"
  | "done"
  | "error";

export type CampaignTestBand = (typeof SPEECH_BANDS)[number];

export type CampaignTestScore = {
  score: number;
  comment: string;
  at: string;
};

export type CampaignTest = {
  id: string;
  beatId: string;
  shotId: string;
  poseIndex: number;
  poseId: string;
  poseLabel: string;
  band: CampaignTestBand;
  line: string;
};

export type PlateLtxCampaign = {
  speaker: string;
  sceneId: string;
  sceneName: string;
  shotIds: string[];
  beatIds: string[];
  lines: string[];
  tests?: CampaignTest[];
  scores?: Record<string, CampaignTestScore>;
  voicedFailed?: string[];
  phase: PlateLtxCampaignPhase;
  error?: string;
};

export function padCampaignTestId(n: number): string {
  return `T${String(n).padStart(2, "0")}`;
}

export function campaignShotIndexForBeat(beatIndex: number): number {
  return Math.floor(beatIndex / 2);
}

export function campaignShotIdForBeat(
  campaign: Pick<PlateLtxCampaign, "shotIds" | "beatIds" | "tests">,
  beatIndex: number,
): string {
  const beatId = campaign.beatIds[beatIndex];
  const fromTest = campaign.tests?.find((t) => t.beatId === beatId)?.shotId;
  if (fromTest) return fromTest;
  return campaign.shotIds[campaignShotIndexForBeat(beatIndex)] || "";
}

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

export function campaignPoseId(index: number): string {
  const row = SCENARIOS[index];
  if (!row) throw new Error(`No campaign ${index}`);
  return row.id;
}

/** Beat 0 = pose 0 short, 1 = pose 0 long, 2 = pose 1 short… */
export function campaignBeatTitle(beatIndex: number, band?: CampaignTestBand): string {
  const placement = campaignShotIndexForBeat(beatIndex);
  const resolved = band || (beatIndex % 2 === 0 ? "short" : "long");
  return `${padCampaignTestId(beatIndex + 1)} · ${campaignShotTitle(placement)} · ${resolved}`;
}

export function buildCampaignTests(opts: {
  shotIds: string[];
  beatIds: string[];
  lines: string[];
  bands: CampaignTestBand[];
}): CampaignTest[] {
  return opts.beatIds.map((beatId, i) => {
    const poseIndex = campaignShotIndexForBeat(i);
    return {
      id: padCampaignTestId(i + 1),
      beatId,
      shotId: opts.shotIds[poseIndex] || "",
      poseIndex,
      poseId: campaignPoseId(poseIndex),
      poseLabel: campaignShotTitle(poseIndex),
      band: opts.bands[i] || (i % 2 === 0 ? "short" : "long"),
      line: opts.lines[i] || "",
    };
  });
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

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Jo texts Stuie sent — split into 26+ spoken takes, short through long.
 * The full Hi Jummie letter stays whole as CAMPAIGN_PUSH_SPEECH.
 */
export const CAMPAIGN_SPEECH: string[] = [
  oneLine(
    "Would you please also sus the gate out when you leave. It's not working properly hun. It only opens a little, then it jams. Thanks heaps.",
  ),
  oneLine(
    "She has a key to everyone's private space. Jason put a lock on my and his door, but the rest of the house and Laddiwan and Josh's space is open to those people. Unacceptable",
  ),
  oneLine(
    "Now they both back in the bedroom for the night. Can you please ask her to move out. Thank you Jummie.",
  ),
  oneLine(
    "Thank you. The machine isn't getting enough water. Not washing properly and won't spin.",
  ),
  oneLine(
    "I got book of Jummie today. It's giving error E11. It just won't complete the wash. IDK if it's a water pressure issue cuz we up so high?",
  ),
  oneLine(
    "I've just had the boyfriend harassing me in my own home. Fucken do something about it or I will. I'm over this shit.",
  ),
  oneLine(
    "You need a kick up the arse. Get the junkies out or I'll call the police and send them straight to you. Get em out or things are going to get real here.",
  ),
  oneLine(
    "He tried talking to me in the kitchen and told me I was a piece of work. No one gives a fuck and they're both laughing behind my back.",
  ),
  oneLine(
    "We know where your loyalty lays Stuie. Don't expect any more from me. My safety and well being is compromised and means fuck all to you and Jummie.",
  ),
  oneLine("Shed rent out the room to a fucken rat if it paid rent!"),
  oneLine(
    "Not that you care but boyfriend sleeping over again for 3 night. They've had more drugs and they're up and down and up and down banging doors and in and out the front door and I can't sleep.",
  ),
  oneLine(
    "Just as well Jason sleeps through a bomb. Congratulations, your wife now owns the junkie drug house in the street. Even the neighbours have picked up on it. They can pay my rent. I'm out as soon as humanly possible.",
  ),
  oneLine(
    "I sent to Jummie also. I can't do it anymore hun. I know you guys don't want to hear it. Trust me I know. I have to live with it. It's best coming from the Landlord.",
  ),
  oneLine(
    "That girl just tied that poor little fella up out the front driveway, in the sun, no food, water or shade. I went down to speak to her and she'd just fucked off and left him there. That was almost 2 hours ago. Anywho, thanks. Xoxo",
  ),
  oneLine(
    "FYI if you are still owed rent money. He owes us $50 for power but we'll never see that.",
  ),
  oneLine(
    "Please be careful who you rent out to next. Please make sure they are working and have provided proof of income as well as references from previous landlords. This guy hasn't worked in months. Probably a few years.",
  ),
  oneLine(
    "It's us that have to live with whomever you rent out to next. It would be appreciated if you would thoroughly screen any new tenants.",
  ),
  oneLine(
    "The power and internet is in my name and I don't want to have to chase people for money and alit isn't fair on the other 2 tenants either, who always pay their utilities and rent in advance. Thank you. Xx",
  ),
  oneLine(
    "I apologise for blocking you on FB. I got pissed with your Bro for being a Dick. I've sent you another FB request.",
  ),
  oneLine(
    "I've also apologised to everyone here and suggested we have a fresh start and be more respectful and understanding of each other other, starting with me. We're all guilty of gossiping and backstabbing each other tho and I just want it to stop. I've told them all that. I hate living in a negative environment. We're all adults here and we should all be more mindful of each other.",
  ),
  oneLine(
    "I also apologise for hitting you up for a point. I honestly just thought it would be the only way to spend some QT with ya before you left for Bali and I fully intended to pay you back on Thursday. I so glad you didn't because I need to keep paying off my removal costs which is killing me.",
  ),
  oneLine(
    "Anyway. Love you heaps and I hope you're having a well earned relaxing time in Bali. Xoxo",
  ),
  oneLine(
    "It's 7 am and I've just been abused by your new tenants and told to fuck off and who've just told me the boyfriend has moved as well in and is paying rent.",
  ),
  oneLine(
    "You have caused me so much stress and anxiety since I've moved in here and now put my health and safety at risk by moving drug addicted and mentally ill tenants in here.",
  ),
  oneLine(
    "You've done nothing and you have ignored all my messages and calls and allowed these people to live here, putting my health and safety at risk. I'll be moving out as soon as I can. That will make you happy.",
  ),
  oneLine(
    "No more cats hey Jummie. Just drug addicts and mentally ill, unemployed drop kicks. You'll have to buy kitchen shit for your drug addict tenants because I've packed all mine up.",
  ),
  oneLine(
    "I'll be calling today to see what my rights are when landlord rents to drug addicts and I'll be calling the police to let them know what is going on and I'll give them your information as the owner and landlord.",
  ),
  oneLine(
    "I thought I was a very good friend to both of you but obviously you only want drug addicts in your house and not someone who treats your house like their own.",
  ),
  oneLine(
    "I've told T to move out Stuie. I've let Jummie know. Boyfriend here again in the room sleeping over. They're needle users and I know that sounds hypocritical because of my past, but I've left that behind and I don't need that in my face everyday and be surrounded by those people. You REALLy need to be careful who you put in your house. I have to live with this shit and it's not fair Stuie. She's on antipsychotic meds, banging up crack and she's on the dole/disability. Not acceptable.",
  ),
];

if (CAMPAIGN_SPEECH.length < 26) {
  throw new Error(`Need 26+ campaign speeches, got ${CAMPAIGN_SPEECH.length}`);
}

/** Full Hi Jummie letter — duration push. Do not split. MCU + wide longs only. */
export const CAMPAIGN_PUSH_SPEECH = oneLine(
  `Howdy. Stuie I've sent Jummie a very lengthy text following our screaming match yesterday. I am only sending it to you FYI and to help her understand, if you would please? It is important to put things in writing to cover both sides. Hi Jummie. I have washed the lounge room entry door curtain and both single curtains. Have also cleaned the windows and doors. I will do the back and other front door curtains and doors tomorrow. There are holes in the louvred fly screens. These have been here since we moved in and have got worse over the past few months due to the trees hitting the louvres and the trees being cut down for the donga. The screens throughout the entire house are old and perished and very fragile. You can practically flick it out it's that thin and old. The lounge room, bathroom, toilet, kitchen, dining and verandas are common areas, shared by all upstairs tenants and we are all responsible for cleaning these areas, including fans, aircon, floors, walls, cupboards, doors and windows. Regardless of who works and who doesn't, or who spends more time in the house. Just because I have cats does not mean I am solely responsible for these areas and surfaces. The cat hair just gets vacuumed off, which I do regularly. It's that simple. The curtains are cleaned on an annual basis or when needed. Jummie, if you wanted me to clean the curtains in the end room, all you had to do was ask. I apologize I forgot to vacuum the cat hair off them. It's just hair Jummie and some of it would've been mine. The cats are extremely clean animals. They are indoor cats, so they have no parasites or dirts. They've been vaccinated and are regularly worked. They also eat all the roaches and flies and other bugs so that keeps the house bug free. Jummie, I don't appreciate you coming over here every day poking your nose in and ordering me around. I'm a 57 year old woman, not a child. I am also your tenant who pays rent and has rights. I am fully aware of my responsibilities. Just because something is dirty, doesn't mean I'm ignoring it. I just haven't got around to it. I have cleaned that end room many, many times, including when you let Chris move downstairs without checking the room and making him clean it. I cleaned that room for you and I told you about that face to face. I told you he left food wrappers and leftover food and shit all over the floor and in the cupboards. He didn't clean the fan or the aircon either. I did that. I also washed the black sheets you gave him for his bed. He ripped the fitted sheet to fit his big arse bed. I did not rip it. I haven't used them. I just cleaned them for you. Jummie, I love you to bits, but you need to back off. You are too full on and in my face and you're causing me stress and anxiety being here almost every day. It's been like that since I moved in and it's caused me heart problems. You just cannot keep doing that. You are required to advise tenants in writing, 24 hours in advance before you come to the house and you need to tell us what you are coming to the house to do. Not just text when you're on your way. Yesterday you didn't even message. You just turned up unannounced and started letting yourself in, again and started ordering me around and screaming at me. That's why I screamed at you and told you to fuck off. Every time you come to the house without giving the required 24 hours notice, you are breaching tenancy laws. Just because there is not written agreement, doesn't mean the law doesn't apply. You cannot just come over and let yourself inside, without giving the required notice. I love living here, but I'm sick and tired of being harassed, bullied, screamed at and ordered around. I show you respect by paying my rent on time, keeping the house clean and tidy and letting you know what's going on here. I'm entitled to the same level of respect. I am not moving out. I have nowhere to go and I simply cannot afford my own place yet. My furniture will be here at the end of July, so we will have a lounge and I'll put my TV in the lounge as well. I also have a big rug for the lounge. I have bought 2 sets of seat covers for the dining room chairs. I have had them out away to ensure the cats don't damage them. The covers will be here next week sometime. May I ask that you focus on cleaning up after yourself and the boys after putting in the donga and all the other works and changing the air cons downstairs. I have cleaned up after you guys downstairs many times downstairs, putting your rubbish, beer bottles and empty cigarette packets in the bin and moving all the drill bits and grinder and sharp leftover tin and your seats. I cleaned up after you again today. Leaving all that shit lying around is dangerous and someone could get hurt. There is a young child living here now, so you really need to be careful what you leave laying around. It also looks disgusting. The house is full of dust and dirt from the dirt and concrete that you've dug up and left out the front. Dust is everywhere here. I'm sure next door is copping it as well. I will be cleaning my room curtains and louvres as well and I'll buy new curtain clips as well. The existing ones are old and dirty and bent. That's all I have to say. Please respect my privacy and show some respect. I live here. This is my home as well, and I treat it like is my own.`,
);

export const DEFAULT_CAMPAIGN_LINE = CAMPAIGN_SPEECH[0] || "";

export function campaignSpeechScript(): string {
  return [...CAMPAIGN_SPEECH, CAMPAIGN_PUSH_SPEECH].join("\n\n");
}

/** Speech blocks — blank line between texts. One text may be many sentences.
 * The Jummie letter may arrive with inner paragraph breaks — glue it back. */
export function parseCampaignLines(raw: string): string[] {
  const strip = (s: string) => s.replace(/^\s*\d+[.)]\s*/, "").trim();
  const bits = raw
    .split(/\n\s*\n/)
    .map(strip)
    .filter(Boolean);
  return coalescePushSpeech(bits);
}

function coalescePushSpeech(bits: string[]): string[] {
  if (bits.some(isPushSpeech)) return bits;
  const start = bits.findIndex(
    (s) => /hi jummie/i.test(s) || /^howdy\b/i.test(s),
  );
  if (start < 0) return bits;
  for (let end = bits.length; end > start; end--) {
    const joined = bits.slice(start, end).join(" ");
    if (isPushSpeech(joined)) {
      return [...bits.slice(0, start), oneLine(joined), ...bits.slice(end)];
    }
  }
  return bits;
}

export function isPushSpeech(text: string): boolean {
  const t = oneLine(text);
  return t.length >= 1500 && /hi jummie/i.test(t);
}

export function peelPushSpeech(speech: string[]): { pool: string[]; push: string } {
  const mapped = speech.map(oneLine).filter(Boolean);
  const push = mapped.find(isPushSpeech) || "";
  const pool = mapped.filter((s) => !isPushSpeech(s));
  return { pool, push };
}

/** Short half and long half of the corpus, by character length. */
export function splitSpeechBands(speech: string[]): { short: string[]; long: string[] } {
  const sorted = [...speech].map(oneLine).filter(Boolean).sort((a, b) => a.length - b.length);
  const pool = sorted.length ? sorted : [...CAMPAIGN_SPEECH].sort((a, b) => a.length - b.length);
  if (pool.length === 1) return { short: pool, long: pool };
  const mid = Math.max(1, Math.floor(pool.length / 2));
  const short = pool.slice(0, mid);
  const long = pool.slice(mid);
  return { short, long: long.length ? long : short };
}

export type CampaignLinePlan = {
  lines: string[];
  bands: CampaignTestBand[];
};

/**
 * 40 lines: for each of 20 poses, short then long.
 * MCU + wide longs use the unsplit Jummie letter when it is in the paste.
 */
export function pairSpeechToPlacements(speech: string[]): CampaignLinePlan {
  const peeled = peelPushSpeech(speech);
  const pool = peeled.pool.length ? peeled.pool : [...CAMPAIGN_SPEECH];
  const { short, long } = splitSpeechBands(pool);
  const lines: string[] = [];
  const bands: CampaignTestBand[] = [];
  for (let i = 0; i < PLACEMENT_COUNT; i++) {
    lines.push(short[i % short.length]!);
    bands.push("short");
    const usePush =
      Boolean(peeled.push) &&
      (PUSH_PLACEMENT_INDEXES as readonly number[]).includes(i);
    if (usePush) {
      lines.push(peeled.push);
      bands.push("push");
    } else {
      lines.push(long[i % long.length]!);
      bands.push("long");
    }
  }
  return { lines, bands };
}

/** Any number of speeches. Empty uses the baked Jo corpus. Always 40 clip lines. */
export function expandCampaignLines(raw: string | string[]): {
  lines: string[];
  bands: CampaignTestBand[];
  speechCount: number;
  shortCount: number;
  longCount: number;
  pushCount: number;
  error?: string;
} {
  const bits = Array.isArray(raw)
    ? raw.map((s) => oneLine(String(s || ""))).filter(Boolean)
    : parseCampaignLines(String(raw || "").trim());
  const pasted = bits.length ? bits : [...CAMPAIGN_SPEECH, CAMPAIGN_PUSH_SPEECH];
  const plan = pairSpeechToPlacements(pasted);
  const peeled = peelPushSpeech(pasted);
  const pool = peeled.pool.length ? peeled.pool : [...CAMPAIGN_SPEECH];
  const split = splitSpeechBands(pool);
  return {
    lines: plan.lines,
    bands: plan.bands,
    speechCount: pasted.length,
    shortCount: split.short.length,
    longCount: split.long.length,
    pushCount: peeled.push ? PUSH_PLACEMENT_INDEXES.length : 0,
  };
}
