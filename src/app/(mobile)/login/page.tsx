"use client";

import { useEffect, useState, type FormEvent } from "react";

function safeNext(raw: string | null): string {
  const n = (raw || "").trim();
  if (!n.startsWith("/") || n.startsWith("//")) return "/m";
  return n;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState("/m");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setNext(safeNext(q.get("next")));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/studio/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Couldn't sign in");
        return;
      }
      window.location.href = next;
    } catch {
      setError("Couldn't sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mobile-shell" style={{ minHeight: "100dvh", padding: "32px 16px" }}>
      <div style={{ fontWeight: 800, fontSize: "22px", color: "var(--chrome)" }}>Skidmarks</div>
      <div style={{ color: "var(--chrome-dim)", fontSize: "13px", marginTop: "8px", maxWidth: "28rem" }}>
        Homepage is public. M, Scratch, and Crash Lab are just for the two of us.
      </div>
      <form
        onSubmit={(e) => void onSubmit(e)}
        style={{ marginTop: "24px", display: "grid", gap: "12px", maxWidth: "22rem" }}
      >
        <label style={{ display: "grid", gap: "4px" }}>
          <span
            style={{
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--chrome-dim)",
            }}
          >
            Email
          </span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "10px 12px",
              borderRadius: "2px",
              border: "1px solid var(--line)",
              background: "var(--panel-2)",
              color: "var(--chrome)",
              fontSize: "16px",
            }}
          />
        </label>
        <label style={{ display: "grid", gap: "4px" }}>
          <span
            style={{
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--chrome-dim)",
            }}
          >
            Password
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: "10px 12px",
              borderRadius: "2px",
              border: "1px solid var(--line)",
              background: "var(--panel-2)",
              color: "var(--chrome)",
              fontSize: "16px",
            }}
          />
        </label>
        {error ? (
          <div style={{ color: "var(--magenta-hot)", fontSize: "13px", fontWeight: 600 }}>{error}</div>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: "12px 16px",
            borderRadius: "2px",
            border: "1px solid var(--acid)",
            background: "var(--acid)",
            color: "#111",
            fontWeight: 800,
            fontSize: "14px",
          }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
