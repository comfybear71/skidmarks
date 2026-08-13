import fs from "fs";
import path from "path";
import { SKIDMARKS_EPISODES } from "./paths";
import type { Episode, Scene, Shot } from "./types";

function shotBlock(shot: Shot): string {
  const silent = shot.kind === "silent" || !shot.voice;
  return `# ${shot.code} — ${shot.title}

**Cut under:** ${shot.cutUnder || "—"}  
**Kind:** ${shot.kind}  
**Plate:** \`plates/${shot.plate || "TODO.png"}\`  
**Voice:** ${silent ? "**SILENT** (no TEXT row)" : `\`voice/${shot.voice}\``}

**Settings:** ${shot.width}×${shot.height} · Guide **${shot.guide}** · IMAGE **${shot.imageSeconds}s**${silent ? "" : ` · TEXT **${shot.textSeconds}s**`} · Inpaint **${shot.inpaintOff ? "OFF" : "ON"}**

**GLOBAL**
\`\`\`
${shot.global.trim() || "(paste global)"}
\`\`\`

**IMAGE motion**
\`\`\`
${shot.imageMotion.trim() || "(motion)"}
\`\`\`
${
  silent
    ? ""
    : `
**TEXT / SEGMENT** (attach mp3 · Inpaint OFF)
\`\`\`
${shot.textSegment.trim() || "(spoken words matching mp3)"}
\`\`\`
`
}
→ \`renders/${shot.code}_${slugify(shot.title)}.mp4\`  
**Resolve:** ${shot.resolveNotes.trim() || "—"}

---
`;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

function sceneMarkdown(episode: Episode, scene: Scene): string {
  const lines = [
    `# ${episode.show} — ${episode.title}`,
    `## ${scene.slug} — ${scene.title}`,
    "",
    scene.notes ? `${scene.notes}\n` : "",
    "**Paste sheet** — one block per shot. Upload `plates/` + `voice/` once, leave Hotfix open.",
    "",
    "| Setting | Value |",
    "|---------|-------|",
    "| Size | 768×512 default |",
    "| POD | localhost planner export — queue on RunPod Comfy |",
    "",
    "---",
    "",
  ];
  for (const shot of scene.shots) lines.push(shotBlock(shot));
  return lines.join("\n");
}

export type ExportResult = {
  episodeDir: string;
  written: string[];
};

export function exportEpisodePack(episode: Episode): ExportResult {
  const episodeDir = path.join(SKIDMARKS_EPISODES, episode.slug);
  const scenesRoot = path.join(episodeDir, "01_scenes");
  const written: string[] = [];

  fs.mkdirSync(scenesRoot, { recursive: true });

  const indexLines = [
    `# ${episode.show} — ${episode.title}`,
    "",
    episode.logline ? `> ${episode.logline}\n` : "",
    `**Character:** ${episode.characterNote || "—"}`,
    "",
    "| Scene | Paste sheet |",
    "|-------|-------------|",
  ];

  for (const scene of episode.scenes) {
    const sceneDir = path.join(scenesRoot, scene.slug);
    for (const sub of ["plates", "voice", "sfx", "renders"]) {
      fs.mkdirSync(path.join(sceneDir, sub), { recursive: true });
    }
    const mdPath = path.join(sceneDir, "DIRECTOR.md");
    fs.writeFileSync(mdPath, sceneMarkdown(episode, scene), "utf8");
    written.push(mdPath);

    const sceneMd = path.join(sceneDir, "SCENE.md");
    fs.writeFileSync(
      sceneMd,
      `# ${scene.title}\n\n${scene.notes || ""}\n\nShots: ${scene.shots.length}\n`,
      "utf8",
    );
    written.push(sceneMd);

    indexLines.push(
      `| **${scene.slug}** | \`${scene.slug}/DIRECTOR.md\` (${scene.shots.length} shots) |`,
    );
  }

  const blueprints = path.join(scenesRoot, "BLUEPRINTS.md");
  fs.writeFileSync(blueprints, indexLines.join("\n") + "\n", "utf8");
  written.push(blueprints);

  const readme = path.join(episodeDir, "README.md");
  fs.writeFileSync(
    readme,
    `# ${episode.title}\n\nExported from localhost Episode Planner.\n\nOpen \`01_scenes/BLUEPRINTS.md\` then each scene \`DIRECTOR.md\`.\n`,
    "utf8",
  );
  written.push(readme);

  return { episodeDir, written };
}
