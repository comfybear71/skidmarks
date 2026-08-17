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

export { SCRATCH_SCORE_OPTIONS, scoreSummary, toggleScoreTag } from "./scorecard";
export type { ScratchScoreOption } from "./scorecard";

export { SCRATCH_STRESS_WORDS, findStressHits, stressHitCount } from "./dictionary";
export type { ScratchDictHit } from "./dictionary";
