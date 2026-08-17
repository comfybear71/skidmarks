"use client";

import { useEffect, useRef } from "react";

type CastMember = { file: string; name: string; ar: number };

// Backgrounds stripped to real transparency and trimmed from the cast dump
// at public/skid-cast/ — see docs/ for how (checkerboard-aware alpha cut,
// not a simple threshold, since the raw exports were flat JPEGs with the
// transparency-preview checker baked into the pixels).
const CAST: CastMember[] = [
  { file: "1enor.webp", name: "", ar: 0.8172 },
  { file: "6eotb.webp", name: "", ar: 1.561 },
  { file: "8oeld.webp", name: "", ar: 0.8047 },
  { file: "9qxba.webp", name: "", ar: 0.8047 },
  { file: "aqjqo.webp", name: "", ar: 0.8156 },
  { file: "arsgl.webp", name: "", ar: 0.7672 },
  { file: "blonde-woman.webp", name: "Blonde Woman", ar: 0.8703 },
  { file: "c9uhc.webp", name: "", ar: 0.7562 },
  { file: "d0vs2.webp", name: "", ar: 0.8047 },
  { file: "dazza.webp", name: "Dazza", ar: 0.9547 },
  { file: "deep-fried.webp", name: "Deep Fried", ar: 0.9219 },
  { file: "dufkl.webp", name: "", ar: 0.8047 },
  { file: "ecell.webp", name: "Chloe", ar: 0.7469 },
  { file: "explorer.webp", name: "Explorer", ar: 0.8859 },
  { file: "gtobt.webp", name: "", ar: 0.8 },
  { file: "hnhnb.webp", name: "", ar: 0.7391 },
  { file: "htavn.webp", name: "", ar: 0.8047 },
  { file: "hzoss.webp", name: "", ar: 0.7969 },
  { file: "j2u7s.webp", name: "", ar: 0.8047 },
  { file: "jesus.webp", name: "Jesus", ar: 0.9062 },
  { file: "kjewt.webp", name: "", ar: 0.8109 },
  { file: "krtob.webp", name: "", ar: 0.7828 },
  { file: "kyli.webp", name: "", ar: 0.9766 },
  { file: "l4mkf.webp", name: "", ar: 0.7078 },
  { file: "l7h9j.webp", name: "", ar: 0.8047 },
  { file: "lock-chain-woman.webp", name: "Lock & Chain Woman", ar: 0.9719 },
  { file: "mqbqz.webp", name: "", ar: 0.8047 },
  { file: "ocwpt.webp", name: "", ar: 0.8047 },
  { file: "qbroi.webp", name: "", ar: 0.7672 },
  { file: "sequin-woman.webp", name: "Sequin Woman", ar: 0.8797 },
  { file: "silas.webp", name: "Silas", ar: 1.0047 },
  { file: "street-cat.webp", name: "Street Cat", ar: 0.9766 },
  { file: "sv8u6.webp", name: "", ar: 0.8047 },
  { file: "w67xz.webp", name: "", ar: 0.8047 },
  { file: "xacyb.webp", name: "", ar: 0.7719 },
  { file: "xxl0y.webp", name: "", ar: 0.9703 },
  { file: "ysymx.webp", name: "", ar: 0.8047 },
  { file: "z0edw.webp", name: "", ar: 0.8047 },
];

function buildFigureNode(
  c: CastMember,
  variant: "walker" | "figure",
): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = variant === "walker" ? "hm-walker" : "hm-figure";

  const img = document.createElement("img");
  img.src = "/skid-cast/" + c.file;
  img.alt = c.name || "";
  img.loading = "lazy";
  wrap.appendChild(img);

  const shadow = document.createElement("div");
  shadow.className = "hm-shadow";
  wrap.appendChild(shadow);

  if (c.name) {
    const name = document.createElement("div");
    name.className = "hm-name";
    name.textContent = c.name;
    wrap.appendChild(name);
  }

  return wrap;
}

export default function HomePage() {
  const paradeRef = useRef<HTMLDivElement>(null);
  const companyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // ---------- the street: everyone, looping, walking past forever ----------
    const parade = paradeRef.current;
    if (parade) {
      parade.innerHTML = "";
      [0, 1].forEach(() => {
        CAST.forEach((c) => {
          const w = buildFigureNode(c, "walker");
          w.style.setProperty("--wd", "-" + (Math.random() * 2.6).toFixed(2) + "s");
          parade.appendChild(w);
        });
      });
      if (reduceMotion) parade.style.animation = "none";
    }

    // ---------- the company: bell-curve formation ----------
    const company = companyRef.current;
    let offInterval: ReturnType<typeof setInterval> | undefined;
    const offTimers: ReturnType<typeof setTimeout>[] = [];

    if (company) {
      company.innerHTML = "";
      const formation = [...CAST]
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(19, CAST.length));
      const n = formation.length;
      const maxH = company.clientHeight || 220;

      formation.forEach((c, i) => {
        const t = n > 1 ? (i / (n - 1)) * 2 - 1 : 0; // -1..1, 0 = centre
        const bell = 1 - 0.55 * t * t;
        const h = Math.max(0.48, bell) * maxH * 0.94;
        const leftPct = 5 + (i / Math.max(1, n - 1)) * 90;

        const fig = buildFigureNode(c, "figure");
        fig.style.left = leftPct + "%";
        fig.style.height = h + "px";
        fig.style.width = h * (c.ar || 0.75) + "px";
        fig.style.zIndex = String(Math.round(bell * 30));
        fig.style.setProperty("--sway-x", (Math.random() * 6 - 3).toFixed(1) + "px");
        fig.style.setProperty("--sway-r", (Math.random() * 2 - 1).toFixed(1) + "deg");
        fig.style.setProperty("--sway-dur", (4 + Math.random() * 3).toFixed(1) + "s");
        fig.style.setProperty("--sway-delay", "-" + (Math.random() * 4).toFixed(1) + "s");
        fig.dataset.side = t < 0 ? "left" : "right";

        company.appendChild(fig);
      });

      if (!reduceMotion) {
        offInterval = setInterval(() => {
          const figs = company.querySelectorAll<HTMLDivElement>(
            ".hm-figure:not(.hm-off)",
          );
          if (!figs.length) return;
          const pick = figs[Math.floor(Math.random() * figs.length)];
          const side = pick.dataset.side === "left" ? "hm-left" : "hm-right";
          pick.classList.add("hm-off", side);
          offTimers.push(
            setTimeout(() => {
              pick.classList.remove("hm-off", side);
            }, 6000 + Math.random() * 5000),
          );
        }, 5200);
      }
    }

    return () => {
      if (offInterval) clearInterval(offInterval);
      offTimers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <div className="hm-root">
      <div className="hm-sky" />
      <div className="hm-fog" />
      <div className="hm-grain" />
      <div className="hm-vignette" />

      <header className="hm-header">
        <span />
        <nav>
          <a href="https://aiglitch.app" target="_blank" rel="noopener noreferrer">
            Every link · aiglitch.app
          </a>
        </nav>
      </header>

      <div className="hm-centre">
        <h1 className="hm-mark">
          <small>A street nobody chose</small>Skidmarks
        </h1>
        <p className="hm-line">
          Thirty-eight people who never got out, going nowhere, forever, past
          the same houses.{" "}
          <b>Nobody&rsquo;s laughing at them harder than they laugh at themselves.</b>
        </p>
      </div>

      <div
        className="hm-company"
        ref={companyRef}
        aria-label="The full company, arranged and watching"
      />

      <div className="hm-street" aria-label="The cast, trudging past, forever">
        <div className="hm-kerb" />
        <div className="hm-parade" ref={paradeRef} />
      </div>

      <footer className="hm-footer">
        <span>© AIGLITCH — SKIDMARKS</span>
        <div className="hm-footer-links">
          <a href="/crash">Crash Lab</a>
          <span>·</span>
          <a href="/m">M</a>
          <span>·</span>
          <a href="/scratch">Scratch</a>
          <span>·</span>
          <a href="https://aiglitch.app" target="_blank" rel="noopener noreferrer">
            aiglitch.app
          </a>
        </div>
      </footer>
    </div>
  );
}
