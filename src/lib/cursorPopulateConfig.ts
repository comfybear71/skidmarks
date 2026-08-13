/** Server-only populate helpers — do not import from client components. */
export type {
  CursorPopulateConfig,
  CursorShotPlan,
} from "./cursorPopulateTypes";
export { CURSOR_TOUR_STYLE } from "./cursorPopulateTypes";

export {
  cursorCastKeys,
  cursorPopulateConfigForStory,
  pickNextCursorGag,
  CURSOR_GAG_CATALOG,
} from "./cursorGagCatalog";

import { CURSOR_GAG_CATALOG } from "./cursorGagCatalog";
import type { CursorPopulateConfig } from "./cursorPopulateTypes";
import type { ShowStyleId } from "./showStylePresets";

/** First catalog gag for a style (legacy callers). */
export function cursorPopulateConfig(
  styleId: ShowStyleId,
): CursorPopulateConfig | null {
  return CURSOR_GAG_CATALOG[styleId]?.[0]?.config ?? null;
}

/** Client-safe re-exports for toolbar / tour */
export { CURSOR_STYLE_OPTIONS } from "./cursorPopulateTypes";
