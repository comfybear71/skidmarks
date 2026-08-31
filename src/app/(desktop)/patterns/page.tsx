"use client";

import { MathPattern } from "@/components/MathPattern";

export default function PatternsPage() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24, color: "#eee" }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Trippy pattern lab</h1>
      <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
        Single-pass WebGL2 shader — no feedback trail, no grain. Pick a mode and palette, drag the
        sliders, Shuffle for a fresh look, then Save frame for a full-resolution PNG.
      </p>
      <MathPattern />
    </div>
  );
}
