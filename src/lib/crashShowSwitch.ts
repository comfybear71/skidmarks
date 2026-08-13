/**
 * Toolbar / Script desk show picker.
 * Changing show must actually switch — never stay locked to another show's open pack.
 */
import { clearActiveEpisode, readActiveEpisode } from "./crashActiveEpisode";
import { clearSceneKitDraft } from "./crashSceneKitFields";
import { clearScriptDeskCastKeys } from "./crashScriptFields";
import { dispatchStorySaved } from "./crashStyleSync";
import { saveShowStyleId, type ShowStyleId } from "./showStylePresets";

export function switchCrashLabShow(id: ShowStyleId): void {
  saveShowStyleId(id);
  const ep = readActiveEpisode();
  if (ep && ep.styleId !== id) {
    clearActiveEpisode();
  }
  if (!readActiveEpisode()) {
    void clearSceneKitDraft(id);
    clearScriptDeskCastKeys();
  }
  dispatchStorySaved();
}
