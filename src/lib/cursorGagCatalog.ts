import type { CrashStoryDoc } from "./crashStoryTypes";
import type { ShowStyleId } from "./showStylePresets";
import { campaignBaseSlug } from "./showArchivePaths";
import { archiveUsedBaseSlugs } from "./showArchiveServer";
import { liveCastKeys } from "./styleCardThumbs";
import { readPromptPopulateConfig } from "./cursorPromptStore";
import type {
  CursorPopulateConfig,
  CursorShotPlan,
} from "./cursorPopulateTypes";
import {
  cursorSkidmarksDarrylGagSeed,
  cursorSunnyBanksGagSeed,
} from "./crashStory";

export type CursorGagCatalogEntry = {
  baseSlug: string;
  campaignLabel: string;
  seed: () => CrashStoryDoc;
  config: CursorPopulateConfig;
};

const BOOKEND_SFX = {
  intro: [
    { id: "sfx_intro_theme", label: "Theme sting", notes: "Opening hit" },
    { id: "sfx_intro_whoosh", label: "Title whoosh", notes: "" },
  ],
  outro: [{ id: "sfx_outro_sting", label: "Sting out", notes: "" }],
};

function sunnyIntroOutroPrompts() {
  return {
    introPrompt:
      "SUNNY BANKS caravan park title sign, rubbery adult cartoon, thick black outlines, sun-bleached Aussie palette, dusty ochre, faded teal, heat haze, no people",
    outroPrompt:
      "THE END title card, same Sunny Banks cel cartoon look, sun-bleached palette, no people",
  };
}

function skidIntroOutroPrompts() {
  return {
    introPrompt:
      "SKIDMARKS title card, stylised 3D animated feature render, nasty English comedy, dirty pub mood, overcast grey daylight, no people",
    outroPrompt:
      "THE END title card, same SKIDMARKS stylised 3D feature look, overcast, no people",
  };
}

function docIntroOutroPrompts() {
  return {
    introPrompt:
      "Documentary series title card, neutral interview wall, natural window light, shallow depth of field, no people",
    outroPrompt:
      "THE END documentary credits card, same natural interview lighting, no people",
  };
}

function mvIntroOutroPrompts() {
  return {
    introPrompt:
      "Music video title card, bold colour grade, performance lighting, stylised cinematic, no people",
    outroPrompt:
      "THE END music video outro card, same bold grade, no people",
  };
}

function dfIntroOutroPrompts() {
  return {
    introPrompt:
      "Photographic title card, believable studio lighting, slight uncanny smoothness, no people",
    outroPrompt:
      "THE END photographic credits card, same lighting, no people",
  };
}

function prIntroOutroPrompts() {
  return {
    introPrompt:
      "Photoreal cinematic title card, natural materials, overcast daylight, no people",
    outroPrompt:
      "THE END photoreal credits card, same natural light, no people",
  };
}

/** Second Sunny Banks gag — Unit 9 annex, different dialogue from pool inspection. */
function sunnyBanksAnnexSeed(): CrashStoryDoc {
  return {
    styleId: "sunny_banks",
    campaignLabel: "Unit 9 annex breach",
    gagNote:
      "Nuggets panics about the annex. Bazza translates. Dazza thinks a tarp fixes council law.",
    intro: {
      title: "Sunny Banks — intro",
      notes: "Title card + theme sting.",
      logoFile: "",
      sfx: [...BOOKEND_SFX.intro],
    },
    outro: {
      title: "Credits — outro",
      notes: "Roll credits + sting out.",
      logoFile: "",
      sfx: [...BOOKEND_SFX.outro],
    },
    scenes: [
      {
        id: "scene_cursor_u1",
        title: "Scene 1",
        placeName: "Unit 9 annex",
        worldThumbKey: "",
        shots: [
          {
            id: "shot_u1",
            title: "Wide — annex panic",
            summary: "Nuggets loses it at the dodgy annex",
            plateFile: "",
            beats: [
              {
                id: "beat_u1_1",
                speaker: "Nuggets",
                text: "Skrit-boop nee-yah wah-doo!",
              },
              {
                id: "beat_u1_2",
                speaker: "Shazza",
                text: "No idea what you're on about, love.",
              },
              {
                id: "beat_u1_3",
                speaker: "Dazza",
                text: "Reckon it's fine.",
              },
            ],
            sfx: [
              { id: "sfx_u1_1", label: "Alien chirp", notes: "Nuggets panic" },
              { id: "sfx_u1_2", label: "Park ambience", notes: "Caravan park bed" },
            ],
          },
          {
            id: "shot_u2",
            title: "Bazza translates",
            summary: "Ranger office — clipboard authority",
            plateFile: "",
            beats: [
              {
                id: "beat_u2_1",
                speaker: "Nuggets",
                text: "Wah-wah skree nee-yah!",
              },
              {
                id: "beat_u2_2",
                speaker: "Ranger Bazza",
                text: "He says Unit 9's annex is breaching park by-laws. Again.",
              },
              {
                id: "beat_u2_3",
                speaker: "Dazza",
                text: "Sweet.",
              },
            ],
            sfx: [
              { id: "sfx_u2_1", label: "Ute on gravel", notes: "" },
              { id: "sfx_u2_2", label: "Clipboard slap", notes: "" },
            ],
          },
          {
            id: "shot_u3",
            title: "Insane fix — junk wall",
            summary: "Dazza builds something worse",
            plateFile: "",
            beats: [
              {
                id: "beat_u3_1",
                speaker: "Dazza",
                text: "Hold my beer.",
              },
              {
                id: "beat_u3_2",
                speaker: "Nuggets",
                text: "Boop-wah skree nah!",
              },
              {
                id: "beat_u3_3",
                speaker: "Ranger Bazza",
                text: "He says that's worse.",
              },
            ],
            sfx: [
              { id: "sfx_u3_1", label: "Ray-gun zap", notes: "" },
              { id: "sfx_u3_2", label: "Something breaks", notes: "" },
            ],
          },
          {
            id: "shot_u4",
            title: "Nan button",
            summary: "Nan unbothered — one line",
            plateFile: "",
            beats: [
              {
                id: "beat_u4_1",
                speaker: "Nan",
                text: "It's a shed with beer fridges, love. Calm down.",
              },
            ],
            sfx: [
              { id: "sfx_u4_1", label: "Cricket bat tap", notes: "" },
              { id: "sfx_u4_2", label: "Tea sip", notes: "" },
            ],
          },
        ],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function skidmarksWakeSeed(): CrashStoryDoc {
  return {
    styleId: "skidmarks",
    campaignLabel: "Garry at the wake",
    gagNote:
      "Community hall wake. Darryl mansplains grief. Kim is not having it. Garry is the corpse's mate.",
    intro: {
      title: "Skidmarks — intro",
      notes: "Title card + theme sting.",
      logoFile: "",
      sfx: [...BOOKEND_SFX.intro],
    },
    outro: {
      title: "Credits — outro",
      notes: "Roll credits + sting out.",
      logoFile: "",
      sfx: [...BOOKEND_SFX.outro],
    },
    scenes: [
      {
        id: "scene_cursor_w1",
        title: "Scene 1",
        placeName: "Community hall",
        worldThumbKey: "",
        shots: [
          {
            id: "shot_w1",
            title: "Wide — wake spread",
            summary: "Sandwich trays and folding chairs",
            plateFile: "",
            beats: [
              {
                id: "beat_w1_1",
                speaker: "CrackWhore Darryl",
                text: "Funerals are just pubs with worse carpet.",
              },
              {
                id: "beat_w1_2",
                speaker: "Kim the Gypsy KUNT",
                text: "Show some respect or I'll bury you next.",
              },
              {
                id: "beat_w1_3",
                speaker: "Garry Crump",
                text: "He'd have loved the sausage rolls.",
              },
            ],
            sfx: [
              { id: "sfx_w1_1", label: "Chair scrape", notes: "Folding chair" },
              { id: "sfx_w1_2", label: "Hall murmur", notes: "Wake ambience" },
            ],
          },
          {
            id: "shot_w2",
            title: "Mansplain grief",
            summary: "Darryl explains death to women",
            plateFile: "",
            beats: [
              {
                id: "beat_w2_1",
                speaker: "CrackWhore Darryl",
                text: "Women cry wrong. It's science.",
              },
              {
                id: "beat_w2_2",
                speaker: "Kim the Gypsy KUNT",
                text: "Cry into your own pint then.",
              },
            ],
            sfx: [
              { id: "sfx_w2_1", label: "Tea cup clink", notes: "" },
              { id: "sfx_w2_2", label: "Long sigh", notes: "" },
            ],
          },
          {
            id: "shot_w3",
            title: "Fake eulogy win",
            summary: "Darryl hijacks the mic",
            plateFile: "",
            beats: [
              {
                id: "beat_w3_1",
                speaker: "CrackWhore Darryl",
                text: "He told me I was like a son to him.",
              },
              {
                id: "beat_w3_2",
                speaker: "Garry Crump",
                text: "He said you owed him forty quid.",
              },
            ],
            sfx: [
              { id: "sfx_w3_1", label: "Mic feedback", notes: "" },
              { id: "sfx_w3_2", label: "Awkward cough", notes: "" },
            ],
          },
          {
            id: "shot_w4",
            title: "Humiliation button",
            summary: "Kim ends it",
            plateFile: "",
            beats: [
              {
                id: "beat_w4_1",
                speaker: "Kim the Gypsy KUNT",
                text: "Get out before I open the coffin.",
              },
            ],
            sfx: [
              { id: "sfx_w4_1", label: "Handbag thwack", notes: "" },
              { id: "sfx_w4_2", label: "Door slam", notes: "" },
            ],
          },
        ],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

/** Third Sunny Banks gag — illegal BBQ, different story from pool + annex. */
function sunnyBanksBbqSeed(): CrashStoryDoc {
  return {
    styleId: "sunny_banks",
    campaignLabel: "Illegal BBQ gas mountain",
    gagNote:
      "Dazza's BBQ has too many gas bottles. Nuggets thinks it's a launch pad. Bazza counts violations. Nan ends it.",
    intro: {
      title: "Sunny Banks — intro",
      notes: "Title card + theme sting.",
      logoFile: "",
      sfx: [...BOOKEND_SFX.intro],
    },
    outro: {
      title: "Credits — outro",
      notes: "Roll credits + sting out.",
      logoFile: "",
      sfx: [...BOOKEND_SFX.outro],
    },
    scenes: [
      {
        id: "scene_cursor_b1",
        title: "Scene 1",
        placeName: "BBQ shelter",
        worldThumbKey: "",
        shots: [
          {
            id: "shot_b1",
            title: "Wide — gas bottle mountain",
            summary: "Dazza's BBQ looks like a refinery",
            plateFile: "",
            beats: [
              {
                id: "beat_b1_1",
                speaker: "Nuggets",
                text: "Skree-boop! Launch pad! Launch pad!",
              },
              {
                id: "beat_b1_2",
                speaker: "Shazza",
                text: "It's a BBQ, not Cape Canaveral.",
              },
              {
                id: "beat_b1_3",
                speaker: "Dazza",
                text: "More gas, more sizzle. Basic maths.",
              },
            ],
            sfx: [
              { id: "sfx_b1_1", label: "Gas hiss", notes: "BBQ bottles" },
              { id: "sfx_b1_2", label: "Sausage sizzle", notes: "BBQ plate" },
            ],
          },
          {
            id: "shot_b2",
            title: "Bazza counts bottles",
            summary: "Ranger with clipboard and fear",
            plateFile: "",
            beats: [
              {
                id: "beat_b2_1",
                speaker: "Nuggets",
                text: "Nee-yah boop wah-doo skrit!",
              },
              {
                id: "beat_b2_2",
                speaker: "Ranger Bazza",
                text: "He says you're one bottle away from a category five.",
              },
              {
                id: "beat_b2_3",
                speaker: "Dazza",
                text: "She'll be right.",
              },
            ],
            sfx: [
              { id: "sfx_b2_1", label: "Ute on gravel", notes: "" },
              { id: "sfx_b2_2", label: "Clipboard slap", notes: "" },
            ],
          },
          {
            id: "shot_b3",
            title: "Insane fix — more bottles",
            summary: "Dazza doubles down",
            plateFile: "",
            beats: [
              {
                id: "beat_b3_1",
                speaker: "Dazza",
                text: "I'll hide them in the esky.",
              },
              {
                id: "beat_b3_2",
                speaker: "Nuggets",
                text: "Wah skree-boop nah!",
              },
              {
                id: "beat_b3_3",
                speaker: "Ranger Bazza",
                text: "He says that's just a louder explosion.",
              },
            ],
            sfx: [
              { id: "sfx_b3_1", label: "Esky lid slam", notes: "" },
              { id: "sfx_b3_2", label: "Bottle clink", notes: "Gas bottles" },
            ],
          },
          {
            id: "shot_b4",
            title: "Nan button",
            summary: "Nan unbothered — one line",
            plateFile: "",
            beats: [
              {
                id: "beat_b4_1",
                speaker: "Nan",
                text: "Just cook the snags and stop flexing, love.",
              },
            ],
            sfx: [
              { id: "sfx_b4_1", label: "Cricket bat tap", notes: "" },
              { id: "sfx_b4_2", label: "Tea sip", notes: "" },
            ],
          },
        ],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

/** Fourth Sunny Banks gag — coin laundry chaos. */
function sunnyBanksLaundrySeed(): CrashStoryDoc {
  return {
    styleId: "sunny_banks",
    campaignLabel: "Laundry meltdown",
    gagNote:
      "Nuggets shrinks everything. Dazza brought the wrong coins. Bazza cites the wash cycle code.",
    intro: {
      title: "Sunny Banks — intro",
      notes: "",
      logoFile: "",
      sfx: [...BOOKEND_SFX.intro],
    },
    outro: {
      title: "Credits — outro",
      notes: "",
      logoFile: "",
      sfx: [...BOOKEND_SFX.outro],
    },
    scenes: [
      {
        id: "scene_cursor_l1",
        title: "Scene 1",
        placeName: "Site laundry",
        worldThumbKey: "",
        shots: [
          {
            id: "shot_l1",
            title: "Wide — washer explosion",
            summary: "Steam and tiny clothes everywhere",
            plateFile: "",
            beats: [
              { id: "beat_l1_1", speaker: "Nuggets", text: "Skree-boop! Everything tiny!" },
              { id: "beat_l1_2", speaker: "Shazza", text: "That's my good top, you idiot." },
              { id: "beat_l1_3", speaker: "Dazza", text: "Wrong coins. Reckon it'll stretch back." },
            ],
            sfx: [
              { id: "sfx_l1_1", label: "Washer spin", notes: "" },
              { id: "sfx_l1_2", label: "Steam hiss", notes: "" },
            ],
          },
          {
            id: "shot_l2",
            title: "Bazza cites the code",
            summary: "Ranger office",
            plateFile: "",
            beats: [
              { id: "beat_l2_1", speaker: "Nuggets", text: "Wah-doo nee-yah skrit!" },
              { id: "beat_l2_2", speaker: "Ranger Bazza", text: "He says you violated section twelve: hot wash without a permit." },
              { id: "beat_l2_3", speaker: "Dazza", text: "It's just socks." },
            ],
            sfx: [
              { id: "sfx_l2_1", label: "Ute on gravel", notes: "" },
              { id: "sfx_l2_2", label: "Clipboard slap", notes: "" },
            ],
          },
          {
            id: "shot_l3",
            title: "Insane fix — hair dryer army",
            summary: "Dazza makes it worse",
            plateFile: "",
            beats: [
              { id: "beat_l3_1", speaker: "Dazza", text: "I'll blast them back to size." },
              { id: "beat_l3_2", speaker: "Nuggets", text: "Boop-wah skree nah!" },
              { id: "beat_l3_3", speaker: "Ranger Bazza", text: "He says that's a fire hazard." },
            ],
            sfx: [
              { id: "sfx_l3_1", label: "Hair dryer whine", notes: "" },
              { id: "sfx_l3_2", label: "Fabric singe", notes: "" },
            ],
          },
          {
            id: "shot_l4",
            title: "Nan button",
            summary: "Nan unbothered",
            plateFile: "",
            beats: [
              { id: "beat_l4_1", speaker: "Nan", text: "Buy new clothes, love. They're twenty bucks at Big W." },
            ],
            sfx: [
              { id: "sfx_l4_1", label: "Cricket bat tap", notes: "" },
              { id: "sfx_l4_2", label: "Tea sip", notes: "" },
            ],
          },
        ],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

/** Fifth Sunny Banks gag — alien landing site panic. */
function sunnyBanksAlienSeed(): CrashStoryDoc {
  return {
    styleId: "sunny_banks",
    campaignLabel: "Alien landing panic",
    gagNote:
      "Nuggets welcomes the mothership. Dazza sells parking spots. Bazza translates the by-laws.",
    intro: {
      title: "Sunny Banks — intro",
      notes: "",
      logoFile: "",
      sfx: [...BOOKEND_SFX.intro],
    },
    outro: {
      title: "Credits — outro",
      notes: "",
      logoFile: "",
      sfx: [...BOOKEND_SFX.outro],
    },
    scenes: [
      {
        id: "scene_cursor_a1",
        title: "Scene 1",
        placeName: "Purple alien landing site",
        worldThumbKey: "",
        shots: [
          {
            id: "shot_a1",
            title: "Wide — crater panic",
            summary: "Nuggets thinks it's a welcome mat",
            plateFile: "",
            beats: [
              { id: "beat_a1_1", speaker: "Nuggets", text: "The mothership! They're here!" },
              { id: "beat_a1_2", speaker: "Shazza", text: "It's a pothole, Nuggets." },
              { id: "beat_a1_3", speaker: "Dazza", text: "Charge 'em parking." },
            ],
            sfx: [
              { id: "sfx_a1_1", label: "Alien chirp", notes: "" },
              { id: "sfx_a1_2", label: "Dirt crumble", notes: "" },
            ],
          },
          {
            id: "shot_a2",
            title: "Bazza translates",
            summary: "Ranger office",
            plateFile: "",
            beats: [
              { id: "beat_a2_1", speaker: "Nuggets", text: "Nee-yah wah-wah skree!" },
              { id: "beat_a2_2", speaker: "Ranger Bazza", text: "He says you can't land a spacecraft in a fire zone." },
              { id: "beat_a2_3", speaker: "Dazza", text: "It's a caravan awning." },
            ],
            sfx: [
              { id: "sfx_a2_1", label: "Ute on gravel", notes: "" },
              { id: "sfx_a2_2", label: "Clipboard slap", notes: "" },
            ],
          },
          {
            id: "shot_a3",
            title: "Insane fix — tinfoil runway",
            summary: "Dazza builds landing strip",
            plateFile: "",
            beats: [
              { id: "beat_a3_1", speaker: "Dazza", text: "Tinfoil runway. She'll be right." },
              { id: "beat_a3_2", speaker: "Nuggets", text: "Skree-boop wah!" },
              { id: "beat_a3_3", speaker: "Ranger Bazza", text: "He says that's worse." },
            ],
            sfx: [
              { id: "sfx_a3_1", label: "Tinfoil crinkle", notes: "" },
              { id: "sfx_a3_2", label: "Wind gust", notes: "" },
            ],
          },
          {
            id: "shot_a4",
            title: "Nan button",
            summary: "Nan unbothered",
            plateFile: "",
            beats: [
              { id: "beat_a4_1", speaker: "Nan", text: "Tell your spaceship to keep the noise down after nine." },
            ],
            sfx: [
              { id: "sfx_a4_1", label: "Cricket bat tap", notes: "" },
              { id: "sfx_a4_2", label: "Tea sip", notes: "" },
            ],
          },
        ],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function patchPoolInspectionLabel(story: CrashStoryDoc): CrashStoryDoc {
  return { ...story, campaignLabel: "The pool inspection" };
}

function patchDarrylLabel(story: CrashStoryDoc): CrashStoryDoc {
  return { ...story, campaignLabel: "Darryl at the Dog" };
}

function mvBeat(id: string, speaker: string, text: string) {
  return { id, speaker, text };
}

function shotSfx(
  a: string,
  labelA: string,
  b: string,
  labelB: string,
): { id: string; label: string; notes: string }[] {
  return [
    { id: a, label: labelA, notes: "" },
    { id: b, label: labelB, notes: "" },
  ];
}

function musicVideoNeonSeed(): CrashStoryDoc {
  return {
    styleId: "music_video",
    campaignLabel: "Neon rooftop verse",
    gagNote: "Performance cut — verse to chorus across six hero locations.",
    intro: {
      title: "Music video — intro",
      notes: "",
      logoFile: "",
      sfx: [...BOOKEND_SFX.intro],
    },
    outro: {
      title: "Credits — outro",
      notes: "",
      logoFile: "",
      sfx: [...BOOKEND_SFX.outro],
    },
    scenes: [
      {
        id: "scene_mv_1",
        title: "Scene 1",
        placeName: "Rooftop skyline stage",
        worldThumbKey: "",
        shots: [
          {
            id: "shot_mv1",
            title: "Verse — rock wide",
            summary: "Classic Rock star on rooftop",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_mv1_1",
                "Classic Rock star",
                "Yeah! One more time under these city lights!",
              ),
            ],
            sfx: shotSfx(
              "sfx_mv1_1",
              "Electric guitar power chord",
              "sfx_mv1_2",
              "Wind on rooftop",
            ),
          },
          {
            id: "shot_mv2",
            title: "Verse — bathroom lip-sync",
            summary: "Hip-Hop rapper mirror performance",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_mv2_1",
                "Hip-Hop rapper",
                "Fast verse, mirror reflection, hands on the glass.",
              ),
            ],
            sfx: shotSfx(
              "sfx_mv2_1",
              "Bathroom tile echo",
              "sfx_mv2_2",
              "Beat kick drum",
            ),
          },
          {
            id: "shot_mv3",
            title: "Chorus — liquid mirror",
            summary: "Synthwave singer infinite floor",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_mv3_1",
                "Synthwave singer",
                "Neon chorus hit — hold the note into the drop.",
              ),
            ],
            sfx: shotSfx(
              "sfx_mv3_1",
              "Synthwave chorus swell",
              "sfx_mv3_2",
              "Mirror floor shimmer",
            ),
          },
          {
            id: "shot_mv4",
            title: "Breakdown — arena scream",
            summary: "Heavy Metal singer empty arena",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_mv4_1",
                "Heavy Metal singer",
                "Scream held twenty seconds into the breakdown.",
              ),
            ],
            sfx: shotSfx(
              "sfx_mv4_1",
              "Metal scream sustain",
              "sfx_mv4_2",
              "Arena reverb tail",
            ),
          },
          {
            id: "shot_mv5",
            title: "Bridge — chapel acoustic",
            summary: "Delta Bluesman chapel set",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_mv5_1",
                "Delta Bluesman",
                "Low mournful line over resonator guitar.",
              ),
            ],
            sfx: shotSfx(
              "sfx_mv5_1",
              "Resonator guitar slide",
              "sfx_mv5_2",
              "Chapel room reverb",
            ),
          },
          {
            id: "shot_mv6",
            title: "Final chorus — neon beach",
            summary: "Reggae artist shore performance",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_mv6_1",
                "Reggae artist",
                "Final chorus — peaceful delivery, waves behind.",
              ),
            ],
            sfx: shotSfx(
              "sfx_mv6_1",
              "Reggae offbeat skank",
              "sfx_mv6_2",
              "Neon wave wash",
            ),
          },
        ],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function deepfakeAndrewSoloSeed(): CrashStoryDoc {
  return {
    styleId: "deepfake",
    campaignLabel: "Andrew French solo",
    gagNote: "Four locked plates — Andrew French by himself.",
    intro: {
      title: "Deep fake — intro",
      notes: "",
      logoFile: "",
      sfx: [...BOOKEND_SFX.intro],
    },
    outro: {
      title: "Credits — outro",
      notes: "",
      logoFile: "",
      sfx: [...BOOKEND_SFX.outro],
    },
    scenes: [
      {
        id: "scene_af_1",
        title: "Scene 1",
        placeName: "Backyard premiere",
        worldThumbKey: "",
        shots: [
          {
            id: "shot_af1",
            title: "Wide — red carpet lawn",
            summary: "Andrew alone on backyard red carpet",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_af1_1",
                "Andrew French",
                "Welcome to Reservoir premiere night, folks.",
              ),
            ],
            sfx: shotSfx(
              "sfx_af1_1",
              "Cheap PA mic feedback",
              "sfx_af1_2",
              "Suburban lawn sprinkler hiss",
            ),
          },
          {
            id: "shot_af2",
            title: "Medium — barbecue host",
            summary: "Andrew at the snag plate",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_af2_1",
                "Andrew French",
                "These snags are artisan, Bazza flamed them himself.",
              ),
            ],
            sfx: shotSfx(
              "sfx_af2_1",
              "Sizzle plate hiss",
              "sfx_af2_2",
              "Tong metal clink",
            ),
          },
          {
            id: "shot_af3",
            title: "Close — press line",
            summary: "Andrew at microphone",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_af3_1",
                "Andrew French",
                "Yeah nah, Hollywood called first.",
              ),
            ],
            sfx: shotSfx(
              "sfx_af3_1",
              "Camera shutter burst",
              "sfx_af3_2",
              "Fabric scarf rustle",
            ),
          },
          {
            id: "shot_af4",
            title: "Portrait — Collingwood pride",
            summary: "Andrew scarf portrait",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_af4_1",
                "Andrew French",
                "Premiere finished. Pie at half time.",
              ),
            ],
            sfx: shotSfx(
              "sfx_af4_1",
              "Crowd cheer bed",
              "sfx_af4_2",
              "Footy scarf flutter",
            ),
          },
        ],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function deepfakeAndrewMargotSeed(): CrashStoryDoc {
  return {
    styleId: "deepfake",
    campaignLabel: "Andrew Margot backyard premiere",
    gagNote:
      "Andrew French hosts a Collingwood backyard premiere. Margot Robbie arrives for the snags.",
    intro: {
      title: "Deep fake — intro",
      notes: "",
      logoFile: "",
      sfx: [...BOOKEND_SFX.intro],
    },
    outro: {
      title: "Credits — outro",
      notes: "",
      logoFile: "",
      sfx: [...BOOKEND_SFX.outro],
    },
    scenes: [
      {
        id: "scene_am_1",
        title: "Scene 1",
        placeName: "Backyard premiere",
        worldThumbKey: "",
        shots: [
          {
            id: "shot_am1",
            title: "Wide — red carpet lawn",
            summary: "Andrew welcomes Margot to the backyard premiere",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_am1_1",
                "Andrew French",
                "Margot! Welcome to Reservoir. Mind the dog poo near the red carpet.",
              ),
              mvBeat(
                "beat_am1_2",
                "Margot Robbie",
                "This is a very authentic premiere.",
              ),
            ],
            sfx: shotSfx(
              "sfx_am1_1",
              "Cheap PA mic feedback",
              "sfx_am1_2",
              "Suburban lawn sprinkler hiss",
            ),
          },
          {
            id: "shot_am2",
            title: "Two-shot — scarf and stilettos",
            summary: "Collingwood scarf meets Hollywood grin",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_am2_1",
                "Andrew French",
                "Collingwood scarf is vintage. Same one Mum won at bingo.",
              ),
              mvBeat(
                "beat_am2_2",
                "Margot Robbie",
                "You are not wearing that on the red carpet.",
              ),
            ],
            sfx: shotSfx(
              "sfx_am2_1",
              "Camera shutter burst",
              "sfx_am2_2",
              "Fabric scarf rustle",
            ),
          },
          {
            id: "shot_am3",
            title: "Close — snag crisis",
            summary: "Margot inspects the barbecue snags",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_am3_1",
                "Margot Robbie",
                "Is this sausage supposed to be charcoal?",
              ),
              mvBeat(
                "beat_am3_2",
                "Andrew French",
                "That is artisan. Bazza flamed it with a heat gun.",
              ),
            ],
            sfx: shotSfx(
              "sfx_am3_1",
              "Sizzle plate hiss",
              "sfx_am3_2",
              "Tong metal clink",
            ),
          },
          {
            id: "shot_am4",
            title: "Sting — press line",
            summary: "Andrew claims Hollywood family ties",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_am4_1",
                "Andrew French",
                "We are basically related through Neighbours. Tell the cameras.",
              ),
              mvBeat(
                "beat_am4_2",
                "Margot Robbie",
                "I was never on Neighbours.",
              ),
            ],
            sfx: shotSfx(
              "sfx_am4_1",
              "Champagne cork pop",
              "sfx_am4_2",
              "Crowd awkward silence",
            ),
          },
        ],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function deepfakeCheckoutSeed(): CrashStoryDoc {
  return {
    styleId: "deepfake",
    campaignLabel: "Self checkout meltdown",
    gagNote: "Gordon Ramsay loses it at a supermarket self-checkout.",
    intro: {
      title: "Deep fake — intro",
      notes: "",
      logoFile: "",
      sfx: [...BOOKEND_SFX.intro],
    },
    outro: {
      title: "Credits — outro",
      notes: "",
      logoFile: "",
      sfx: [...BOOKEND_SFX.outro],
    },
    scenes: [
      {
        id: "scene_df_1",
        title: "Scene 1",
        placeName: "Celebrity kitchen",
        worldThumbKey: "",
        shots: [
          {
            id: "shot_df1",
            title: "Wide — checkout rage",
            summary: "Gordon at self-checkout",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_df1_1",
                "Gordon Ramsay",
                "It's raw! The machine says unexpected item in bagging area!",
              ),
            ],
            sfx: shotSfx(
              "sfx_df1_1",
              "Checkout beep error",
              "sfx_df1_2",
              "Plastic bag rustle",
            ),
          },
          {
            id: "shot_df2",
            title: "Close — Keanu whisper",
            summary: "Keanu reacts off to the side",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_df2_1",
                "Keanu Reeves",
                "Maybe we should just pay a human, Gordon.",
              ),
            ],
            sfx: shotSfx(
              "sfx_df2_1",
              "Supermarket hum",
              "sfx_df2_2",
              "Soft whisper room tone",
            ),
          },
          {
            id: "shot_df3",
            title: "Turn — Taylor on Wi-Fi",
            summary: "Taylor devastated by signal",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_df3_1",
                "Taylor Swift",
                "I can't even load the loyalty app. This is worse than heartbreak.",
              ),
            ],
            sfx: shotSfx(
              "sfx_df3_1",
              "Phone buzz fail",
              "sfx_df3_2",
              "Dramatic sigh",
            ),
          },
          {
            id: "shot_df4",
            title: "Sting — Gordon final",
            summary: "Gordon points at screen",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_df4_1",
                "Gordon Ramsay",
                "Donkey! Even the toast is burnt and the machine still wins!",
              ),
            ],
            sfx: shotSfx(
              "sfx_df4_1",
              "Checkout error repeat beep",
              "sfx_df4_2",
              "Chef knife tap on counter",
            ),
          },
        ],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function photorealSmokoSeed(): CrashStoryDoc {
  return {
    styleId: "photoreal",
    campaignLabel: "Pub snug smoko",
    gagNote: "Bricklayer on smoko — ordinary English pub, believable daylight.",
    intro: {
      title: "Photoreal — intro",
      notes: "",
      logoFile: "",
      sfx: [...BOOKEND_SFX.intro],
    },
    outro: {
      title: "Credits — outro",
      notes: "",
      logoFile: "",
      sfx: [...BOOKEND_SFX.outro],
    },
    scenes: [
      {
        id: "scene_pr_1",
        title: "Scene 1",
        placeName: "Pub snug",
        worldThumbKey: "",
        shots: [
          {
            id: "shot_pr1",
            title: "Wide — snug entrance",
            summary: "Bricklayer enters pub snug",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_pr1_1",
                "Bricklayer on smoko",
                "Right. Five minutes, then back on the wall.",
              ),
            ],
            sfx: shotSfx(
              "sfx_pr1_1",
              "Pub door latch",
              "sfx_pr1_2",
              "Muffled bar murmur",
            ),
          },
          {
            id: "shot_pr2",
            title: "Medium — pie at bar",
            summary: "Smoko at the bar",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_pr2_1",
                "Bricklayer on smoko",
                "Same pie as yesterday. Perfect.",
              ),
            ],
            sfx: shotSfx(
              "sfx_pr2_1",
              "Paper pie bag crinkle",
              "sfx_pr2_2",
              "Beer tap clunk",
            ),
          },
          {
            id: "shot_pr3",
            title: "Two-shot — taxi driver",
            summary: "Night taxi driver at end of bar",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_pr3_1",
                "Night taxi driver",
                "You're early. Shift doesn't end till midnight.",
              ),
            ],
            sfx: shotSfx(
              "sfx_pr3_1",
              "Glass set on wood",
              "sfx_pr3_2",
              "Fridge compressor hum",
            ),
          },
          {
            id: "shot_pr4",
            title: "Close — back to site",
            summary: "Leaves with coffee",
            plateFile: "",
            beats: [
              mvBeat(
                "beat_pr4_1",
                "Bricklayer on smoko",
                "Smoko done. Mortar waits for no man.",
              ),
            ],
            sfx: shotSfx(
              "sfx_pr4_1",
              "Door open to street",
              "sfx_pr4_2",
              "Distant traffic pass",
            ),
          },
        ],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

const MV_SFX = {
  sfx_intro_theme: "Music video opener hit, bold synth stab, performance energy",
  sfx_intro_whoosh: "Title whoosh, cinematic swoosh into logo",
  sfx_outro_sting: "Music video outro sting, final chord decay",
  sfx_mv1_1: "Electric guitar power chord, stadium rock, dry mix",
  sfx_mv1_2: "Rooftop wind gust, city air, performance stage",
  sfx_mv2_1: "Bathroom tile slapback echo, tight room",
  sfx_mv2_2: "Hip-hop kick drum, single hit, dry",
  sfx_mv3_1: "Synthwave chorus pad swell, neon energy",
  sfx_mv3_2: "Shimmering mirror floor sparkle, synthetic",
  sfx_mv4_1: "Heavy metal scream sample, sustained, arena reverb",
  sfx_mv4_2: "Empty arena reverb tail, vast space",
  sfx_mv5_1: "Resonator guitar slide, blues acoustic, chapel",
  sfx_mv5_2: "Wooden chapel room tone, soft reverb",
  sfx_mv6_1: "Reggae offbeat guitar skank, laid back",
  sfx_mv6_2: "Neon beach wave wash, stylised shore",
};

const AF_SOLO_SFX = {
  sfx_intro_theme: "News package opener, subtle tension sting",
  sfx_intro_whoosh: "Title whoosh, broadcast graphic",
  sfx_outro_sting: "Documentary-style out sting, low resolve",
  sfx_af1_1: "Cheap PA mic feedback squeal",
  sfx_af1_2: "Suburban lawn sprinkler hiss",
  sfx_af2_1: "Barbecue sizzle plate hiss",
  sfx_af2_2: "Metal tong clink on hotplate",
  sfx_af3_1: "Camera shutter burst, paparazzi",
  sfx_af3_2: "Fabric scarf rustle, close mic",
  sfx_af4_1: "AFL crowd cheer bed, distant",
  sfx_af4_2: "Footy scarf flutter in breeze",
};

const AM_SFX = {
  sfx_intro_theme: "News package opener, subtle tension sting",
  sfx_intro_whoosh: "Title whoosh, broadcast graphic",
  sfx_outro_sting: "Documentary-style out sting, low resolve",
  sfx_am1_1: "Cheap PA mic feedback squeal",
  sfx_am1_2: "Suburban lawn sprinkler hiss",
  sfx_am2_1: "Camera shutter burst, paparazzi",
  sfx_am2_2: "Fabric scarf rustle, close mic",
  sfx_am3_1: "Barbecue sizzle plate hiss",
  sfx_am3_2: "Metal tong clink on hotplate",
  sfx_am4_1: "Champagne cork pop",
  sfx_am4_2: "Crowd awkward silence, suburban backyard",
};

const DF_SFX = {
  sfx_intro_theme: "News package opener, subtle tension sting",
  sfx_intro_whoosh: "Title whoosh, broadcast graphic",
  sfx_outro_sting: "Documentary-style out sting, low resolve",
  sfx_df1_1: "Supermarket self-checkout error beep",
  sfx_df1_2: "Plastic shopping bag rustle",
  sfx_df2_1: "Supermarket ambient hum, fluorescent",
  sfx_df2_2: "Soft whisper room tone, close mic",
  sfx_df3_1: "Phone vibration buzz on counter",
  sfx_df3_2: "Dramatic emotional sigh, close portrait",
  sfx_df4_1: "Repeated checkout error beep, angry rhythm",
  sfx_df4_2: "Knife tap on kitchen counter, sharp",
};

const PR_SFX = {
  sfx_intro_theme: "Soft documentary piano note, overcast day",
  sfx_intro_whoosh: "Gentle title fade, natural room",
  sfx_outro_sting: "Quiet outro resolve, pub door implied",
  sfx_pr1_1: "English pub door latch, wooden snug",
  sfx_pr1_2: "Muffled bar murmur, low crowd bed",
  sfx_pr2_1: "Paper pie bag crinkle, close mic",
  sfx_pr2_2: "Beer tap handle clunk, single",
  sfx_pr3_1: "Pint glass on wood, soft clink",
  sfx_pr3_2: "Fridge compressor hum, back bar",
  sfx_pr4_1: "Pub door open to street, daylight rush",
  sfx_pr4_2: "Single car pass, wet tarmac, distant",
};

const SUNNY_CAST: Record<string, string> = {
  Dazza: "g:thumb_1786096652402.png",
  Shazza: "g:thumb_1786096667708.png",
  Nuggets: "g:thumb_1786096687757.png",
  "Ranger Bazza": "g:thumb_1786096716796.png",
  Nan: "g:thumb_1786096739616.png",
};

const SKIDMARKS_CAST: Record<string, string> = {
  "CrackWhore Darryl": "g:thumb_1786096758336.png",
  "Kim the Gypsy KUNT": "g:thumb_1786096809634.png",
  "Garry Crump": "g:thumb_1786096829613.png",
};

export const CURSOR_GAG_CATALOG: Partial<
  Record<ShowStyleId, CursorGagCatalogEntry[]>
> = {
  sunny_banks: [
    {
      baseSlug: "The_pool_inspection",
      campaignLabel: "The pool inspection",
      seed: () => patchPoolInspectionLabel(cursorSunnyBanksGagSeed()),
      config: {
        styleId: "sunny_banks",
        ...sunnyIntroOutroPrompts(),
        shotPlans: [
          {
            shotId: "shot_p1",
            placeKey: "g:place_1786102618157.png",
            placeName: "Water tank dam",
            cast: ["Nuggets", "Shazza", "Dazza"],
            note:
              "Wide shot. Dodgy above-ground pool beside a fibro caravan. Nuggets panicking. Shazza sceptical. Dazza smug with beer.",
          },
          {
            shotId: "shot_p2",
            placeKey: "g:place_1786102741992.png",
            placeName: "Demountable site office",
            cast: ["Nuggets", "Ranger Bazza", "Shazza"],
            note:
              "Ranger Bazza with clipboard. Nuggets gesticulating. Shazza unimpressed.",
          },
          {
            shotId: "shot_p3",
            placeKey: "g:place_1786102677734.png",
            placeName: "Back shed",
            cast: ["Dazza", "Nuggets", "Ranger Bazza"],
            note:
              "Dazza throwing a blue tarp over the dodgy pool. Nuggets pointing. Ranger Bazza deadpan with clipboard.",
          },
          {
            shotId: "shot_p4",
            placeKey: "g:place_1786102692093.png",
            placeName: "Fibro caravan interior",
            cast: ["Nan"],
            note:
              "Medium close shot. Nan unbothered with teacup. Window shows the tarp outside.",
          },
        ],
        sfxPrompts: {
          sfx_intro_theme:
            "Short upbeat caravan park theme sting, comedic Australian TV opener, brass and guitar hit",
          sfx_intro_whoosh: "Title card whoosh, quick airy swoosh into logo",
          sfx_outro_sting:
            "Comedic sting out, short descending notes, end credits bump",
          sfx_p1_1:
            "Short nervous alien chirp and warble, cartoon sci-fi, panicked tone, dry mix",
          sfx_p1_2: "Small splashy pool water slosh, inflatable pool, comedic",
          sfx_p2_1: "Australian ute driving on gravel, slow approach, caravan park",
          sfx_p2_2: "Clipboard slap on cardboard, single sharp office hit",
          sfx_p3_1: "Blue tarp flapping in outback wind, plastic rustle, outdoor",
          sfx_p3_2: "Plastic tarp peg snap, sharp comedic hit",
          sfx_p4_1: "Single cricket bat tap on fibro wall, dry woody knock",
          sfx_p4_2: "Elderly woman tea sip, delicate china clink, quiet room",
        },
      },
    },
    {
      baseSlug: "Unit_9_annex_breach",
      campaignLabel: "Unit 9 annex breach",
      seed: sunnyBanksAnnexSeed,
      config: {
        styleId: "sunny_banks",
        ...sunnyIntroOutroPrompts(),
        shotPlans: [
          {
            shotId: "shot_u1",
            placeKey: "g:place_1786102757254.png",
            placeName: "Highway truck stop annex",
            cast: ["Nuggets", "Shazza", "Dazza"],
            note:
              "Wide shot. Dodgy annex built off a fibro caravan. Nuggets panicking. Shazza arms crossed. Dazza with beer.",
          },
          {
            shotId: "shot_u2",
            placeKey: "g:place_1786102741992.png",
            placeName: "Demountable site office",
            cast: ["Nuggets", "Ranger Bazza", "Dazza"],
            note:
              "Ranger Bazza with clipboard. Nuggets gesticulating wildly. Dazza smug.",
          },
          {
            shotId: "shot_u3",
            placeKey: "g:place_1786102677734.png",
            placeName: "Back shed",
            cast: ["Dazza", "Nuggets", "Ranger Bazza"],
            note:
              "Dazza welding junk onto the annex. Nuggets horrified. Ranger Bazza writing a ticket.",
          },
          {
            shotId: "shot_u4",
            placeKey: "g:place_1786102692093.png",
            placeName: "Fibro caravan interior",
            cast: ["Nan"],
            note: "Nan sipping tea, completely unbothered by the chaos outside.",
          },
        ],
        sfxPrompts: {
          sfx_intro_theme:
            "Short upbeat caravan park theme sting, comedic Australian TV opener, brass and guitar hit",
          sfx_intro_whoosh: "Title card whoosh, quick airy swoosh into logo",
          sfx_outro_sting:
            "Comedic sting out, short descending notes, end credits bump",
          sfx_u1_1:
            "Short nervous alien chirp and warble, cartoon sci-fi, panicked tone, dry mix",
          sfx_u1_2: "Caravan park outdoor ambience, distant generator hum",
          sfx_u2_1: "Australian ute driving on gravel, slow approach, caravan park",
          sfx_u2_2: "Clipboard slap on cardboard, single sharp office hit",
          sfx_u3_1: "Angle grinder spark burst, comedic short burst, outdoor shed",
          sfx_u3_2: "Metal clatter and junk falling, comedic crash",
          sfx_u4_1: "Single cricket bat tap on fibro wall, dry woody knock",
          sfx_u4_2: "Elderly woman tea sip, delicate china clink, quiet room",
        },
      },
    },
    {
      baseSlug: "Illegal_BBQ_gas_mountain",
      campaignLabel: "Illegal BBQ gas mountain",
      seed: sunnyBanksBbqSeed,
      config: {
        styleId: "sunny_banks",
        ...sunnyIntroOutroPrompts(),
        shotPlans: [
          {
            shotId: "shot_b1",
            placeKey: "g:place_1786102663162.png",
            placeName: "Bottle-o front",
            cast: ["Nuggets", "Shazza", "Dazza"],
            note:
              "Wide shot. BBQ shelter beside caravans. Dazza proud beside a ridiculous stack of gas bottles. Nuggets pointing at sky. Shazza unimpressed.",
          },
          {
            shotId: "shot_b2",
            placeKey: "g:place_1786102741992.png",
            placeName: "Demountable site office",
            cast: ["Nuggets", "Ranger Bazza", "Dazza"],
            note:
              "Ranger Bazza counting on clipboard. Nuggets frantic. Dazza arms crossed, smug.",
          },
          {
            shotId: "shot_b3",
            placeKey: "g:place_1786102677734.png",
            placeName: "Back shed",
            cast: ["Dazza", "Nuggets", "Ranger Bazza"],
            note:
              "Dazza shoving gas bottles into an esky. Nuggets horrified. Ranger Bazza writing furiously.",
          },
          {
            shotId: "shot_b4",
            placeKey: "g:place_1786102692093.png",
            placeName: "Fibro caravan interior",
            cast: ["Nan"],
            note: "Nan at laminex table with tea, sausages on plate, utterly unbothered.",
          },
        ],
        sfxPrompts: {
          sfx_intro_theme:
            "Short upbeat caravan park theme sting, comedic Australian TV opener, brass and guitar hit",
          sfx_intro_whoosh: "Title card whoosh, quick airy swoosh into logo",
          sfx_outro_sting:
            "Comedic sting out, short descending notes, end credits bump",
          sfx_b1_1: "LPG gas bottle hiss, BBQ pressure release, comedic",
          sfx_b1_2: "Sausage sizzle on hot plate, outdoor BBQ, dry mix",
          sfx_b2_1: "Australian ute driving on gravel, slow approach, caravan park",
          sfx_b2_2: "Clipboard slap on cardboard, single sharp office hit",
          sfx_b3_1: "Esky lid slam shut, plastic cooler, comedic",
          sfx_b3_2: "Gas bottles clinking together, metal on metal",
          sfx_b4_1: "Single cricket bat tap on fibro wall, dry woody knock",
          sfx_b4_2: "Elderly woman tea sip, delicate china clink, quiet room",
        },
      },
    },
    {
      baseSlug: "Laundry_meltdown",
      campaignLabel: "Laundry meltdown",
      seed: sunnyBanksLaundrySeed,
      config: {
        styleId: "sunny_banks",
        ...sunnyIntroOutroPrompts(),
        shotPlans: [
          {
            shotId: "shot_l1",
            placeKey: "g:place_1786102649034.png",
            placeName: "Site laundry",
            cast: ["Nuggets", "Shazza", "Dazza"],
            note: "Wide shot. Coin laundry. Steam burst. Tiny clothes flying. Nuggets panicking.",
          },
          {
            shotId: "shot_l2",
            placeKey: "g:place_1786102741992.png",
            placeName: "Demountable site office",
            cast: ["Nuggets", "Ranger Bazza", "Dazza"],
            note: "Ranger Bazza with clipboard. Nuggets gesturing at shrunken singlet.",
          },
          {
            shotId: "shot_l3",
            placeKey: "g:place_1786102677734.png",
            placeName: "Back shed",
            cast: ["Dazza", "Nuggets", "Ranger Bazza"],
            note: "Dazza aiming three hair dryers at doll-sized clothes.",
          },
          {
            shotId: "shot_l4",
            placeKey: "g:place_1786102692093.png",
            placeName: "Fibro caravan interior",
            cast: ["Nan"],
            note: "Nan with tea, unbothered.",
          },
        ],
        sfxPrompts: {
          sfx_intro_theme:
            "Short upbeat caravan park theme sting, comedic Australian TV opener, brass and guitar hit",
          sfx_intro_whoosh: "Title card whoosh, quick airy swoosh into logo",
          sfx_outro_sting:
            "Comedic sting out, short descending notes, end credits bump",
          sfx_l1_1: "Coin washer spin cycle, laundromat, mechanical whir",
          sfx_l1_2: "Steam hiss burst, comedic laundry room",
          sfx_l2_1: "Australian ute driving on gravel, slow approach, caravan park",
          sfx_l2_2: "Clipboard slap on cardboard, single sharp office hit",
          sfx_l3_1: "Hair dryer high whine, multiple dryers, comedic",
          sfx_l3_2: "Fabric singe puff, quick comedic hit",
          sfx_l4_1: "Single cricket bat tap on fibro wall, dry woody knock",
          sfx_l4_2: "Elderly woman tea sip, delicate china clink, quiet room",
        },
      },
    },
    {
      baseSlug: "Alien_landing_panic",
      campaignLabel: "Alien landing panic",
      seed: sunnyBanksAlienSeed,
      config: {
        styleId: "sunny_banks",
        ...sunnyIntroOutroPrompts(),
        shotPlans: [
          {
            shotId: "shot_a1",
            placeKey: "g:place_1786102793265.png",
            placeName: "Purple alien landing site",
            cast: ["Nuggets", "Shazza", "Dazza"],
            note: "Wide shot. Crater ring in red dirt. Nuggets arms raised. Shazza unimpressed. Dazza with esky.",
          },
          {
            shotId: "shot_a2",
            placeKey: "g:place_1786102741992.png",
            placeName: "Demountable site office",
            cast: ["Nuggets", "Ranger Bazza", "Dazza"],
            note: "Ranger Bazza stern. Nuggets pleading. Dazza counting cash.",
          },
          {
            shotId: "shot_a3",
            placeKey: "g:place_1786102631293.png",
            placeName: "Roadside rest stop",
            cast: ["Dazza", "Nuggets", "Ranger Bazza"],
            note: "Dazza laying tinfoil strips on dirt. Nuggets helping. Ranger Bazza facepalming.",
          },
          {
            shotId: "shot_a4",
            placeKey: "g:place_1786102692093.png",
            placeName: "Fibro caravan interior",
            cast: ["Nan"],
            note: "Nan with tea, unbothered.",
          },
        ],
        sfxPrompts: {
          sfx_intro_theme:
            "Short upbeat caravan park theme sting, comedic Australian TV opener, brass and guitar hit",
          sfx_intro_whoosh: "Title card whoosh, quick airy swoosh into logo",
          sfx_outro_sting:
            "Comedic sting out, short descending notes, end credits bump",
          sfx_a1_1: "Short nervous alien chirp and warble, cartoon sci-fi",
          sfx_a1_2: "Loose dirt crumbling into crater, outdoor",
          sfx_a2_1: "Australian ute driving on gravel, slow approach, caravan park",
          sfx_a2_2: "Clipboard slap on cardboard, single sharp office hit",
          sfx_a3_1: "Tinfoil sheet crinkle and flap, outdoor wind",
          sfx_a3_2: "Dry outback wind gust, short burst",
          sfx_a4_1: "Single cricket bat tap on fibro wall, dry woody knock",
          sfx_a4_2: "Elderly woman tea sip, delicate china clink, quiet room",
        },
      },
    },
  ],
  skidmarks: [
    {
      baseSlug: "Darryl_at_the_Dog",
      campaignLabel: "Darryl at the Dog",
      seed: () => patchDarrylLabel(cursorSkidmarksDarrylGagSeed()),
      config: {
        styleId: "skidmarks",
        ...skidIntroOutroPrompts(),
        shotPlans: [
          {
            shotId: "shot_d1",
            placeKey: "g:place_1786102473299.png",
            placeName: "Dirty Dog Pub",
            cast: ["CrackWhore Darryl", "Kim the Gypsy KUNT", "Garry Crump"],
            note:
              "Wide shot. CrackWhore Darryl bursting through pub doorway, stained singlet, cocky grin. Kim behind bar, unimpressed. Garry Crump on stool.",
          },
          {
            shotId: "shot_d2",
            placeKey: "g:place_1786102473299.png",
            placeName: "Dirty Dog Pub",
            cast: ["CrackWhore Darryl", "Kim the Gypsy KUNT"],
            note:
              "Medium shot. Darryl leaning over bar mansplaining, finger raised. Kim deadpan behind counter.",
          },
          {
            shotId: "shot_d3",
            placeKey: "g:place_1786102550558.png",
            placeName: "Office open-plan",
            cast: ["CrackWhore Darryl", "Garry Crump"],
            note:
              "Darryl wearing a cheap lanyard, beaming fake-win grin. Garry Crump sweating in polyester suit.",
          },
          {
            shotId: "shot_d4",
            placeKey: "g:place_1786102563466.png",
            placeName: "Suburban high street",
            cast: ["CrackWhore Darryl"],
            note:
              "Medium shot. Darryl mid-humiliation on pavement, singlet stained, cocky grin finally cracking.",
          },
        ],
        sfxPrompts: {
          sfx_intro_theme:
            "Dark comedy sting, English pub bass note, nasty sketch show opener",
          sfx_intro_whoosh: "Title card whoosh, dry, not Hollywood",
          sfx_outro_sting: "Short comedic sting out, flat thud",
          sfx_d1_1: "Pub door slam, glass rattle, English dive bar",
          sfx_d1_2: "Muffled pub ambience, one drunk murmur",
          sfx_d2_1: "Finger tap on sticky bar top",
          sfx_d2_2: "Long suffering sigh, female",
          sfx_d3_1: "Cheap lanyard plastic click",
          sfx_d3_2: "Fluorescent office hum",
          sfx_d4_1: "Handbag thwack on pavement, comedic",
          sfx_d4_2: "Distant bus brakes squeal",
        },
      },
    },
    {
      baseSlug: "Garry_at_the_wake",
      campaignLabel: "Garry at the wake",
      seed: skidmarksWakeSeed,
      config: {
        styleId: "skidmarks",
        ...skidIntroOutroPrompts(),
        shotPlans: [
          {
            shotId: "shot_w1",
            placeKey: "g:place_1786102458845.png",
            placeName: "Community hall",
            cast: ["CrackWhore Darryl", "Kim the Gypsy KUNT", "Garry Crump"],
            note:
              "Wide shot. Wake spread with folding chairs and sandwich trays. Darryl loud. Kim furious. Garry holding a paper plate.",
          },
          {
            shotId: "shot_w2",
            placeKey: "g:place_1786102458845.png",
            placeName: "Community hall",
            cast: ["CrackWhore Darryl", "Kim the Gypsy KUNT"],
            note:
              "Medium shot. Darryl mansplaining at the buffet table. Kim staring holes through him.",
          },
          {
            shotId: "shot_w3",
            placeKey: "g:place_1786102550558.png",
            placeName: "Office open-plan",
            cast: ["CrackWhore Darryl", "Garry Crump"],
            note:
              "Darryl at a cheap lectern with wired mic, fake solemn face. Garry cringing beside him.",
          },
          {
            shotId: "shot_w4",
            placeKey: "g:place_1786102473299.png",
            placeName: "Dirty Dog Pub",
            cast: ["Kim the Gypsy KUNT"],
            note:
              "Kim mid-throw, handbag aimed. Darryl fleeing frame edge. Pub doorway behind.",
          },
        ],
        sfxPrompts: {
          sfx_intro_theme:
            "Dark comedy sting, English pub bass note, nasty sketch show opener",
          sfx_intro_whoosh: "Title card whoosh, dry, not Hollywood",
          sfx_outro_sting: "Short comedic sting out, flat thud",
          sfx_w1_1: "Folding chair scrape on hall floor",
          sfx_w1_2: "Muted wake hall murmur, tea cups",
          sfx_w2_1: "Teacup saucer clink, sharp",
          sfx_w2_2: "Long suffering sigh, female",
          sfx_w3_1: "Cheap microphone feedback squeal",
          sfx_w3_2: "Single awkward cough from crowd",
          sfx_w4_1: "Handbag thwack, comedic impact",
          sfx_w4_2: "Pub door slam, glass rattle",
        },
      },
    },
  ],
  doc: [
    {
      baseSlug: "The_closet_mystery",
      campaignLabel: "The closet mystery",
      seed: () => ({
        styleId: "doc" as const,
        campaignLabel: "The closet mystery",
        gagNote: "True crime hook — billionaire stuck in walk-in closet.",
        intro: {
          title: "Documentary — intro",
          notes: "",
          logoFile: "",
          sfx: [...BOOKEND_SFX.intro],
        },
        outro: {
          title: "Credits — outro",
          notes: "",
          logoFile: "",
          sfx: [...BOOKEND_SFX.outro],
        },
        scenes: [
          {
            id: "scene_doc_1",
            title: "Scene 1",
            placeName: "Interview room",
            worldThumbKey: "",
            shots: [
              {
                id: "shot_dc1",
                title: "Hook — cold open",
                summary: "Investigator sets the mystery",
                plateFile: "",
                beats: [
                  {
                    id: "beat_dc1_1",
                    speaker: "True crime investigator",
                    text: "He walked into his own closet and never walked out.",
                  },
                ],
                sfx: [
                  { id: "sfx_dc1_1", label: "Rain on window", notes: "" },
                  { id: "sfx_dc1_2", label: "Tape recorder click", notes: "" },
                ],
              },
              {
                id: "shot_dc2",
                title: "Witness — historian",
                summary: "Expert baffled",
                plateFile: "",
                beats: [
                  {
                    id: "beat_dc2_1",
                    speaker: "Ancient historian",
                    text: "Even the Romans filed complaints about closet doors.",
                  },
                  {
                    id: "beat_dc2_2",
                    speaker: "True crime investigator",
                    text: "That's not helping.",
                  },
                ],
                sfx: [
                  { id: "sfx_dc2_1", label: "Page turn", notes: "" },
                  { id: "sfx_dc2_2", label: "Pen scratch", notes: "" },
                ],
              },
              {
                id: "shot_dc3",
                title: "Turn — new evidence",
                summary: "Security footage reveal",
                plateFile: "",
                beats: [
                  {
                    id: "beat_dc3_1",
                    speaker: "True crime investigator",
                    text: "The door only locks from the inside. He did this to himself.",
                  },
                ],
                sfx: [
                  { id: "sfx_dc3_1", label: "VHS static burst", notes: "" },
                  { id: "sfx_dc3_2", label: "Dramatic sting", notes: "" },
                ],
              },
              {
                id: "shot_dc4",
                title: "Sting — final line",
                summary: "Investigator closes",
                plateFile: "",
                beats: [
                  {
                    id: "beat_dc4_1",
                    speaker: "True crime investigator",
                    text: "Some mysteries stay behind closed doors.",
                  },
                ],
                sfx: [
                  { id: "sfx_dc4_1", label: "Door latch", notes: "" },
                  { id: "sfx_dc4_2", label: "Room tone drop", notes: "" },
                ],
              },
            ],
          },
        ],
        updatedAt: new Date().toISOString(),
      }),
      config: {
        styleId: "doc",
        ...docIntroOutroPrompts(),
        shotPlans: [
          {
            shotId: "shot_dc1",
            placeKey: "g:place_1786102852910.png",
            placeName: "Parliament committee room",
            cast: ["True crime investigator"],
            note: "Interview portrait. Cold blue rainy-night noir lighting on investigator face.",
          },
          {
            shotId: "shot_dc2",
            placeKey: "g:place_1786102868429.png",
            placeName: "Farmhouse kitchen",
            cast: ["Ancient historian", "True crime investigator"],
            note: "Historian with stone tablet prop. Investigator off to side taking notes.",
          },
          {
            shotId: "shot_dc3",
            placeKey: "g:place_1786102840263.png",
            placeName: "Hospital waiting room",
            cast: ["True crime investigator"],
            note: "Investigator pointing at blank TV screen as if it shows footage.",
          },
          {
            shotId: "shot_dc4",
            placeKey: "g:place_1786102852910.png",
            placeName: "Parliament committee room",
            cast: ["True crime investigator"],
            note: "Close interview portrait. Grave delivery.",
          },
        ],
        sfxPrompts: {
          sfx_intro_theme: "Documentary opener sting, tense piano note, rain implied",
          sfx_intro_whoosh: "Title card whoosh, subtle news package",
          sfx_outro_sting: "Documentary out sting, low piano resolve",
          sfx_dc1_1: "Rain on window pane, noir interview room",
          sfx_dc1_2: "Tape recorder button click, old microcassette",
          sfx_dc2_1: "Old book page turn, dusty paper",
          sfx_dc2_2: "Pen scratch on notepad, interview room",
          sfx_dc3_1: "VHS static burst, brief analog glitch",
          sfx_dc3_2: "Documentary reveal sting, low brass hit",
          sfx_dc4_1: "Closet door latch click, close mic",
          sfx_dc4_2: "Room tone drop to silence, documentary end",
        },
      },
    },
  ],
  music_video: [
    {
      baseSlug: "Neon_rooftop_verse",
      campaignLabel: "Neon rooftop verse",
      seed: musicVideoNeonSeed,
      config: {
        styleId: "music_video",
        ...mvIntroOutroPrompts(),
        shotPlans: [
          {
            shotId: "shot_mv1",
            placeKey: "g:place_1786103184644.png",
            placeName: "Rooftop skyline stage",
            cast: ["Classic Rock star"],
            note:
              "Wide performance shot. Classic Rock star with guitar on rooftop, city bokeh, bold music-video grade, dramatic lighting.",
          },
          {
            shotId: "shot_mv2",
            placeKey: "g:place_1786103104802.png",
            placeName: "Bathroom mirror lip-sync",
            cast: ["Hip-Hop rapper"],
            note:
              "Mirror lip-sync close. Hip-Hop rapper in steam-edge bathroom, harsh bulb, performance energy.",
          },
          {
            shotId: "shot_mv3",
            placeKey: "g:place_1786103201457.png",
            placeName: "Liquid mirror stage",
            cast: ["Synthwave singer"],
            note:
              "Chorus hero shot. Synthwave singer on reflective floor, neon pink cyan glow, keytar.",
          },
          {
            shotId: "shot_mv4",
            placeKey: "g:place_1786103027844.png",
            placeName: "Arena before doors",
            cast: ["Heavy Metal singer"],
            note:
              "Breakdown scream. Heavy Metal singer alone on empty arena stage, spotlight centre.",
          },
          {
            shotId: "shot_mv5",
            placeKey: "g:place_1786103089617.png",
            placeName: "Chapel acoustic set",
            cast: ["Delta Bluesman"],
            note:
              "Bridge acoustic. Delta Bluesman with resonator guitar, stained glass colour on floor.",
          },
          {
            shotId: "shot_mv6",
            placeKey: "g:place_1786102997669.png",
            placeName: "Neon beach night",
            cast: ["Reggae artist"],
            note:
              "Final chorus. Reggae artist on neon shore, pink sand cyan waves, peaceful performance face.",
          },
        ],
        sfxPrompts: MV_SFX,
      },
    },
  ],
  deepfake: [
    {
      baseSlug: "Andrew_French_solo",
      campaignLabel: "Andrew French solo",
      seed: deepfakeAndrewSoloSeed,
      config: {
        styleId: "deepfake",
        ...dfIntroOutroPrompts(),
        shotPlans: [
          {
            shotId: "shot_af1",
            placeKey: "g:place_1786104245797.png",
            placeName: "Backyard premiere",
            cast: ["Andrew French"],
            note:
              "Wide shot. Andrew French locked identity alone on suburban backyard red carpet, Collingwood supporter grin, cheap satin carpet on lawn, fairy lights. Photographic studio lighting, believable skin pores, slight uncanny smoothness. One person only.",
          },
          {
            shotId: "shot_af2",
            placeKey: "g:place_1786104226559.png",
            placeName: "Barbecue snag station",
            cast: ["Andrew French"],
            note:
              "Medium shot. Andrew French alone at barbecue holding tongs, proud host grin, charcoal snags on plate, marble kitchen backdrop, bright studio light. Locked face identity. One person only.",
          },
          {
            shotId: "shot_af3",
            placeKey: "g:place_1786104211379.png",
            placeName: "Press line",
            cast: ["Andrew French"],
            note:
              "Close portrait. Andrew French alone leaning into press microphone, larrikin smirk, flash bulbs, photographic uncanny face lock. One person only.",
          },
          {
            shotId: "shot_af4",
            placeKey: "g:place_1786104195380.png",
            placeName: "VIP lawn step-and-repeat",
            cast: ["Andrew French"],
            note:
              "Medium portrait. Andrew French alone in Collingwood scarf at step-and-repeat banner, arms crossed, Aussie bloke pride, VIP lounge lawn, believable materials. One person only.",
          },
        ],
        sfxPrompts: AF_SOLO_SFX,
      },
    },
    {
      baseSlug: "Andrew_Margot_backyard_premiere",
      campaignLabel: "Andrew Margot backyard premiere",
      seed: deepfakeAndrewMargotSeed,
      config: {
        styleId: "deepfake",
        ...dfIntroOutroPrompts(),
        shotPlans: [
          {
            shotId: "shot_am1",
            placeKey: "g:place_1786104245797.png",
            placeName: "Backyard premiere",
            cast: ["Andrew French", "Margot Robbie"],
            note:
              "Wide shot. Suburban Australian backyard dressed as a red carpet premiere. Andrew French locked identity, Collingwood supporter grin, cheap satin red carpet on lawn, fairy lights. Margot Robbie locked Hollywood portrait, polished grin, slight uncanny smoothness, stepping around dog poo. Photographic studio lighting, believable skin pores.",
          },
          {
            shotId: "shot_am2",
            placeKey: "g:place_1786104195380.png",
            placeName: "VIP lawn step-and-repeat",
            cast: ["Andrew French", "Margot Robbie"],
            note:
              "Two-shot. Andrew French in Collingwood scarf beside Margot Robbie in heels on uneven grass. Step-and-repeat banner says RESERVOIR PREMIERE. Photoreal uncanny face lock, believable materials.",
          },
          {
            shotId: "shot_am3",
            placeKey: "g:place_1786104226559.png",
            placeName: "Barbecue snag station",
            cast: ["Margot Robbie", "Andrew French"],
            note:
              "Close two-shot at barbecue. Charcoal snags on metal plate. Margot Robbie horrified polite smile. Andrew French proud Aussie host pointing tongs. Kitchen marble backdrop, bright studio light.",
          },
          {
            shotId: "shot_am4",
            placeKey: "g:place_1786104211379.png",
            placeName: "Press line",
            cast: ["Andrew French", "Margot Robbie"],
            note:
              "Medium press-line portrait. Andrew French leaning into microphone, larrikin smirk. Margot Robbie deadpan beside him. Flash bulbs, slight uncanny smoothness on both locked faces.",
          },
        ],
        sfxPrompts: AM_SFX,
      },
    },
    {
      baseSlug: "Self_checkout_meltdown",
      campaignLabel: "Self checkout meltdown",
      seed: deepfakeCheckoutSeed,
      config: {
        styleId: "deepfake",
        ...dfIntroOutroPrompts(),
        shotPlans: [
          {
            shotId: "shot_df1",
            placeKey: "g:place_1786104226559.png",
            placeName: "Celebrity kitchen",
            cast: ["Gordon Ramsay"],
            note:
              "Wide shot. Gordon Ramsay furious at self-checkout screen in marble kitchen, chef whites, photoreal uncanny face lock.",
          },
          {
            shotId: "shot_df2",
            placeKey: "g:place_1786104195380.png",
            placeName: "Airport VIP lounge",
            cast: ["Keanu Reeves", "Gordon Ramsay"],
            note:
              "Two-shot. Keanu Reeves deadpan whisper. Gordon still red-faced. Believable studio lighting.",
          },
          {
            shotId: "shot_df3",
            placeKey: "g:place_1786104245797.png",
            placeName: "Penthouse living room",
            cast: ["Taylor Swift"],
            note:
              "Close portrait. Taylor Swift devastated over phone, dramatic tearful face, city window dusk.",
          },
          {
            shotId: "shot_df4",
            placeKey: "g:place_1786104211379.png",
            placeName: "White House briefing room",
            cast: ["Gordon Ramsay"],
            note:
              "Close rage portrait. Gordon pointing at burnt toast and checkout screen composite energy.",
          },
        ],
        sfxPrompts: DF_SFX,
      },
    },
  ],
  photoreal: [
    {
      baseSlug: "Pub_snug_smoko",
      campaignLabel: "Pub snug smoko",
      seed: photorealSmokoSeed,
      config: {
        styleId: "photoreal",
        ...prIntroOutroPrompts(),
        shotPlans: [
          {
            shotId: "shot_pr1",
            placeKey: "g:place_1786104395700.png",
            placeName: "Pub snug",
            cast: ["Bricklayer on smoko"],
            note:
              "Wide establishing. English pub snug, dark wood, empty glasses, bricklayer in hi-vis entering, overcast daylight through door.",
          },
          {
            shotId: "shot_pr2",
            placeKey: "g:place_1786104395700.png",
            placeName: "Pub snug",
            cast: ["Bricklayer on smoko"],
            note:
              "Medium at bar. Meat pie grease on chin, sun-weathered face, believable materials, natural light.",
          },
          {
            shotId: "shot_pr3",
            placeKey: "g:place_1786104395700.png",
            placeName: "Pub snug",
            cast: ["Night taxi driver", "Bricklayer on smoko"],
            note:
              "Two-shot at bar end. Taxi driver tired eyes, cab-light glow on face, ordinary clothes.",
          },
          {
            shotId: "shot_pr4",
            placeKey: "g:place_1786104363922.png",
            placeName: "Wheat field lane",
            cast: ["Bricklayer on smoko"],
            note:
              "Close walking out. Bricklayer with coffee cup, hedgerow lane, cumulus sky, photoreal portrait.",
          },
        ],
        sfxPrompts: PR_SFX,
      },
    },
  ],
};

/** Pick the next un-archived gag — never repeats a story already on disk. */
export function pickNextCursorGag(styleId: ShowStyleId): CursorGagCatalogEntry | null {
  const catalog = CURSOR_GAG_CATALOG[styleId];
  if (!catalog?.length) return null;

  const used = archiveUsedBaseSlugs(styleId);
  return catalog.find((g) => !used.has(g.baseSlug)) ?? null;
}

/** How many fresh test gags remain for this style. */
export function remainingCursorGags(styleId: ShowStyleId): number {
  const catalog = CURSOR_GAG_CATALOG[styleId];
  if (!catalog?.length) return 0;
  const used = archiveUsedBaseSlugs(styleId);
  return catalog.filter((g) => !used.has(g.baseSlug)).length;
}

export function cursorPopulateConfigForStory(
  story: CrashStoryDoc,
): CursorPopulateConfig | null {
  const promptCfg = readPromptPopulateConfig(story.styleId);
  if (
    promptCfg &&
    promptCfg.campaignLabel.trim() === story.campaignLabel.trim()
  ) {
    return promptCfg.config;
  }

  const catalog = CURSOR_GAG_CATALOG[story.styleId];
  if (!catalog?.length) return null;

  const slug = campaignBaseSlug(story.campaignLabel);
  const hit =
    catalog.find((g) => g.baseSlug === slug) ||
    catalog.find((g) => g.campaignLabel === story.campaignLabel);
  return hit?.config ?? catalog[0].config;
}

export function cursorCastKeys(styleId: ShowStyleId): Record<string, string> {
  const live = liveCastKeys(styleId);
  if (Object.keys(live).length) return live;

  if (styleId === "skidmarks") return SKIDMARKS_CAST;
  if (styleId === "sunny_banks") return SUNNY_CAST;
  if (styleId === "doc") {
    return {
      "True crime investigator": "g:thumb_1786096296024.png",
      "Ancient historian": "g:thumb_1786096175505.png",
    };
  }
  if (styleId === "music_video") {
    return {
      "Classic Rock star": "g:thumb_1786095805679.png",
      "Hip-Hop rapper": "g:thumb_1786095830422.png",
      "Synthwave singer": "g:thumb_1786095788588.png",
      "Heavy Metal singer": "g:thumb_1786095921614.png",
      "Delta Bluesman": "g:thumb_1786095901589.png",
      "Reggae artist": "g:thumb_1786095860652.png",
    };
  }
  if (styleId === "deepfake") {
    return {
      "Andrew French": "g:upload_1786109675899.jpg",
      "Margot Robbie": "g:thumb_1786105533746.png",
      "Gordon Ramsay": "g:thumb_1786095768739.png",
      "Keanu Reeves": "g:thumb_1786095701357.png",
      "Taylor Swift": "g:thumb_1786095718936.png",
    };
  }
  if (styleId === "photoreal") {
    return {
      "Bricklayer on smoko": "g:thumb_1786096565453.png",
      "Night taxi driver": "g:thumb_1786096547087.png",
    };
  }
  return {};
}
