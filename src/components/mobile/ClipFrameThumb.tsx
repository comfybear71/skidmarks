"use client";

import { useEffect, useState } from "react";

/**
 * Phone thumbs: a bare <video preload="metadata"> stays black on iOS.
 * Keep the still visible until the clip has seeked to a real frame.
 */
export function ClipFrameThumb({
  clipSrc,
  stillSrc,
  className,
  alt = "",
}: {
  clipSrc?: string;
  stillSrc?: string;
  className?: string;
  alt?: string;
}) {
  const clip = (clipSrc || "").trim();
  const still = (stillSrc || "").trim();
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => {
    setFrameReady(false);
  }, [clip]);

  if (!clip && !still) {
    return <span className={className} />;
  }

  return (
    <span className={`clip-frame-thumb${className ? ` ${className}` : ""}`}>
      {still ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={still} alt={alt} />
      ) : null}
      {clip ? (
        <video
          src={clip}
          muted
          playsInline
          preload="auto"
          className={frameReady || !still ? "is-ready" : undefined}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.currentTime > 0) return;
            try {
              const dur = Number.isFinite(v.duration) ? v.duration : 0;
              v.currentTime = dur > 0.4 ? 0.35 : 0.05;
            } catch {
              setFrameReady(true);
            }
          }}
          onSeeked={() => setFrameReady(true)}
          onError={() => setFrameReady(false)}
        />
      ) : null}
    </span>
  );
}
