"use client";

import type { CrashStoryDoc } from "@/lib/crashStoryTypes";
import type { MobileGenJob, MobileShotUnit } from "@/lib/mobileGenJob";
import { mobileLocationStillUrl } from "@/lib/mobileCandidateUrls";
import { talkTimelineFrom, type TalkTagKind, type TalkTimelinePlate } from "@/lib/talkTimeline";

function chipClass(kind: TalkTagKind): string {
  return `m-talk-chip is-${kind}`;
}

function PlateCell({
  job,
  row,
  onOpen,
}: {
  job: MobileGenJob;
  row: TalkTimelinePlate;
  onOpen?: (shotId: string) => void;
}) {
  const src = row.plateFile && row.plateFile !== "__error__" ? mobileLocationStillUrl(job, row.plateFile) : "";
  return (
    <button
      type="button"
      className="m-talk-cell"
      style={{ width: `${row.widthPx}px` }}
      onClick={() => onOpen?.(row.shotId)}
      title={row.title}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="m-talk-thumb" />
      ) : (
        <span className="m-talk-thumb m-talk-thumb--empty" />
      )}
      <span className="m-talk-title">{row.title}</span>
      {row.placeName ? <span className="m-talk-place">{row.placeName}</span> : null}
      {row.events.length ? (
        <span className="m-talk-chips">
          {row.events.map((ev) => (
            <span key={ev.id} className={chipClass(ev.kind)} title={ev.detail || ev.tag}>
              {ev.tag}
              {ev.detail ? ` ${ev.detail}` : ""}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Skidmarks / talking shows: a sideways plate strip, not the music-video
 * song TRACK. [DIAL] [SFX] [MUSIC] [CUTAWAY] show when the shot has them.
 */
export function TalkTimeline({
  job,
  story,
  plated,
  compact = false,
  onOpenPlate,
}: {
  job: MobileGenJob;
  story: CrashStoryDoc | null;
  plated: MobileShotUnit[];
  compact?: boolean;
  onOpenPlate?: (shotId: string) => void;
}) {
  const rows = talkTimelineFrom({ story, plated });
  if (!rows.length) {
    return (
      <div className="m-talk">
        <p className="m-talk-empty">
          Talking strip — plates sit here with [DIAL] [SFX] [MUSIC] [CUTAWAY] when
          the shot has them. Not a song.
        </p>
      </div>
    );
  }
  return (
    <div className="m-talk">
      <div className="m-talk-scroll">
        <div className="m-talk-inner">
          {rows.map((row) => (
            <PlateCell
              key={row.shotId}
              job={job}
              row={{
                ...row,
                events: compact ? [] : row.events,
              }}
              onOpen={onOpenPlate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
