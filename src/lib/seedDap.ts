import fs from "fs";
import path from "path";
import {
  createCharacter,
  getCharacter,
  listCharacters,
  saveCharacter,
} from "./characters";
import { CHARACTERS_DIR, SKIDMARKS_ROOT } from "./paths";
import { emptyFaceAttempt, emptyVoiceAttempt } from "./types";

const DAP_VOICE_ID = "cNKYwZuX0PccjXoaCBBr";

/**
 * Import locked DAP into Character Lab (face + ElevenLabs voice_id).
 * Idempotent — won't duplicate if DAP already exists.
 */
export function seedDap(): {
  characterId: string;
  created: boolean;
  message: string;
} {
  const existing = listCharacters().find(
    (c) =>
      c.name === "DAP" ||
      c.approvedVoiceId === DAP_VOICE_ID ||
      c.name.toLowerCase().includes("double anal"),
  );
  if (existing) {
    return {
      characterId: existing.id,
      created: false,
      message: `DAP already in Lab (${existing.id})`,
    };
  }

  const faceSrc = path.join(
    SKIDMARKS_ROOT,
    "characters",
    "DAP",
    "art",
    "dap_canonical_v5b_FACELOCK.png",
  );
  if (!fs.existsSync(faceSrc)) {
    throw new Error(`DAP face lock missing: ${faceSrc}`);
  }

  const c = createCharacter({
    name: "DAP",
    pastNote:
      "Double Anal P — the Über-prick. Arrogant pedant, gaunt human wreck. Recurring series bastard. Face + voice already locked for the show.",
    tormentScratch:
      "Same loop every episode: materialise → smell → mask slips → lecture → boot → undeserved gift → blind → stripped → boot again → WHACK → narrator.",
    voiceDescription:
      "Thin nasal precise English male. Calm measured contempt. Not whiny. Reedy, over-enunciated, unhurried. Locked show voice L — smug failure.",
    approved: true,
    approvedVoiceId: DAP_VOICE_ID,
  });

  const face = emptyFaceAttempt({
    status: "approved",
    note: "Canonical face lock — dap_canonical_v5b_FACELOCK.png",
    styleRealism: 60,
    source: "upload",
  });
  const destDir = path.join(CHARACTERS_DIR, c.id, "faces");
  fs.mkdirSync(destDir, { recursive: true });
  face.fileName = `${face.id}.png`;
  fs.copyFileSync(faceSrc, path.join(destDir, face.fileName));

  const voice = emptyVoiceAttempt({
    status: "approved",
    description: c.voiceDescription,
    previewText: "Locked show voice — L smug failure.",
    generatedVoiceId: DAP_VOICE_ID,
    voiceId: DAP_VOICE_ID,
    fileName: "",
  });

  const next = saveCharacter({
    ...getCharacter(c.id)!,
    faceAttempts: [face],
    approvedFaceId: face.id,
    approved: true,
    voiceAttempts: [voice],
    approvedVoiceAttemptId: voice.id,
    approvedVoiceId: DAP_VOICE_ID,
  });

  return {
    characterId: next.id,
    created: true,
    message: "DAP imported with face lock + voice_id cNKYwZuX0PccjXoaCBBr",
  };
}
