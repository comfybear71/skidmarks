# Skidmarks Studio

Built **ad hoc** — one chunk at a time. Runs on your PC. **Crash Lab** is the desk: cast, story, plates, voice, Animate/LTX. RunPod Comfy for LTX.

Old routes `/lab` (Character Lab) and `/locations` (Location Lab) are **not required** anymore — pages may still exist, but new work happens in Crash Lab.

## Start (PC)

```bash
cd "C:\Users\Stuie\Desktop\MY MOVIES\blueprint\planner"
npm run dev
```

Same thing: `npm run dev:lan`

**On this PC:** http://localhost:3737/crash  
**Crash Lab:** http://localhost:3737/crash

## iPhone / home network

Studio listens on **all interfaces** (`0.0.0.0:3737`), so your phone can reach it on the same Wi‑Fi.

1. On the PC, run `npm run dev` (leave that window open).
2. Find your PC’s Wi‑Fi IP:
   - PowerShell: `ipconfig`
   - Look under **Wireless LAN adapter Wi‑Fi** → **IPv4 Address** (often `192.168.x.x`)
3. On iPhone Safari (same Wi‑Fi): `http://YOUR-IP:3737/crash`  
   Example shape: `http://192.168.1.88:3737/crash`
4. If the phone can’t connect: Windows Firewall may be blocking Node — allow **Node.js** private networks, or temporarily allow port **3737**.

Phone is for checking UI / reading. Heavy jobs (Gen plate, Speak, LTX) still run on the PC + pod.

## Keys

Copy [`.env.example`](.env.example) → `MY MOVIES\.env` (repo root) or `blueprint/planner/.env` as your setup uses. Never commit real keys.

```
ELEVENLABS_API_KEY=...
XAI_API_KEY=...
COMFY_URL=...
DATABASE_URL=...
```

Restart `npm run dev` after changing keys.

## Deploy / GitHub

See [DEPLOY.md](DEPLOY.md). Crash Lab is **not** a full Vercel app — media + Comfy stay local.

## Do it yourself (LTX)

See [DIY_LTX.md](DIY_LTX.md) — start Studio, start pod, Send, Fail/redo.

## North star (Crash Lab)

1. Cast + voice in Crash Lab  
2. Story / plates / Speak  
3. Animate — LTX (pod)  
4. Resolve — cut  

## Locked

- STYLE_LOCK + English/Australian comedy only  
- Positive prompts only  
- Plan evolves when you bump into it  
