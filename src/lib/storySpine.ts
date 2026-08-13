/** Locked Skidmarks episode spine — same path every episode. */
export const STORY_SPINE_STAGES = [
  { n: 1, title: "He shows up", note: "Intro" },
  { n: 2, title: "Gets worse", note: "Established as an arsehole" },
  { n: 3, title: "Keeps proving it", note: "Run of small cruelties" },
  { n: 4, title: "Gets a beat down", note: "Partial — about ¾, not finished" },
  { n: 5, title: "Gets a fake win", note: "Unearned golden gift" },
  { n: 6, title: "Believes it", note: "Thinks he deserves it" },
  { n: 7, title: "Loses it", note: "Ripped away" },
  { n: 8, title: "Gets smashed", note: "Real ending — credits roll" },
  { n: 9, title: "The end state", note: "Gone or frozen on that frame" },
] as const;

export type StorySpineStageN = (typeof STORY_SPINE_STAGES)[number]["n"];
