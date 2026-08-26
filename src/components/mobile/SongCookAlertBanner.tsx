"use client";

import { useEffect } from "react";
import type { ScratchSongCut } from "@/lib/scratchSongWindow";
import { songCookAlert } from "@/lib/musicVideoSong";
import { notifySongCookProblem, restoreSongCookTitle } from "@/lib/songCutCook";

export function SongCookAlertBanner({
  cuts,
  cooking = false,
  showGoing = false,
}: {
  cuts: ScratchSongCut[];
  /** This phone is still driving Generate. */
  cooking?: boolean;
  /** Song-cuts desk can show the quiet “keeps going” line. TRACK only shouts. */
  showGoing?: boolean;
}) {
  const alert = songCookAlert(cuts, { cooking });

  useEffect(() => {
    notifySongCookProblem(alert);
    return () => {
      restoreSongCookTitle();
    };
  }, [alert.fingerprint, alert.kind, alert.short, alert.title, alert.detail]);

  if (alert.kind === "ok") return null;
  if (alert.kind === "cooking" && !showGoing) return null;
  if (alert.kind === "cooking") {
    return <p className="m-song-cook-note">{songCookLine(alert.title, alert.detail)}</p>;
  }
  return (
    <div className="m-song-cook-alert" role="alert">
      <strong>{alert.title}</strong>
      {alert.detail ? <p>{alert.detail}</p> : null}
    </div>
  );
}

function songCookLine(title: string, detail: string): string {
  return detail ? `${title}. ${detail}` : title;
}
