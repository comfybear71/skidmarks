"use client";

export type ProductionStep = 1 | 2 | 3 | 4 | 5 | 6;

const STEPS = [
  { n: 1 as const, title: "Style", note: "Show + look" },
  { n: 2 as const, title: "Characters", note: "Cast / arsehole" },
  { n: 3 as const, title: "World", note: "Places + set" },
  { n: 4 as const, title: "Swap", note: "Face swap" },
  { n: 5 as const, title: "Voice", note: "ElevenLabs" },
  { n: 6 as const, title: "Story", note: "Script + spine" },
];

type Props = {
  current: ProductionStep;
  maxDone?: number;
  onSelect: (n: ProductionStep) => void;
  /** Swap step only for Deep fake — hidden for Skidmarks etc. */
  showSwap?: boolean;
};

export function ProductionFlowStepper({ current, maxDone = 0, onSelect, showSwap = false }: Props) {
  const visibleSteps = showSwap ? STEPS : STEPS.filter((s) => s.n !== 4);
  return (
    <div className="border-b border-[var(--line)] bg-[var(--panel-2)] px-1.5 py-2">
      <ol className="flex w-full min-w-0 items-start justify-between gap-0">
        {visibleSteps.map((step, i) => {
          const done = step.n < current || step.n <= maxDone;
          const isCurrent = step.n === current;
          const reachable = step.n <= Math.max(current, maxDone + 1);
          return (
            <li key={step.n} className="flex min-w-0 flex-1 items-start justify-center">
              <button
                type="button"
                onClick={() => onSelect(step.n)}
                title={
                  isCurrent
                    ? `${step.title} — you are here`
                    : `Go to ${step.title}`
                }
                className="group flex w-full min-w-0 max-w-[4rem] cursor-pointer flex-col items-center gap-0.5 px-0.5 text-center"
              >
                <span
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                    isCurrent
                      ? "border-[var(--magenta-hot)] bg-[var(--magenta-hot)]"
                      : done
                        ? "border-[var(--acid)] bg-[var(--acid)] group-hover:brightness-110"
                        : reachable
                          ? "border-[var(--line)] bg-transparent group-hover:border-[var(--chrome-dim)]"
                          : "border-[var(--line)] bg-transparent opacity-60"
                  }`}
                />
                <span
                  className={`text-[8px] font-medium leading-tight group-hover:underline ${
                    isCurrent
                      ? "text-[var(--magenta-hot)]"
                      : done
                        ? "text-[var(--acid)]"
                        : "text-[var(--chrome-dim)]"
                  }`}
                >
                  {step.title}
                </span>
                <span className="text-[7px] leading-tight text-[var(--mute)]">
                  {step.note}
                </span>
              </button>
              {i < visibleSteps.length - 1 ? (
                <span
                  className={`mt-2 w-2 shrink-0 text-center text-[9px] leading-none ${
                    step.n < current
                      ? "text-[var(--acid)]"
                      : "text-[var(--chrome-dim)]"
                  }`}
                  aria-hidden
                >
                  →
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
