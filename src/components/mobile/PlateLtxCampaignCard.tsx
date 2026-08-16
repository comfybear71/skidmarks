"use client";

import { useMemo, useState } from "react";
import { MobilePrimaryButton, MobileTextInput, mobileCard } from "./MobileUi";
import {
  CAMPAIGN_CLIP_COUNT,
  PLACEMENT_COUNT,
  campaignSpeechScript,
  expandCampaignLines,
  plateLtxCampaignScenarios,
  type CampaignTest,
  type CampaignTestScore,
  type PlateLtxCampaign,
} from "@/lib/mobilePlateLtxCampaign";
import { approvedCandidateFileName } from "@/lib/mobileJobReady";
import type { MobileGenJob } from "@/lib/mobileGenJob";

export async function saveCampaignTestScore(opts: {
  jobId: string;
  testId: string;
  score: number;
  comment: string;
}): Promise<MobileGenJob> {
  const res = await fetch("/api/crash/mobile/campaign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "score",
      jobId: opts.jobId,
      testId: opts.testId,
      score: opts.score,
      comment: opts.comment,
    }),
  });
  const data = (await res.json()) as { error?: string; job?: MobileGenJob };
  if (!res.ok || !data.job) throw new Error(data.error || "Couldn't save the score");
  return data.job;
}

export function CampaignTestScoreRow({
  jobId,
  test,
  saved,
  onJobChange,
}: {
  jobId: string;
  test: CampaignTest;
  saved?: CampaignTestScore;
  onJobChange: (job: MobileGenJob) => void;
}) {
  const [score, setScore] = useState(saved?.score || 0);
  const [comment, setComment] = useState(saved?.comment || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (score < 1) {
      setError("Tap 1–5 first");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const job = await saveCampaignTestScore({
        jobId,
        testId: test.id,
        score,
        comment,
      });
      onJobChange(job);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the score");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "8px 0",
        borderTop: "1px solid var(--line)",
      }}
    >
      <div style={{ fontSize: "12px", color: "var(--chrome)", fontWeight: 700 }}>
        {test.id} · {test.poseLabel} · {test.band}
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setScore(n)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: "2px",
              border: "1px solid var(--line)",
              background: score === n ? "var(--acid)" : "var(--panel-2)",
              color: score === n ? "#111" : "var(--chrome)",
              fontWeight: 700,
              fontSize: "13px",
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <MobileTextInput
        value={comment}
        onChange={setComment}
        placeholder="Distance, extra person, lip sync, clothes, artifacts…"
        multiline
        rows={2}
      />
      <MobilePrimaryButton size="chip" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : saved ? "Update score" : "Save score"}
      </MobilePrimaryButton>
      {error ? (
        <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{error}</div>
      ) : null}
    </div>
  );
}

export function PlateLtxCampaignCard({
  job,
  onJobChange,
}: {
  job: MobileGenJob;
  onJobChange: (job: MobileGenJob) => void;
}) {
  const speakers = job.speakers;
  const scenes = job.scenes;
  const jo =
    speakers.find((n) => /crazy big hole jo/i.test(n)) || speakers[0] || "";
  const donga =
    scenes.find((s) => /the donga/i.test(s.placeName)) ||
    scenes.find((s) => /donga/i.test(s.placeName));
  const [speaker, setSpeaker] = useState(jo);
  const [sceneId, setSceneId] = useState(donga?.id || scenes[0]?.id || "");
  const [rawLines, setRawLines] = useState(campaignSpeechScript());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const expanded = useMemo(() => expandCampaignLines(rawLines), [rawLines]);
  const campaign = job.plateLtxCampaign;
  const working =
    campaign?.phase === "plating" ||
    campaign?.phase === "voicing" ||
    campaign?.phase === "animating";
  const faceOk = Boolean(speaker && approvedCandidateFileName(job.castCandidates, speaker));
  const placeOk = Boolean(
    sceneId &&
      (approvedCandidateFileName(job.locationCandidates, sceneId) ||
        scenes.find((s) => s.id === sceneId)?.worldThumbKey),
  );
  const canStart =
    Boolean(job.folderName) &&
    faceOk &&
    placeOk &&
    expanded.lines.length === CAMPAIGN_CLIP_COUNT &&
    !expanded.error &&
    !working &&
    !busy;

  async function start() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          jobId: job.id,
          speaker,
          sceneId,
          lines: rawLines,
        }),
      });
      const data = (await res.json()) as { error?: string; job?: MobileGenJob };
      if (!res.ok) throw new Error(data.error || "Couldn't start the placement tests");
      if (data.job) onJobChange(data.job);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the placement tests");
    } finally {
      setBusy(false);
    }
  }

  const plated =
    campaign?.shotIds.filter((id) => {
      const s = job.shots.find((x) => x.shotId === id);
      return Boolean(s?.plateFile && s.plateFile !== "__error__");
    }).length || 0;
  const clipsDone =
    campaign?.beatIds.filter((id) =>
      job.clips.some((c) => c.beatId === id && c.clipStatus === "done"),
    ).length || 0;
  const scored = Object.keys(campaign?.scores || {}).length;
  const status =
    campaign?.phase === "plating"
      ? `Drawing plates ${plated}/${PLACEMENT_COUNT}`
      : campaign?.phase === "voicing"
        ? `Voicing short + long (${plated} plates ready)`
        : campaign?.phase === "animating"
          ? `LTX ${clipsDone}/${CAMPAIGN_CLIP_COUNT}`
          : campaign?.phase === "done"
            ? `Done — ${clipsDone} clips. Scored ${scored}/${CAMPAIGN_CLIP_COUNT}`
            : campaign?.phase === "error"
              ? campaign.error || "Campaign failed"
              : "";

  return (
    <div style={{ ...mobileCard, padding: "10px 12px", marginTop: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--chrome)" }}>
            Plate + LTX placements
          </div>
          <div style={{ fontSize: "11px", color: "var(--chrome-dim)", marginTop: "2px" }}>
            Score plating, distance, extras, artifacts. Short + long on every pose. MCU and
            wide longs are the unsplit Jummie letter.
          </div>
        </div>
        <MobilePrimaryButton
          size="chip"
          disabled={!job.folderName || busy || working}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Placements"}
        </MobilePrimaryButton>
      </div>
      {status ? (
        <div
          style={{
            fontSize: "12px",
            color: campaign?.phase === "error" ? "var(--magenta-hot)" : "var(--acid)",
            marginTop: "8px",
          }}
        >
          {status}
        </div>
      ) : null}
      {open ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
          <label style={{ fontSize: "11px", color: "var(--chrome-dim)" }}>
            Character
            <select
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              disabled={working}
              style={{
                display: "block",
                width: "100%",
                marginTop: "4px",
                padding: "8px",
                background: "var(--panel-2)",
                color: "var(--chrome)",
                border: "1px solid var(--line)",
                borderRadius: "2px",
              }}
            >
              {speakers.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: "11px", color: "var(--chrome-dim)" }}>
            Place
            <select
              value={sceneId}
              onChange={(e) => setSceneId(e.target.value)}
              disabled={working}
              style={{
                display: "block",
                width: "100%",
                marginTop: "4px",
                padding: "8px",
                background: "var(--panel-2)",
                color: "var(--chrome)",
                border: "1px solid var(--line)",
                borderRadius: "2px",
              }}
            >
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.placeName}
                </option>
              ))}
            </select>
          </label>
          <div style={{ fontSize: "11px", color: "var(--chrome-dim)", lineHeight: 1.45 }}>
            {plateLtxCampaignScenarios().map((s) => (
              <div key={s.id}>{s.label}</div>
            ))}
          </div>
          <MobileTextInput
            value={rawLines}
            onChange={setRawLines}
            placeholder="Jo texts, blank line between each. Keep the Jummie letter as one block."
            multiline
            rows={8}
          />
          <div
            style={{
              fontSize: "11px",
              color:
                expanded.lines.length === CAMPAIGN_CLIP_COUNT && !expanded.error
                  ? "var(--acid)"
                  : "var(--chrome-dim)",
            }}
          >
            {expanded.error
              ? expanded.error
              : `${expanded.speechCount} texts (${expanded.shortCount} short / ${expanded.longCount} long / ${expanded.pushCount} push) → ${CAMPAIGN_CLIP_COUNT} numbered tests`}
          </div>
          <MobilePrimaryButton disabled={!canStart} onClick={() => void start()}>
            {busy ? "Starting…" : working ? "Running…" : "Run thorough test"}
          </MobilePrimaryButton>
          {error ? (
            <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{error}</div>
          ) : null}
          {campaign?.error && campaign.phase !== "error" ? (
            <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{campaign.error}</div>
          ) : null}
          {campaign?.tests?.length ? (
            <CampaignScoreList campaign={campaign} jobId={job.id} onJobChange={onJobChange} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CampaignScoreList({
  campaign,
  jobId,
  onJobChange,
}: {
  campaign: PlateLtxCampaign;
  jobId: string;
  onJobChange: (job: MobileGenJob) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          color: "var(--chrome-dim)",
          marginTop: "6px",
          marginBottom: "4px",
        }}
      >
        Score each clip 1–5. Comment where it hallucinates, sits too far, or the pose holds.
      </div>
      {(campaign.tests || []).map((test) => (
        <CampaignTestScoreRow
          key={test.id}
          jobId={jobId}
          test={test}
          saved={campaign.scores?.[test.id]}
          onJobChange={onJobChange}
        />
      ))}
    </div>
  );
}
