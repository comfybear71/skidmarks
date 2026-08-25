/** Scratch boundary-testing bench — shared types (boilerplate). */

export type ScratchBackendId = "siray-spicy" | "siray-i2v" | "grok-i2v" | "xai" | "ltx" | "unknown";

export type ScratchRunKind = "still" | "clip" | "plate-redo";

export type ScratchScoreTag =
  | "pass"
  | "fail"
  | "close"
  | "wardrobe"
  | "anatomy"
  | "pose"
  | "face"
  | "place"
  | "speech"
  | "style"
  | "chaos"
  | "eye"
  | "fingers"
  | "melt"
  | "ghost";

export type ScratchChaosId =
  | "none"
  | "wardrobe-melt"
  | "gravity-off"
  | "too-close"
  | "wrong-room"
  | "mirror-trap"
  | "crowd-bleed"
  | "prop-possession";

export type ScratchOverlayKind = "box" | "arrow";

export type ScratchOverlayBox = {
  id: string;
  kind: "box";
  /** Normalized 0–1 relative to plate. */
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
};

export type ScratchOverlayArrow = {
  id: string;
  kind: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
};

export type ScratchOverlay = ScratchOverlayBox | ScratchOverlayArrow;

export type ScratchBenchRun = {
  id: string;
  at: number;
  kind: ScratchRunKind;
  backend: ScratchBackendId;
  chaosId: ScratchChaosId;
  /** Position / staging prompt used for still. */
  positionPrompt?: string;
  /** LTX / motion prompt used for clip. */
  motionPrompt?: string;
  plateUrl?: string;
  clipUrl?: string;
  /** Show id + pack/job folder so history can print the Blob path. */
  styleId?: string;
  mediaFolder?: string;
  plateFile?: string;
  clipFile?: string;
  tags: ScratchScoreTag[];
  note?: string;
  overlays?: ScratchOverlay[];
  /** Pad drop snapshot for rehydrate / score context. */
  placements?: { name: string; xPercent: number; yPercent: number }[];
  environment?: string;
  dialogue?: string;
  /** Full Draw send — sealed with the run. */
  sendPrompt?: string;
  sendLayers?: { id: string; label: string; text: string }[];
  faceLooks?: { name: string; look: string }[];
};

export type ScratchBenchSession = {
  version: 1;
  chaosId: ScratchChaosId;
  runs: ScratchBenchRun[];
  /** Last score tags applied to newest run. */
  lastTags: ScratchScoreTag[];
};
