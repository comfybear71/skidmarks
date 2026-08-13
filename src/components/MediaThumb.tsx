"use client";

/** Still or mp4 first-frame thumb — video uses metadata so the poster frame shows. */
export function MediaThumb({
  stillSrc,
  videoSrc,
  alt = "",
  className = "h-full w-full object-cover",
  title,
  onClick,
  draggable,
}: {
  stillSrc?: string | null;
  videoSrc?: string | null;
  alt?: string;
  className?: string;
  title?: string;
  onClick?: () => void;
  draggable?: boolean;
}) {
  if (videoSrc) {
    return (
      <video
        key={videoSrc}
        src={videoSrc}
        muted
        playsInline
        preload="metadata"
        draggable={draggable}
        className={`${className} bg-black ${onClick ? "cursor-zoom-in" : ""}`}
        title={title || "mp4"}
        onClick={onClick}
      />
    );
  }
  if (stillSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={stillSrc}
        alt={alt}
        draggable={draggable}
        className={`${className} ${onClick ? "cursor-zoom-in" : ""}`}
        title={title}
        onClick={onClick}
      />
    );
  }
  return null;
}
