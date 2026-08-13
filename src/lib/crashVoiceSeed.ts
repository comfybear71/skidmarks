import fs from "fs";
import path from "path";
import { CHARACTERS_FILE, CRASH_DIR } from "./paths";
import { readStyleCardManifest } from "./styleCardThumbs";
import type { CrashVoiceSlot } from "./crashVoice";
import type { ShowStyleId } from "./showStylePresets";
import { emptyVoiceAttempt } from "./types";

/** Wire Skidmarks cast thumbs → voice slots (Darryl keeper from Character Lab). */
export function seedSkidmarksVoiceManifest(): void {
  const styleId: ShowStyleId = "skidmarks";
  const root = path.join(CRASH_DIR, "voice", styleId);
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });

  const manifestPath = path.join(root, "manifest.json");
  let existing: Record<string, CrashVoiceSlot> = {};
  if (fs.existsSync(manifestPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<
        string,
        CrashVoiceSlot
      >;
    } catch {
      existing = {};
    }
  }

  const cards = readStyleCardManifest(styleId);
  let darrylVoiceId = "";
  let darrylDesc =
    "Aussie mongrel bastard, middle-aged male, greasy, nasal, low-life bar rat, wet mouth, not warm, not polished — Aussie accent";

  if (fs.existsSync(CHARACTERS_FILE)) {
    try {
      const chars = JSON.parse(fs.readFileSync(CHARACTERS_FILE, "utf8")) as {
        characters?: {
          name?: string;
          voiceDescription?: string;
          voiceAttempts?: { status?: string; voiceId?: string }[];
        }[];
      };
      const darryl = chars.characters?.find((c) =>
        (c.name || "").toLowerCase().includes("darryl"),
      );
      if (darryl?.voiceDescription) darrylDesc = darryl.voiceDescription;
      const approved = darryl?.voiceAttempts?.find((v) => v.status === "approved");
      if (approved?.voiceId) darrylVoiceId = approved.voiceId;
    } catch {
      /* ignore */
    }
  }

  for (const [castKey, meta] of Object.entries(cards)) {
    if (existing[castKey]?.approvedVoiceId) continue;

    const isDarryl = meta.name.includes("Darryl");
    const attempt = emptyVoiceAttempt({
      description: isDarryl ? darrylDesc : meta.brief || meta.name,
      previewText: isDarryl
        ? "I'm not saying women shouldn't have opinions. I'm just saying they should keep them in their heads."
        : `${meta.name} preview line.`,
      generatedVoiceId: isDarryl ? darrylVoiceId : "",
      voiceId: isDarryl ? darrylVoiceId : "",
      status: isDarryl && darrylVoiceId ? "approved" : "pending",
    });

    existing[castKey] = {
      castKey,
      castName: meta.name,
      voiceDescription: isDarryl ? darrylDesc : meta.brief || meta.name,
      approvedAttemptId: isDarryl && darrylVoiceId ? attempt.id : "",
      approvedVoiceId: isDarryl ? darrylVoiceId : "",
      attempts: isDarryl && darrylVoiceId ? [attempt] : [],
    };
  }

  fs.writeFileSync(manifestPath, JSON.stringify(existing, null, 2));
}

/** Wire style-card faces → voice slots (keeps approved voices). */
export function seedStyleVoiceFromCards(styleId: ShowStyleId): void {
  const root = path.join(CRASH_DIR, "voice", styleId);
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });

  const manifestPath = path.join(root, "manifest.json");
  let existing: Record<string, CrashVoiceSlot> = {};
  if (fs.existsSync(manifestPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<
        string,
        CrashVoiceSlot
      >;
    } catch {
      existing = {};
    }
  }

  const cards = readStyleCardManifest(styleId);
  for (const [castKey, meta] of Object.entries(cards)) {
    if (!meta.name?.trim()) continue;
    if (existing[castKey]?.approvedVoiceId) continue;
    existing[castKey] = {
      castKey,
      castName: meta.name,
      voiceDescription: meta.brief || meta.name,
      approvedAttemptId: "",
      approvedVoiceId: "",
      attempts: [],
    };
  }

  fs.writeFileSync(manifestPath, JSON.stringify(existing, null, 2));
}

export function seedVoiceManifestForStyle(styleId: ShowStyleId): void {
  if (styleId === "skidmarks") seedSkidmarksVoiceManifest();
  else seedStyleVoiceFromCards(styleId);
}
