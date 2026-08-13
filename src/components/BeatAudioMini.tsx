"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  compact?: boolean;
};

/** Small play / pause / stop for story beats and SFX. */
export function BeatAudioMini({ src, compact }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const size = compact ? "h-5 w-5 text-[8px]" : "h-6 w-6 text-[9px]";

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [src]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else void el.play();
  }

  function stop() {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setPlaying(false);
  }

  return (
    <div className="flex shrink-0 gap-0.5">
      <audio ref={audioRef} src={src} preload="none" />
      <button
        type="button"
        title={playing ? "Pause" : "Play"}
        className={`flex items-center justify-center rounded-sm border border-[var(--acid)] bg-[var(--acid)]/15 text-[var(--acid)] ${size}`}
        onClick={toggle}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <button
        type="button"
        title="Stop"
        className={`flex items-center justify-center rounded-sm border border-[var(--line)] text-[var(--chrome-dim)] ${size}`}
        onClick={stop}
      >
        ■
      </button>
    </div>
  );
}
