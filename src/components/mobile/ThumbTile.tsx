"use client";

/** Same 72px tile CAST / LOCATIONS / shot plates / character plates share. */
export function ThumbTile({
  src,
  label,
  picked,
  failed,
  onClick,
}: {
  src: string;
  label: string;
  picked?: boolean;
  failed?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: "0 0 auto",
        width: "72px",
        padding: 0,
        border: "none",
        background: "none",
        color: "var(--chrome)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <span style={{ position: "relative", width: "72px", height: "72px" }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            style={{
              width: "72px",
              height: "72px",
              objectFit: "cover",
              borderRadius: "10px",
              display: "block",
              border: picked
                ? "2px solid var(--acid)"
                : failed
                  ? "2px solid var(--magenta)"
                  : "2px solid transparent",
            }}
          />
        ) : (
          <span
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "10px",
              display: "block",
              background: "var(--panel-2)",
              border: failed ? "2px solid var(--magenta)" : "2px solid var(--line)",
            }}
          />
        )}
        {picked ? (
          <span
            style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              background: "var(--acid)",
              color: "var(--void)",
              borderRadius: "999px",
              width: "16px",
              height: "16px",
              fontSize: "10px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✓
          </span>
        ) : null}
      </span>
      <span
        style={{
          fontSize: "11px",
          color: failed ? "var(--magenta-hot)" : "var(--chrome-dim)",
          width: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "center",
        }}
      >
        {label}
      </span>
    </button>
  );
}

export function PlusTile({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: "0 0 auto",
        width: "72px",
        height: "72px",
        borderRadius: "10px",
        border: "1px dashed var(--line)",
        background: "transparent",
        color: "var(--acid)",
        fontSize: "28px",
        fontWeight: 400,
        lineHeight: 1,
      }}
      aria-label={label}
    >
      +
    </button>
  );
}
