/** Sunny Banks CURSOR walk — park cast already in gallery. CURSOR_ packs only. */

import type { CursorShotPlan, CursorStillPlan } from "./cursorOriginalKit";

const LOOK =
  "rubbery adult cartoon, thick black outlines, flat cel colour, big heads, noodly arms, sun-bleached Aussie palette, dusty ochre, faded teal, heat haze";

export const CURSOR_SUNNY_ARSEHOLE: CursorStillPlan = {
  name: "Nuggets",
  brief: "Anxious teen. Servo pie. Secretly loves the chaos.",
  libraryVoiceName: "Nuggets",
  voiceDescription:
    "Australian teen male. Anxious, complaining, pie in hand. Dry delivery, not American, not announcer.",
  prompt: `Nuggets, portrait. Skinny anxious teen, buzz cut, oversized blue and yellow sports jersey, servo meat pie in both hands, worried face. ${LOOK}.`,
};

export const CURSOR_SUNNY_CAST: CursorStillPlan[] = [
  {
    name: "Dazza",
    brief: "Mullet. Singlet. Solves everything with beer or violence.",
    libraryVoiceName: "Dazza",
    voiceDescription:
      "Australian accent. Dazza. Can solve anything. Reaches for violence or beer first. Dry delivery, not American, not announcer.",
    prompt: `Dazza, portrait. Wild mullet, bloodshot eyes, stained blue singlet, Australia tattoo, junk ray-gun, gap-toothed grin. ${LOOK}.`,
  },
  {
    name: "Shazza",
    brief: "Knows everything. Will use it.",
    libraryVoiceName: "Shazza",
    voiceDescription:
      "Australian female accent. Shazza. Knows everything about everyone. Dry delivery, not American, not announcer.",
    prompt: `Shazza, portrait. Big blonde hair, gold hoops, cigarette, leopard-print tank, arms folded, sceptical smirk. ${LOOK}.`,
  },
  {
    name: "Ranger Bazza",
    brief: "Invented the rules. Ignores real crimes.",
    libraryVoiceName: "Ranger Bazza",
    voiceDescription:
      "Australian accent. Ranger Bazza. Enforces rules he invented. Dry delivery, not American, not announcer.",
    prompt: `Ranger Bazza, portrait. Portly park ranger, thick mustache, wraparound sunnies, tight khaki, clipboard, whistle. ${LOOK}.`,
  },
  {
    name: "Nan",
    brief: "Unbothered. Cricket bat and tea.",
    libraryVoiceName: "Nan",
    voiceDescription:
      "Australian accent. Elderly Nan. Angry and unbothered. Dry delivery, not American, not announcer.",
    prompt: `Nan, portrait. Tiny elderly woman, hair bun, round glasses, purple floral housecoat, bunny slippers, teacup, cricket bat. ${LOOK}.`,
  },
];

/** Four places for the Cursor gag — must match World gallery names. */
export const CURSOR_SUNNY_PLACES: CursorStillPlan[] = [
  {
    name: "Water tank dam",
    brief: "Low muddy water, fence line. No people.",
    prompt: `Empty water tank dam, muddy water, fence line, sun-bleached Aussie park. No people. ${LOOK}.`,
  },
  {
    name: "Site laundry",
    brief: "Coin machines, concrete floor. No people.",
    prompt: `Empty site laundry, coin machines, concrete floor, wire baskets. No people. ${LOOK}.`,
  },
  {
    name: "Demountable site office",
    brief: "Portable steps, paperwork window. No people.",
    prompt: `Empty demountable site office, portable steps, paperwork on desk through window. No people. ${LOOK}.`,
  },
  {
    name: "Back shed",
    brief: "Lawnmower, VB crate. No people.",
    prompt: `Empty back shed, lawnmower, VB crate, corrugated walls. No people. ${LOOK}.`,
  },
];

export const CURSOR_SUNNY_SHOTS: CursorShotPlan[] = [
  {
    title: "Dam — mothership panic",
    placeName: "Water tank dam",
    placeIndex: 0,
    speakers: ["Nuggets", "Shazza", "Dazza"],
    summary: "Nuggets thinks the dam is a landing pad.",
    staging: `Wide. Water tank dam, muddy water, fence. Nuggets panicking with pie. Shazza arms crossed. Dazza smug with beer. ${LOOK}.`,
    lines: [
      {
        speaker: "Nuggets",
        text: "Skree-boop! Mothership pad! Wah-doo!",
      },
      {
        speaker: "Shazza",
        text: "It's a dirty dam, Nuggets. Calm down.",
      },
      {
        speaker: "Dazza",
        text: "Reckon we could charge parking. Cold one first though.",
      },
    ],
    sfx: [
      {
        label: "Dam flies",
        prompt: "Australian bush flies buzz short, dry mix",
      },
      {
        label: "Pie wrap",
        prompt: "Paper pie bag crinkle, short",
      },
    ],
  },
  {
    title: "Laundry — Bazza translates",
    placeName: "Site laundry",
    placeIndex: 1,
    speakers: ["Nuggets", "Ranger Bazza", "Dazza"],
    summary: "Bazza cites wash-cycle law. Dazza has the wrong coins.",
    staging: `Site laundry, steam, coin machines. Ranger Bazza with clipboard. Nuggets gesturing. Dazza defensive with wrong coins. ${LOOK}.`,
    lines: [
      {
        speaker: "Nuggets",
        text: "Nee-yah wah! Clothes went tiny!",
      },
      {
        speaker: "Ranger Bazza",
        text: "He means you used the hot cycle. Section four. No refunds.",
      },
      {
        speaker: "Dazza",
        text: "I brought five cent pieces. That used to work.",
      },
    ],
    sfx: [
      {
        label: "Washer spin",
        prompt: "Industrial washing machine spin whine, short",
      },
      {
        label: "Coin reject",
        prompt: "Coin slot reject clink, short",
      },
    ],
  },
  {
    title: "Office — Nan ends it",
    placeName: "Demountable site office",
    placeIndex: 2,
    speakers: ["Dazza", "Nuggets", "Nan"],
    summary: "Dazza's fix is worse. Nan shuts the lot.",
    staging: `Demountable site office steps. Dazza with hair dryer aimed at doll clothes. Nuggets horrified. Nan with teacup and cricket bat. ${LOOK}.`,
    lines: [
      {
        speaker: "Dazza",
        text: "Three dryers. Problem solved. Science.",
      },
      {
        speaker: "Nuggets",
        text: "Boop-wah skree nah!",
      },
      {
        speaker: "Nan",
        text: "Put it down, Darren. Tea's on. Bat's ready.",
      },
    ],
    sfx: [
      {
        label: "Hair dryer",
        prompt: "Cheap hair dryer buzz, short",
      },
      {
        label: "Teacup set",
        prompt: "Ceramic teacup set on saucer, short soft clink",
      },
    ],
  },
  {
    title: "Shed — Unit optional sting",
    placeName: "Back shed",
    placeIndex: 3,
    speakers: ["Nuggets", "Shazza", "Ranger Bazza"],
    summary: "Last look. Bazza writes a ticket for existing.",
    staging: `Back shed, corrugated walls, lawnmower. Nuggets shrinking behind Shazza. Ranger Bazza writing furiously. ${LOOK}.`,
    lines: [
      {
        speaker: "Nuggets",
        text: "Skrit-boop hide!",
      },
      {
        speaker: "Shazza",
        text: "He's hiding from a lawnmower, Bazza.",
      },
      {
        speaker: "Ranger Bazza",
        text: "Unlicensed panic. That's a fine.",
      },
    ],
    sfx: [
      {
        label: "Shed door",
        prompt: "Corrugated shed door rattle, short",
      },
      {
        label: "Clipboard tick",
        prompt: "Clipboard tick mark pen tap, short",
      },
    ],
  },
];

export function sunnyBanksCursorKit(): {
  arsehole: CursorStillPlan;
  cast: CursorStillPlan[];
  places: CursorStillPlan[];
} {
  return {
    arsehole: CURSOR_SUNNY_ARSEHOLE,
    cast: CURSOR_SUNNY_CAST,
    places: CURSOR_SUNNY_PLACES,
  };
}
