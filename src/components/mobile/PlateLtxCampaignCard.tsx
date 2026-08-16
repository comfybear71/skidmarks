"use client";

import { useMemo, useState } from "react";
import { MobilePrimaryButton, MobileTextInput, mobileCard } from "./MobileUi";
import {
  PLATE_LTX_CAMPAIGN_COUNT,
  parseCampaignLines,
  plateLtxCampaignScenarios,
} from "@/lib/mobilePlateLtxCampaign";
import { approvedCandidateFileName } from "@/lib/mobileJobReady";
import type { MobileGenJob } from "@/lib/mobileGenJob";

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
  const [speaker, setSpeaker] = useState(jo);
  const [sceneId, setSceneId] = useState(scenes[0]?.id || "");
  const [rawLines, setRawLines] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const parsed = useMemo(() => parseCampaignLines(rawLines), [rawLines]);
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
    parsed.length === PLATE_LTX_CAMPAIGN_COUNT &&
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
          lines: parsed,
        }),
      });
      const data = (await res.json()) as { error?: string; job?: MobileGenJob };
      if (!res.ok) throw new Error(data.error || "Couldn't start the 20 tests");
      if (data.job) onJobChange(data.job);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the 20 tests");
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
  const status =
    campaign?.phase === "plating"
      ? `Drawing plates ${plated}/${PLATE_LTX_CAMPAIGN_COUNT}`
      : campaign?.phase === "voicing"
        ? `Voicing lines ${plated} plates ready`
        : campaign?.phase === "animating"
          ? `LTX ${clipsDone}/${PLATE_LTX_CAMPAIGN_COUNT}`
          : campaign?.phase === "done"
            ? `Done — ${clipsDone} clips under the plates`
            : campaign?.phase === "error"
              ? campaign.error || "Campaign failed"
              : "";

  return (
    <div style={{ ...mobileCard, padding: "10px 12px", marginTop: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--chrome)" }}>
            20 plate + LTX tests
          </div>
          <div style={{ fontSize: "11px", color: "var(--chrome-dim)", marginTop: "2px" }}>
            One character, one place. Position and Image motion paired. Not random CAST.
          </div>
        </div>
        <MobilePrimaryButton
          size="chip"
          disabled={!job.folderName || busy || working}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "20 tests"}
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
            placeholder={`Paste ${PLATE_LTX_CAMPAIGN_COUNT} spoken lines — one per test, in that order. Blank line between paragraphs is fine.`}
            multiline
            rows={8}
          />
          <div style={{ fontSize: "11px", color: parsed.length === 20 ? "var(--acid)" : "var(--chrome-dim)" }}>
            {parsed.length}/{PLATE_LTX_CAMPAIGN_COUNT} lines
          </div>
          <MobilePrimaryButton disabled={!canStart} onClick={() => void start()}>
            {busy ? "Starting…" : working ? "Running…" : "Run 20 plate + LTX tests"}
          </MobilePrimaryButton>
          {error ? (
            <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{error}</div>
          ) : null}
          {campaign?.error && campaign.phase !== "error" ? (
            <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{campaign.error}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
