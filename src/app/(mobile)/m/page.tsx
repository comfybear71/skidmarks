export default function MobileHomePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        textAlign: "center",
        color: "var(--chrome)",
      }}
    >
      <h1 className="display" style={{ fontSize: "28px", color: "var(--acid)" }}>
        Skidmarks Auto Studio
      </h1>
      <p style={{ color: "var(--chrome-dim)", marginTop: "8px", fontSize: "14px" }}>
        Stepper coming next.
      </p>
    </main>
  );
}
