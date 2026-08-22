"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_DESK_ID } from "@/lib/mobileDesk";
import {
  episodeListTitle,
  episodePhaseLabel,
  episodeUpdatedLabel,
  type MobileEpisodeListItem,
} from "@/lib/mobileEpisodeList";
import { MobilePrimaryButton } from "@/components/mobile/MobileUi";

/**
 * Browse cloud/local mobile jobs and open one — so Start directing is not
 * the only door when you already have many episode ideas.
 */
export function OpenEpisodePicker({
  deskId = DEFAULT_DESK_ID,
  activeJobId,
  onOpen,
  onNew,
  onDeleted,
  open: openProp,
  onOpenChange,
  title = "Your episodes",
  styleId,
}: {
  deskId?: string;
  activeJobId?: string;
  /** Only list episodes of this style — e.g. the highlighted LOOK tile on the pre-episode screen. Omit to list everything. */
  styleId?: string;
  onOpen: (jobId: string) => void;
  /** Optional — New episode without wiping the old one. */
  onNew?: () => void;
  /** Fired after a successful delete (so the desk can clear if it was open). */
  onDeleted?: (jobId: string) => void;
  /** Controlled open (toolbar). Omit for always-visible list. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
}) {
  const controlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(true);
  const open = controlled ? Boolean(openProp) : internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  const [jobs, setJobs] = useState<MobileEpisodeListItem[]>([]);
  const visibleJobs = styleId ? jobs.filter((j) => j.styleId === styleId) : jobs;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/crash/mobile/jobs?desk=${encodeURIComponent(deskId)}`);
      const data = (await res.json().catch(() => ({}))) as {
        jobs?: MobileEpisodeListItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Couldn't list episodes");
      setJobs(data.jobs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't list episodes");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [deskId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [open, load]);

  const deleteEpisode = useCallback(
    async (jobId: string) => {
      setDeletingId(jobId);
      setError("");
      try {
        const res = await fetch(`/api/crash/mobile/job/${encodeURIComponent(jobId)}`, {
          method: "DELETE",
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Couldn't delete episode");
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        setConfirmId(null);
        onDeleted?.(jobId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete episode");
      } finally {
        setDeletingId(null);
      }
    },
    [onDeleted],
  );

  return (
    <div className="open-episode-picker">
      <div className="open-episode-picker-head">
        <button
          type="button"
          className="open-episode-picker-toggle"
          onClick={() => setOpen(!open)}
        >
          {open ? `▾ ${title}` : `▸ ${title}`}
          {!open && visibleJobs.length ? ` (${visibleJobs.length})` : ""}
        </button>
        <div className="open-episode-picker-actions">
          {open ? (
            <button type="button" className="open-episode-picker-refresh" onClick={() => void load()} disabled={loading}>
              {loading ? "…" : "Refresh"}
            </button>
          ) : null}
          {onNew ? (
            <MobilePrimaryButton size="chip" tone="ghost" onClick={onNew}>
              New episode
            </MobilePrimaryButton>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="open-episode-picker-body">
          {error ? <div className="open-episode-picker-error">{error}</div> : null}
          {loading && !visibleJobs.length ? (
            <div className="open-episode-picker-empty">Loading episodes…</div>
          ) : null}
          {!loading && !visibleJobs.length && !error ? (
            <div className="open-episode-picker-empty">
              {styleId && jobs.length
                ? "No episodes of this style yet — write a vibe and tap Start directing."
                : "No episodes yet — write a vibe and tap Start directing."}
            </div>
          ) : null}
          <ul className="open-episode-picker-list">
            {visibleJobs.map((job) => {
              const active = activeJobId === job.id;
              const cast = (job.speakers || []).slice(0, 4).join(", ");
              const more = (job.speakers || []).length > 4 ? "…" : "";
              const when = episodeUpdatedLabel(job.updatedAt);
              const confirming = confirmId === job.id;
              const deleting = deletingId === job.id;
              return (
                <li key={job.id} className="open-episode-picker-item">
                  <button
                    type="button"
                    className={`open-episode-picker-row${active ? " is-active" : ""}`}
                    onClick={() => {
                      setConfirmId(null);
                      onOpen(job.id);
                      setOpen(false);
                    }}
                  >
                    <span className="open-episode-picker-title">{episodeListTitle(job)}</span>
                    <span className="open-episode-picker-meta">
                      {episodePhaseLabel(job.phase)}
                      {job.styleId ? ` · ${job.styleId}` : ""}
                      {cast ? ` · ${cast}${more}` : ""}
                      {typeof job.placeCount === "number" && job.placeCount > 0
                        ? ` · ${job.placeCount} place${job.placeCount === 1 ? "" : "s"}`
                        : ""}
                      {when ? ` · ${when}` : ""}
                    </span>
                    {active ? <span className="open-episode-picker-active">Open</span> : null}
                  </button>
                  {confirming ? (
                    <div className="open-episode-picker-delete-confirm">
                      <button
                        type="button"
                        className="open-episode-picker-delete-go"
                        disabled={deleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteEpisode(job.id);
                        }}
                      >
                        {deleting ? "…" : "Delete"}
                      </button>
                      <button
                        type="button"
                        className="open-episode-picker-delete-cancel"
                        disabled={deleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmId(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="open-episode-picker-delete"
                      aria-label={`Delete ${episodeListTitle(job)}`}
                      disabled={Boolean(deletingId)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmId(job.id);
                      }}
                    >
                      Delete
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
