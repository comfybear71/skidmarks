import Link from "next/link";

/**
 * Home — plain landing: title + Crash Lab / M / Scratch.
 * Episode packs are unchanged on disk/cloud; they are just not listed here.
 */
export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel)]/80">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(225,0,106,0.25),transparent_50%),radial-gradient(ellipse_at_90%_20%,rgba(200,255,46,0.12),transparent_45%)]" />
        <div className="relative grid gap-6 p-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <h2 className="display text-3xl text-[var(--chrome)] md:text-4xl">
              skidmark productions
            </h2>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/crash"
                className="rounded-sm border border-[var(--acid)] bg-[var(--acid)] px-3 py-2 text-sm font-semibold text-[var(--void)] transition hover:brightness-110"
              >
                Crash Lab
              </Link>
              <Link
                href="https://skidmarks.aiglitch.app/m"
                className="rounded-sm border border-[#3b9eff] bg-[#3b9eff] px-3 py-2 text-sm font-semibold text-[var(--void)] transition hover:brightness-110"
              >
                M
              </Link>
              <Link
                href="https://skidmarks.aiglitch.app/scratch"
                className="rounded-sm border border-[var(--magenta-hot)] bg-[var(--magenta-hot)] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Scratch
              </Link>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/skidmarks-logo.png"
            alt=""
            className="mx-auto max-h-40 w-auto drop-shadow-[0_0_28px_rgba(225,0,106,0.35)] md:max-h-48"
          />
        </div>
      </section>
    </div>
  );
}
