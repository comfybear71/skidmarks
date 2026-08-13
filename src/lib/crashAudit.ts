import fs from "fs";
import path from "path";
import { readCrashStory } from "./crashStory";
import { storyAudioPath } from "./crashStorySpeak";
import { readCrashSpxManifest, crashSpxFilePath } from "./crashSpx";
import { readCrashVoiceManifest } from "./crashVoice";
import { CRASH_DIR } from "./paths";
import { readStyleCardManifest, resolveStyleCardThumbPath } from "./styleCardThumbs";
import {
  readWorldCardManifest,
  resolveWorldCardThumbPath,
} from "./worldCardThumbs";
import type { ShowStyleId } from "./showStylePresets";
import { getVoiceLibraryEntry, resolveKeeperFile } from "./voiceLibrary";

export type AuditRow = {
  area: string;
  name: string;
  status: "ok" | "missing" | "warn";
  detail: string;
};

export function auditSunnyBanks(styleId: ShowStyleId = "sunny_banks"): AuditRow[] {
  const rows: AuditRow[] = [];

  const cast = readStyleCardManifest(styleId);
  for (const [key, meta] of Object.entries(cast)) {
    const fp = resolveStyleCardThumbPath(styleId, key);
    rows.push({
      area: "Character",
      name: meta.name || key,
      status: fp ? "ok" : "missing",
      detail: fp ? path.basename(fp) : "thumb png missing",
    });
  }

  const world = readWorldCardManifest(styleId);
  for (const [key, meta] of Object.entries(world)) {
    const fp = resolveWorldCardThumbPath(styleId, key);
    rows.push({
      area: "Location",
      name: meta.name || key,
      status: fp ? "ok" : "missing",
      detail: fp ? path.basename(fp) : "place png missing",
    });
  }

  const voices = readCrashVoiceManifest(styleId);
  for (const slot of Object.values(voices)) {
    const lib = getVoiceLibraryEntry(styleId, slot.castName);
    const keeper = lib ? resolveKeeperFile(lib) : null;
    const voiceId = slot.approvedVoiceId?.trim();
    let status: AuditRow["status"] = "ok";
    let detail = voiceId ? `EL voice ${voiceId.slice(0, 8)}…` : "no EL voice_id";
    if (!slot.approvedAttemptId) {
      status = "missing";
      detail = "not approved";
    } else if (!voiceId) {
      status = "warn";
      detail = keeper ? "keeper mp3 only — needs EL lock" : "keeper missing";
    }
    if (keeper) detail += ` · keeper ok`;
    else if (slot.approvedAttemptId) {
      status = status === "ok" ? "warn" : status;
      detail += " · no keeper file";
    }
    rows.push({
      area: "Voice",
      name: slot.castName,
      status,
      detail,
    });
  }

  const story = readCrashStory(styleId);
  rows.push({
    area: "Style",
    name: "Campaign",
    status: story.campaignLabel ? "ok" : "warn",
    detail: story.campaignLabel || "no label",
  });

  if (story.intro.logoFile) {
    const introPath = path.join(CRASH_DIR, "gen", story.intro.logoFile);
    rows.push({
      area: "Story",
      name: "Intro card",
      status: fs.existsSync(introPath) ? "ok" : "missing",
      detail: story.intro.logoFile,
    });
  }

  if (story.outro.logoFile) {
    const outroPath = path.join(CRASH_DIR, "gen", story.outro.logoFile);
    rows.push({
      area: "Story",
      name: "Outro card",
      status: fs.existsSync(outroPath) ? "ok" : "missing",
      detail: story.outro.logoFile,
    });
  }

  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      const platePath = sh.plateFile
        ? path.join(CRASH_DIR, "gen", sh.plateFile)
        : null;
      rows.push({
        area: "Plate",
        name: sh.title || sh.id,
        status:
          platePath && fs.existsSync(platePath)
            ? "ok"
            : sh.plateFile
              ? "missing"
              : "warn",
        detail: sh.plateFile || "empty plateFile",
      });

      for (const beat of sh.beats) {
        if (!beat.text.trim()) continue;
        const audio = storyAudioPath(styleId, beat.id);
        rows.push({
          area: "Dialogue",
          name: `${beat.speaker}: ${beat.text.slice(0, 36)}…`,
          status: audio ? "ok" : "missing",
          detail: audio
            ? path.basename(audio)
            : beat.voiceFile || "mp3 missing",
        });
      }

      for (const sfx of sh.sfx) {
        const spx = sfx.spxId
          ? readCrashSpxManifest(styleId).find((i) => i.id === sfx.spxId)
          : null;
        const file =
          spx && crashSpxFilePath(styleId, "sfx", spx.fileName);
        rows.push({
          area: "SFX",
          name: sfx.label,
          status: file ? "ok" : sfx.spxId ? "missing" : "warn",
          detail: sfx.spxId || "no spxId",
        });
      }
    }
  }

  for (const sfx of [...story.intro.sfx, ...story.outro.sfx]) {
    const spx = sfx.spxId
      ? readCrashSpxManifest(styleId).find((i) => i.id === sfx.spxId)
      : null;
    const file = spx && crashSpxFilePath(styleId, "sfx", spx.fileName);
    rows.push({
      area: "SFX",
      name: `[${sfx.label}] bookend`,
      status: file ? "ok" : sfx.spxId ? "missing" : "warn",
      detail: sfx.spxId || "no spxId",
    });
  }

  return rows;
}

export function formatAuditLog(rows: AuditRow[]): string {
  const ok = rows.filter((r) => r.status === "ok").length;
  const miss = rows.filter((r) => r.status === "missing").length;
  const warn = rows.filter((r) => r.status === "warn").length;
  const lines = [
    `Sunny Banks audit — ${ok} ok · ${warn} warn · ${miss} missing`,
    "",
  ];
  let lastArea = "";
  for (const r of rows) {
    if (r.area !== lastArea) {
      lines.push(`## ${r.area}`);
      lastArea = r.area;
    }
    const mark = r.status === "ok" ? "✓" : r.status === "warn" ? "!" : "✗";
    lines.push(`  ${mark} ${r.name} — ${r.detail}`);
  }
  return lines.join("\n");
}
