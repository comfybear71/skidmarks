import path from "path";
import { NextResponse } from "next/server";
import { compositeShotPlate } from "@/lib/mobilePlates";
import { hydrateMobilePackOnDisk, readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { uploadMobileMedia } from "@/lib/mobileMediaStore";
import { patchMobileGenJob, readMobileGenJob, type MobileClipUnit } from "@/lib/mobileGenJob";
import { synthesizeStoryBeat } from "@/lib/crashStorySpeak";
import { resolveMobileBeatAudio } from "@/lib/resolveMobileBeatAudio";
import { ensureSpeakerVoiceCast } from "@/lib/scriptVoiceGen";
import { pinSpeakerLibraryVoice } from "@/lib/mobileVoiceReuse";
import { jobVoiceForSpeaker } from "@/lib/mobileJobVoices";
import { newId } from "@/lib/types";
import { CRASH_DIR } from "@/lib/paths";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";
import {
  PLATE_LTX_CAMPAIGN_COUNT,
  campaignImageMotion,
  campaignShotTitle,
  campaignStaging,
  parseCampaignLines,
  type PlateLtxCampaign,
} from "@/lib/mobilePlateLtxCampaign";
import { approvedCandidateFileName } from "@/lib/mobileJobReady";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * POST { action: "start", jobId, speaker, sceneId, lines }
 *   — mint 20 solo shots (one character, one place). Does not wipe existing
 *     plates. Speech comes from the 20 lines. Position + LTX are paired.
 * POST { action: "step", jobId }
 *   — one plate draw or one voice. When both are done, queues only those
 *     20 clips and sets phase animate (existing LTX poll takes over).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      jobId?: string;
      speaker?: string;
      sceneId?: string;
      lines?: string | string[];
    };
    const jobId = (body.jobId || "").trim();
    const action = (body.action || "step").trim().toLowerCase();
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
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
      const rawLines = Array.isArray(body.lines)
        ? body.lines.map((l) => String(l || "").trim()).filter(Boolean)
        : parseCampaignLines(String(body.lines || ""));
      if (rawLines.length !== PLATE_LTX_CAMPAIGN_COUNT) {
        return NextResponse.json(
          {
            error: `Need exactly ${PLATE_LTX_CAMPAIGN_COUNT} spoken lines (got ${rawLines.length}). Paste all 20, then run.`,
          },
          { status: 400 },
        );
      }

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
      const newShots = Array.from({ length: PLATE_LTX_CAMPAIGN_COUNT }, (_, i) => {
        const beatId = newId("beat");
        const shotId = newId("shot");
        shotIds.push(shotId);
        beatIds.push(beatId);
        const staging = campaignStaging(i, speaker, place);
        const line = rawLines[i]!;
        return {
          id: shotId,
          title: campaignShotTitle(i),
          summary: staging,
          staging,
          plateFile: "",
          beats: [
            {
              id: beatId,
              speaker,
              text: line,
              imageMotion: campaignImageMotion({
                index: i,
                styleId: job.styleId,
                speaker,
                line,
              }),
            },
          ],
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
      const campaign: PlateLtxCampaign = {
        speaker,
        sceneId,
        sceneName: place,
        shotIds,
        beatIds,
        lines: rawLines,
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
      const shotId = campaign.shotIds[i]!;
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
        const shotId = campaign.shotIds[i]!;
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
            error: "Plates drew but none of the 20 lines voiced — check the CAST voice.",
          },
          phase: "review",
          error: "20-test plates drew but none of the lines voiced — check the CAST voice.",
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
                      index: nextVoice,
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
      const localPath = await resolveMobileBeatAudio({
        styleId: job.styleId,
        folderName: job.folderName,
        beatId,
        voiceFile: result.voiceFile,
      });
      if (localPath) {
        try {
          await uploadMobileMedia({
            styleId: job.styleId,
            folderName: job.folderName,
            kind: "audio",
            localPath,
          });
        } catch {
          await uploadMobileMedia({
            styleId: job.styleId,
            folderName: job.folderName,
            kind: "audio",
            localPath,
          });
        }
      }
      return NextResponse.json({
        ok: true,
        job,
        advanced: true,
        voiced: campaignShotTitle(nextVoice),
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      const updated = await patchMobileGenJob(jobId, {
        plateLtxCampaign: {
          ...campaign,
          voicedFailed: [...(campaign.voicedFailed || []), beatId],
          error: `${campaignShotTitle(nextVoice)} voice failed — ${detail}`,
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
