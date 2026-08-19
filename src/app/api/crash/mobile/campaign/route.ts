import path from "path";
import { NextResponse } from "next/server";
import { compositeShotPlate } from "@/lib/mobilePlates";
import { hydrateMobilePackOnDisk, readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { uploadMobileMedia } from "@/lib/mobileMediaStore";
import { patchMobileGenJob, readMobileGenJob, type MobileClipUnit } from "@/lib/mobileGenJob";
import { mobileCandidateFolders, mobileMediaFolder } from "@/lib/mobileJobFolder";
import { synthesizeStoryBeat } from "@/lib/crashStorySpeak";
import { resolveMobileBeatAudio } from "@/lib/resolveMobileBeatAudio";
import { ensureSpeakerVoiceCast } from "@/lib/scriptVoiceGen";
import { pinSpeakerLibraryVoice } from "@/lib/mobileVoiceReuse";
import { jobVoiceForSpeaker } from "@/lib/mobileJobVoices";
import { newId } from "@/lib/types";
import { CRASH_DIR } from "@/lib/paths";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";
import {
  CAMPAIGN_CLIP_COUNT,
  PLACEMENT_COUNT,
  buildCampaignTests,
  campaignBeatTitle,
  campaignImageMotion,
  campaignShotIdForBeat,
  campaignShotIndexForBeat,
  campaignShotTitle,
  campaignStaging,
  expandCampaignLines,
  type PlateLtxCampaign,
} from "@/lib/mobilePlateLtxCampaign";
import { approvedCandidateFileName } from "@/lib/mobileJobReady";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST { action: "start", jobId, speaker, sceneId, lines }
 *   — mint 20 solo plates (one character, one place). Each plate gets a
 *     SHORT beat and a LONG beat. MCU + wide longs are the duration PUSH.
 *     Does not wipe existing plates. Numbered tests T01–T40.
 * POST { action: "step", jobId }
 *   — one plate draw or one voice. Then queues 40 clips and sets phase animate.
 * POST { action: "score", jobId, testId, score, comment }
 *   — save 1–5 + note on that numbered test (plating, distance, artifacts).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      jobId?: string;
      speaker?: string;
      sceneId?: string;
      lines?: string | string[];
      testId?: string;
      score?: number;
      comment?: string;
    };
    const jobId = (body.jobId || "").trim();
    const action = (body.action || "step").trim().toLowerCase();
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    if (action === "score") {
      const campaign = job.plateLtxCampaign;
      if (!campaign) {
        return NextResponse.json({ error: "No placement campaign on this job" }, { status: 400 });
      }
      const testId = (body.testId || "").trim().toUpperCase();
      const test = (campaign.tests || []).find((t) => t.id === testId);
      if (!test) {
        return NextResponse.json({ error: "Unknown test id" }, { status: 400 });
      }
      const score = Number(body.score);
      if (!Number.isFinite(score) || score < 1 || score > 5) {
        return NextResponse.json({ error: "Score 1–5" }, { status: 400 });
      }
      const updated = await patchMobileGenJob(jobId, {
        plateLtxCampaign: {
          ...campaign,
          scores: {
            ...(campaign.scores || {}),
            [testId]: {
              score: Math.round(score),
              comment: String(body.comment || "").trim(),
              at: new Date().toISOString(),
            },
          },
        },
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (!job.folderName) {
      return NextResponse.json({ error: "Lock the episode first" }, { status: 400 });
    }

    if (action === "start") {
      const speaker = (body.speaker || "").trim();
      const sceneId = (body.sceneId || "").trim();
      if (!speaker || !sceneId) {
        return NextResponse.json({ error: "Pick one character and one place" }, { status: 400 });
      }
      if (!job.speakers.some((s) => s.trim().toLowerCase() === speaker.toLowerCase())) {
        return NextResponse.json({ error: "That character is not this job's CAST" }, { status: 400 });
      }
      const sceneRef = job.scenes.find((s) => s.id === sceneId);
      if (!sceneRef) {
        return NextResponse.json({ error: "That place is not on this job" }, { status: 400 });
      }
      if (!approvedCandidateFileName(job.locationCandidates, sceneId) && !sceneRef.worldThumbKey) {
        return NextResponse.json({ error: "Approve the location still first" }, { status: 400 });
      }
      if (!approvedCandidateFileName(job.castCandidates, speaker)) {
        return NextResponse.json({ error: "Approve that face first" }, { status: 400 });
      }
      const expanded = expandCampaignLines(
        Array.isArray(body.lines) ? body.lines : String(body.lines || ""),
      );
      if (expanded.error || expanded.lines.length !== CAMPAIGN_CLIP_COUNT) {
        return NextResponse.json(
          {
            error:
              expanded.error || "Need at least one spoken line for the placements.",
          },
          { status: 400 },
        );
      }
      const rawLines = expanded.lines;
      const bands = expanded.bands;

      await hydrateMobilePackOnDisk(job.styleId, job.folderName);
      const story = await readMobileStory(job.styleId, job.folderName);
      let working = story;
      let scene = working.scenes.find((sc) => sc.id === sceneId);
      if (!scene) {
        scene = {
          id: sceneRef.id,
          title: sceneRef.placeName,
          placeName: sceneRef.placeName,
          worldThumbKey: sceneRef.worldThumbKey || "",
          shots: [],
        };
        working = { ...working, scenes: [...working.scenes, scene] };
      }
      const place = scene.placeName || sceneRef.placeName;
      const shotIds: string[] = [];
      const beatIds: string[] = [];
      const newShots = Array.from({ length: PLACEMENT_COUNT }, (_, i) => {
        const shotId = newId("shot");
        shotIds.push(shotId);
        const staging = campaignStaging(i, speaker, place);
        const shortLine = rawLines[i * 2]!;
        const longLine = rawLines[i * 2 + 1]!;
        const shortBeat = newId("beat");
        const longBeat = newId("beat");
        beatIds.push(shortBeat, longBeat);
        const beat = (id: string, line: string) => ({
          id,
          speaker,
          text: line,
          imageMotion: campaignImageMotion({
            index: i,
            styleId: job.styleId,
            speaker,
            line,
          }),
        });
        return {
          id: shotId,
          title: campaignShotTitle(i),
          summary: staging,
          staging,
          plateFile: "",
          beats: [beat(shortBeat, shortLine), beat(longBeat, longLine)],
          sfx: [],
        };
      });
      const nextStory = {
        ...working,
        scenes: working.scenes.map((sc) =>
          sc.id === scene!.id ? { ...sc, shots: [...sc.shots, ...newShots] } : sc,
        ),
      };
      await writeMobileStory(nextStory, job.folderName);
      const tests = buildCampaignTests({
        shotIds,
        beatIds,
        lines: rawLines,
        bands,
      });
      const campaign: PlateLtxCampaign = {
        speaker,
        sceneId,
        sceneName: place,
        shotIds,
        beatIds,
        lines: rawLines,
        tests,
        scores: {},
        phase: "plating",
      };
      const updated = await patchMobileGenJob(jobId, {
        shots: [
          ...job.shots,
          ...shotIds.map((shotId) => ({ shotId, sceneId, plateFile: "" })),
        ],
        plateLtxCampaign: campaign,
        error: "",
        ...(job.phase === "error" || job.phase === "animate" || job.phase === "done"
          ? { phase: "review" as const }
          : {}),
      });
      return NextResponse.json({ ok: true, job: updated, started: true });
    }

    const campaign = job.plateLtxCampaign;
    if (!campaign || (campaign.phase !== "plating" && campaign.phase !== "voicing")) {
      return NextResponse.json({ ok: true, job, advanced: false });
    }

    await hydrateMobilePackOnDisk(job.styleId, job.folderName);
    let story = await readMobileStory(job.styleId, job.folderName);

    if (campaign.phase === "plating") {
      const nextIndex = campaign.shotIds.findIndex((id) => {
        const s = job.shots.find((x) => x.shotId === id);
        return !s?.plateFile;
      });
      if (nextIndex < 0) {
        const updated = await patchMobileGenJob(jobId, {
          plateLtxCampaign: { ...campaign, phase: "voicing", error: "" },
        });
        return NextResponse.json({ ok: true, job: updated, advanced: true });
      }
      const shotId = campaign.shotIds[nextIndex]!;
      const scene = story.scenes.find((sc) => sc.shots.some((sh) => sh.id === shotId));
      const shot = scene?.shots.find((sh) => sh.id === shotId);
      if (!scene || !shot) {
        throw new Error(`Campaign shot ${shotId} missing from the pack`);
      }
      try {
        const fileName = await compositeShotPlate(job.styleId, scene, shot, {
          silentCast: [],
          styleRealism: job.styleRealism,
          job,
        });
        try {
          await uploadMobileMedia({
            styleId: job.styleId,
            folderName: job.folderName,
            kind: "plates",
            localPath: path.join(CRASH_DIR, "gen", fileName),
          });
        } catch {
          /* still usable this request */
        }
        const platedStory = {
          ...story,
          scenes: story.scenes.map((sc) => ({
            ...sc,
            shots: sc.shots.map((sh) =>
              sh.id === shotId ? { ...sh, plateFile: fileName } : sh,
            ),
          })),
        };
        await writeMobileStory(platedStory, job.folderName);
        const shots = job.shots.map((s) =>
          s.shotId === shotId ? { ...s, plateFile: fileName, error: "" } : s,
        );
        const stillOpen = shots.some(
          (s) => campaign.shotIds.includes(s.shotId) && !s.plateFile,
        );
        const updated = await patchMobileGenJob(jobId, {
          shots,
          error: "",
          plateLtxCampaign: {
            ...campaign,
            phase: stillOpen ? "plating" : "voicing",
            error: "",
          },
        });
        return NextResponse.json({
          ok: true,
          job: updated,
          advanced: true,
          plated: campaignShotTitle(nextIndex),
        });
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        const shots = job.shots.map((s) =>
          s.shotId === shotId ? { ...s, plateFile: "__error__", error: detail } : s,
        );
        const remaining = campaign.shotIds.some((id) => {
          const s = shots.find((x) => x.shotId === id);
          return !s?.plateFile;
        });
        const updated = await patchMobileGenJob(jobId, {
          shots,
          plateLtxCampaign: {
            ...campaign,
            phase: remaining ? "plating" : "voicing",
            error: `${campaignShotTitle(nextIndex)} plate failed — ${detail}`,
          },
        });
        return NextResponse.json({ ok: true, job: updated, advanced: true });
      }
    }

    // voicing
    const failed = new Set(campaign.voicedFailed || []);
    const nextVoice = campaign.beatIds.findIndex((beatId, i) => {
      if (failed.has(beatId)) return false;
      const shotId = campaignShotIdForBeat(campaign, i);
      const shot = job.shots.find((s) => s.shotId === shotId);
      if (!shot?.plateFile || shot.plateFile === "__error__") return false;
      for (const sc of story.scenes) {
        for (const sh of sc.shots) {
          const beat = sh.beats.find((b) => b.id === beatId);
          if (beat) return !isMobileSavedVoiceFile(beat.voiceFile);
        }
      }
      return false;
    });
    if (nextVoice < 0) {
      const pending: MobileClipUnit[] = [];
      for (let i = 0; i < campaign.beatIds.length; i++) {
        const beatId = campaign.beatIds[i]!;
        const shotId = campaignShotIdForBeat(campaign, i);
        const shot = job.shots.find((s) => s.shotId === shotId);
        if (!shot?.plateFile || shot.plateFile === "__error__") continue;
        let voiceFile = "";
        let line = campaign.lines[i] || "";
        let imageMotion = "";
        for (const sc of story.scenes) {
          for (const sh of sc.shots) {
            const beat = sh.beats.find((b) => b.id === beatId);
            if (!beat) continue;
            voiceFile = beat.voiceFile || "";
            line = beat.text || line;
            imageMotion = beat.imageMotion || "";
          }
        }
        if (!isMobileSavedVoiceFile(voiceFile)) continue;
        pending.push({
          beatId,
          shotId,
          sceneId: campaign.sceneId,
          clipFile: "",
          clipStatus: "pending",
          error: "",
          speaker: campaign.speaker,
          line,
          voiceFile,
          imageMotion,
        });
      }
      if (!pending.length) {
        const updated = await patchMobileGenJob(jobId, {
          plateLtxCampaign: {
            ...campaign,
            phase: "error",
            error: "Plates drew but none of the lines voiced — check the CAST voice.",
          },
          phase: "review",
          error: "Placement plates drew but none of the lines voiced — check the CAST voice.",
        });
        return NextResponse.json({ ok: true, job: updated, advanced: true });
      }
      const updated = await patchMobileGenJob(jobId, {
        clips: [...job.clips.filter((c) => c.clipStatus === "done"), ...pending],
        phase: "animate",
        error: "",
        plateLtxCampaign: { ...campaign, phase: "animating", error: "" },
      });
      return NextResponse.json({ ok: true, job: updated, advanced: true });
    }

    const beatId = campaign.beatIds[nextVoice]!;
    const line = campaign.lines[nextVoice]!;
    const speaker = campaign.speaker;
    try {
      const picked = jobVoiceForSpeaker(job.speakerVoices, speaker);
      if (picked?.voiceId) {
        if (!pinSpeakerLibraryVoice(job.styleId, speaker, picked.voiceId)) {
          await ensureSpeakerVoiceCast(job.styleId, speaker);
        }
      } else {
        await ensureSpeakerVoiceCast(job.styleId, speaker);
      }
      const result = await synthesizeStoryBeat({
        styleId: job.styleId,
        beatId,
        speaker,
        text: line,
      });
      story = {
        ...result.story,
        scenes: result.story.scenes.map((sc) => ({
          ...sc,
          shots: sc.shots.map((sh) => ({
            ...sh,
            beats: sh.beats.map((b) =>
              b.id === beatId
                ? {
                    ...b,
                    imageMotion: campaignImageMotion({
                      index: campaignShotIndexForBeat(nextVoice),
                      styleId: job.styleId,
                      speaker,
                      line,
                    }),
                  }
                : b,
            ),
          })),
        })),
      };
      await writeMobileStory(story, job.folderName);
      const mediaFolder = mobileMediaFolder(job);
      const localPath = await resolveMobileBeatAudio({
        styleId: job.styleId,
        folderName: mediaFolder,
        folderCandidates: mobileCandidateFolders(job),
        beatId,
        voiceFile: result.voiceFile,
      });
      if (localPath) {
        try {
          await uploadMobileMedia({
            styleId: job.styleId,
            folderName: mediaFolder,
            kind: "audio",
            localPath,
          });
        } catch {
          await uploadMobileMedia({
            styleId: job.styleId,
            folderName: mediaFolder,
            kind: "audio",
            localPath,
          });
        }
      }
      return NextResponse.json({
        ok: true,
        job,
        advanced: true,
        voiced: campaignBeatTitle(
          nextVoice,
          campaign.tests?.[nextVoice]?.band,
        ),
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      const updated = await patchMobileGenJob(jobId, {
        plateLtxCampaign: {
          ...campaign,
          voicedFailed: [...(campaign.voicedFailed || []), beatId],
          error: `${campaignBeatTitle(nextVoice, campaign.tests?.[nextVoice]?.band)} voice failed — ${detail}`,
        },
      });
      return NextResponse.json({ ok: true, job: updated, advanced: true });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
