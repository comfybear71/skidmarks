export type {
  ScratchBackendId,
  ScratchBenchRun,
  ScratchBenchSession,
  ScratchChaosId,
  ScratchOverlay,
  ScratchOverlayArrow,
  ScratchOverlayBox,
  ScratchRunKind,
  ScratchScoreTag,
} from "./types";

export {
  SCRATCH_BENCH_MAX_RUNS,
  SCRATCH_BENCH_STORAGE_KEY,
  appendBenchRun,
  clearBenchRuns,
  emptyBenchSession,
  loadBenchSession,
  saveBenchSession,
  setBenchChaos,
  updateBenchRunTags,
} from "./runLog";

export {
  SCRATCH_CHAOS_PRESETS,
  chaosPreset,
  injectChaosMotion,
  injectChaosStill,
} from "./chaosPresets";
export type { ScratchChaosPreset } from "./chaosPresets";

export {
  SCRATCH_SCORE_OPTIONS,
  SCRATCH_STRESS_TAGS,
  runVerdict,
  scoreSummary,
  stressFailCount,
  toggleScoreTag,
} from "./scorecard";
export type { ScratchScoreOption } from "./scorecard";

export { SCRATCH_STRESS_WORDS, findStressHits, stressHitCount } from "./dictionary";
export type { ScratchDictHit } from "./dictionary";

export {
  SCRATCH_BIBLE_DEFAULT_STYLE,
  SCRATCH_PROMPT_BIBLE,
  applyBibleTokens,
  composeBibleBlocks,
} from "./promptBible";
export type {
  ScratchBibleEntry,
  ScratchBibleSection,
  ScratchBibleSectionId,
} from "./promptBible";

export {
  SCRATCH_DND_MIME,
  bedroomFurnitureLine,
  dropPercents,
  expandScratchLayoutMarks,
  scratchHasDirectorLetter,
  stripScratchLayoutMarks,
  isScratchBedroomPlace,
  keepScratchPositionLines,
  mergePositionIntoStaging,
  positionPromptLine,
  readScratchDrag,
  setScratchDrag,
  upsertPlacement,
} from "./padDrop";
export type {
  ScratchDragAssetType,
  ScratchDragPayload,
  ScratchPadPlacement,
} from "./padDrop";

export {
  formatPositioningBlock,
  generateScratchPrompt,
  mergePlacementsIntoStaging,
  stagingActionBody,
  stagingCameraBlock,
} from "./promptFormatter";
export type { ScratchPromptFormatConfig } from "./promptFormatter";

export { downloadScratchRunsCsv, scratchRunsToCsv } from "./csvExport";
