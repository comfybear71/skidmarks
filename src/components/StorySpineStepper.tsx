"use client";

import {
  STORY_SPINE_STAGES,
  type StorySpineStageN,
} from "@/lib/storySpine";

type Props = {
  current: StorySpineStageN;
  /** Highest stage marked done (0 = none). */
  maxDone?: number;
  onSelect: (n: StorySpineStageN) => void;
};

/**
 * Horizontal 1→9 spine stepper for building a new episode in Script desk.
 */
export function StorySpineStepper({ current, maxDone = 0, onSelect }: Props) {
  return (
    <div className="border-b border-[var(--line)] bg-[var(--panel-2)] px-2 py-2">
      <p className="mb-2 text-[9px] uppercase tracking-[0.14em] text-[var(--mute)]">
        Story spine
      </p>
      <div className="overflow-x-auto pb-1">
        <ol className="flex min-w-max items-start gap-0">
          {STORY_SPINE_STAGES.map((stage, i) => {
            const done = stage.n <= maxDone;
            const isCurrent = stage.n === current;
            const pending = !done && !isCurrent;
            return (
              <li key={stage.n} className="flex items-start">
                <button
                  type="button"
                  onClick={() => onSelect(stage.n)}
                  className="group flex w-[4.5rem] flex-col items-center gap-1 px-0.5 text-center"
                  title={`${stage.n}. ${stage.title} — ${stage.note}`}
                >
                  <span
                    className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full border ${
                      done
                        ? "border-[var(--acid)] bg-[var(--acid)]"
                        : isCurrent
                          ? "border-[var(--magenta-hot)] bg-[var(--magenta-hot)]"
                          : "border-[var(--line)] bg-transparent"
                    }`}
                  />
                  <span
                    className={`text-[9px] font-medium leading-tight ${
                      isCurrent
                        ? "text-[var(--magenta-hot)]"
                        : done
                          ? "text-[var(--acid)]"
                          : "text-[var(--chrome-dim)]"
                    }`}
                  >
                    {stage.n}
                  </span>
                  <span className="line-clamp-2 text-[8px] leading-tight text-[var(--mute)] group-hover:text-[var(--chrome-dim)]">
                    {stage.title}
                  </span>
                  <span className="text-[8px] italic text-[var(--chrome-dim)]">
                    {done ? "(done)" : isCurrent ? "(current)" : pending ? "(pending)" : ""}
                  </span>
                </button>
                {i < STORY_SPINE_STAGES.length - 1 ? (
                  <span
                    className="mt-1.5 w-4 shrink-0 border-t border-dashed border-[var(--line)]"
                    aria-hidden
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export function storyStageByN(n: StorySpineStageN) {
  return STORY_SPINE_STAGES.find((s) => s.n === n)!;
}
