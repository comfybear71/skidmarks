/** Original Cursor test kit — not the canned gag catalog. */

export type CursorStillPlan = {
  name: string;
  brief: string;
  prompt: string;
  /** ElevenLabs — sex/age/delivery only (legacy design path) */
  voiceDescription?: string;
  /**
   * Existing ElevenLabs library voice name — lock only, never design.
   * Fuzzy-matched (Skidmarks / Sunny Banks prefixes OK).
   */
  libraryVoiceName?: string;
};

export type CursorShotPlan = {
  title: string;
  placeName: string;
  placeIndex: number;
  speakers: string[];
  staging: string;
  summary: string;
  lines: { speaker: string; text: string }[];
  sfx: { label: string; prompt: string }[];
};

const LOOK =
  "highly detailed stylised 3D animated feature render, clean simplified forms, believable materials, soft overcast lighting, shallow depth of field with blurred background, cinematic quality, sharp focus. Not photographic, not a cartoon";

export const CURSOR_ORIGINAL_ARSEHOLE: CursorStillPlan = {
  name: "Clive the Clipboard",
  brief: "Council busybody. Laminated badge. Thinks the street belongs to him.",
  libraryVoiceName: "Clive the Clipboard",
  voiceDescription:
    "English male voice, mid-fifties. Thin, righteous, clipped council tone. Dry delivery, not American, not announcer.",
  prompt: `Clive the Clipboard, portrait, one man only. Mid-50s English council busybody, thin receding hair, cheap glasses, high-vis vest over a polyester shirt, laminated badge, clipboard hugged to his chest, righteous pinched mouth. ${LOOK}. Caricature modelled into the face — longer nose, smaller eyes. Wet plastic badge, cheap nylon vest.`,
};

export const CURSOR_ORIGINAL_CAST: CursorStillPlan[] = [
  {
    name: "Moira from Accounts",
    brief: "Tired office woman. Cardigan. Has seen every excuse.",
    libraryVoiceName: "Kylie Pipe",
    voiceDescription:
      "English female voice, mid-forties. Flat, tired office woman. Dry delivery, not American, not announcer.",
    prompt: `Moira from Accounts, portrait, one woman only. Mid-40s English office worker, mousey bob, beige cardigan, lanyard, unimpressed flat stare. ${LOOK}. Caricature modelled into the face. Wool cardigan, plastic lanyard.`,
  },
  {
    name: "Keith the Crossing Guard",
    brief: "Lollipop man. High-vis. Knows everyone's business.",
    libraryVoiceName: "Deep Fried Terry",
    voiceDescription:
      "English male voice, late-fifties. Warm nosy lollipop man. Dry delivery, not American, not announcer.",
    prompt: `Keith the Crossing Guard, portrait, one man only. Late-50s English lollipop man, round face, hi-vis coat, white lollipop stick, damp moustache, nosy grin. ${LOOK}. Caricature modelled into the face. Wet yellow coat, painted wood stick.`,
  },
  {
    name: "Auntie Bev",
    brief: "Church-hall volunteer. Tupperware and judgement.",
    libraryVoiceName: "Sunny Banks Nan",
    voiceDescription:
      "English female voice, early-sixties. Sweet church-hall judgement. Dry delivery, not American, not announcer.",
    prompt: `Auntie Bev, portrait, one woman only. Early-60s English volunteer, permed grey hair, floral blouse, gold chain, Tupperware smile that is not kind. ${LOOK}. Caricature modelled into the face. Polyester blouse, cheap gold chain.`,
  },
  {
    name: "Young Declan",
    brief: "School-leaver. Trackie. Thinks he's invisible.",
    libraryVoiceName: "Dazza",
    voiceDescription:
      "English male voice, young adult. Bored school-leaver mumble. Dry delivery, not American, not announcer.",
    prompt: `Young Declan, portrait, one young man only. 18, English, short fade haircut, cheap trackie top, gold chain, bored mouth, looking past the camera. ${LOOK}. Caricature modelled into the face. Nylon trackie, thin gold chain.`,
  },
];

export const CURSOR_ORIGINAL_PLACES: CursorStillPlan[] = [
  {
    name: "Wet bus shelter",
    brief: "Empty English bus shelter. Grey daylight. No people.",
    prompt: `Empty wet English bus shelter, scratched perspex, puddle on the pavement, torn timetable, overcast grey daylight. No people. ${LOOK}. Wet concrete, scuffed plastic, mown verge behind.`,
  },
  {
    name: "Chip shop queue",
    brief: "Empty chip shop interior. Stainless counter. No people.",
    prompt: `Empty English chip shop interior, stainless steel counter, hot lamps over empty trays, tiled floor, steamed window, overcast grey daylight through glass. No people. ${LOOK}. Grease-shine metal, wet tiles.`,
  },
  {
    name: "Council car park",
    brief: "Empty council car park. White lines. No people.",
    prompt: `Empty English council car park, faded white bays, wet tarmac, brick civic building behind, overcast grey daylight. No people. ${LOOK}. Wet asphalt, painted lines, brick.`,
  },
  {
    name: "Back alley bins",
    brief: "Empty back alley. Wheelie bins. No people.",
    prompt: `Empty English back alley, wet brick walls, plastic wheelie bins, mossy drain, overcast grey daylight. No people. ${LOOK}. Wet brick, scuffed plastic bins.`,
  },
];

/** 4 shots — one place each. Clive is the arsehole. */
export const CURSOR_ORIGINAL_SHOTS: CursorShotPlan[] = [
  {
    title: "Bus shelter — Clive corners Moira",
    placeName: "Wet bus shelter",
    placeIndex: 0,
    speakers: ["Clive the Clipboard", "Moira from Accounts"],
    summary: "Clive waves his clipboard at Moira in the wet shelter.",
    staging: `Wet English bus shelter, overcast grey daylight. Clive the Clipboard is prominent, largest and nearest, holding a clipboard: mid-50s, glasses, high-vis vest, laminated badge, righteous face. Moira from Accounts secondary beside him, smaller: mid-40s, beige cardigan, lanyard, unimpressed. ${LOOK}.`,
    lines: [
      {
        speaker: "Clive the Clipboard",
        text: "Section twelve, Moira. You've been loitering with intent to queue.",
      },
      {
        speaker: "Moira from Accounts",
        text: "It's a bus stop, Clive. Sit down.",
      },
      {
        speaker: "Clive the Clipboard",
        text: "I'll be logging this. In triplicate.",
      },
    ],
    sfx: [
      {
        label: "Bus shelter rattle",
        prompt: "Wet plastic bus shelter panel rattling in wind, short, dry mix",
      },
      {
        label: "Clipboard slap",
        prompt: "Clipboard slapped shut, sharp plastic clap, short",
      },
    ],
  },
  {
    title: "Chip shop — Keith translates",
    placeName: "Chip shop queue",
    placeIndex: 1,
    speakers: ["Clive the Clipboard", "Keith the Crossing Guard"],
    summary: "Clive lectures the empty counter. Keith translates the obvious.",
    staging: `English chip shop interior, stainless counter, overcast grey daylight through steamed glass. Clive the Clipboard is prominent at the counter with clipboard. Keith the Crossing Guard secondary in hi-vis coat with lollipop stick, grinning. No crowd. ${LOOK}.`,
    lines: [
      {
        speaker: "Clive the Clipboard",
        text: "This establishment is operating without a visible queue marshal.",
      },
      {
        speaker: "Keith the Crossing Guard",
        text: "He means there's nobody here, love.",
      },
      {
        speaker: "Clive the Clipboard",
        text: "Silence, Keith. I'm mid-enforcement.",
      },
    ],
    sfx: [
      {
        label: "Fryer spit",
        prompt: "Distant chip fryer oil spit, short kitchen ambience hit",
      },
      {
        label: "Door chime",
        prompt: "Cheap shop door chime ding, short",
      },
    ],
  },
  {
    title: "Car park — Auntie Bev judges",
    placeName: "Council car park",
    placeIndex: 2,
    speakers: ["Clive the Clipboard", "Auntie Bev"],
    summary: "Clive tickets empty bays. Auntie Bev arrives with Tupperware energy.",
    staging: `Empty English council car park, wet tarmac, overcast grey daylight. Clive the Clipboard prominent writing on clipboard. Auntie Bev secondary with floral blouse and gold chain, smiling unkindly. ${LOOK}.`,
    lines: [
      {
        speaker: "Clive the Clipboard",
        text: "Bay fourteen is a moral hazard. I'm issuing a conceptual fine.",
      },
      {
        speaker: "Auntie Bev",
        text: "Oh Clive. Even the church hall wouldn't have you.",
      },
      {
        speaker: "Clive the Clipboard",
        text: "That's harassment of an officer. Noted.",
      },
    ],
    sfx: [
      {
        label: "Car park wind",
        prompt: "Open wet car park wind gust, short, grey English day",
      },
      {
        label: "Pen scratch",
        prompt: "Ballpoint pen scratching on clipboard paper, short",
      },
    ],
  },
  {
    title: "Alley — Declan button",
    placeName: "Back alley bins",
    placeIndex: 3,
    speakers: ["Clive the Clipboard", "Young Declan"],
    summary: "Clive traps Declan by the bins. Declan ends it.",
    staging: `English back alley, wet brick, wheelie bins, overcast grey daylight. Clive the Clipboard prominent with clipboard raised. Young Declan secondary in trackie, bored, gold chain. ${LOOK}.`,
    lines: [
      {
        speaker: "Clive the Clipboard",
        text: "You're loitering adjacent to waste receptacles. That's a lifestyle choice.",
      },
      {
        speaker: "Young Declan",
        text: "Mate. Touch grass. Or a bin. Either's fine.",
      },
      {
        speaker: "Clive the Clipboard",
        text: "I'll see you in tribunal.",
      },
    ],
    sfx: [
      {
        label: "Bin lid",
        prompt: "Plastic wheelie bin lid slam, short alley echo",
      },
      {
        label: "Foot scrape",
        prompt: "Trainer scrape on wet alley concrete, short",
      },
    ],
  },
];
