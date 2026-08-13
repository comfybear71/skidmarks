export type CrashPresetId =
  | "in_front_of_nose"
  | "side_only"
  | "rear_only"
  | "hell_smash"
  | "blank";

export const CRASH_PRESETS: {
  id: CrashPresetId;
  label: string;
  blurb: string;
}[] = [
  {
    id: "in_front_of_nose",
    label: "In front of the nose",
    blurb: "Wide. Huge vehicle. Tiny person IN THE PATH ahead of the grille.",
  },
  {
    id: "side_only",
    label: "Side only",
    blurb: "Flat side of the bus. Arse cropped. Nobody in frame.",
  },
  {
    id: "rear_only",
    label: "Rear only",
    blurb: "Dead-on back of the bus. No side. Nobody in frame.",
  },
  {
    id: "hell_smash",
    label: "Hell smash",
    blurb: "Torn apart / demons / Skidmarks ending. Gore the AI softens.",
  },
  {
    id: "blank",
    label: "Blank board",
    blurb: "Empty canvas — drop your own layers.",
  },
];
