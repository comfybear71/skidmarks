# Comfy Cloud animation — research notes

Logged **2026-08-19** from the tutorials Stuie sent. Knowledge only. Do **not** rebuild a live pack. Do **not** swap `/m` speech off Cloud LTX-2.3 IA2V.

**Order already on `master`:** PR **#176** (Scratch Draw edits the last still) then PR **#177** (Scratch stills vs `/m` speech floors). This note sits on top of those.

Official index: [docs.comfy.org/llms.txt](https://docs.comfy.org/llms.txt). Cloud host: `https://cloud.comfy.org`. Native LTX-2.3 docs: [LTX-2.3 workflows](https://docs.comfy.org/tutorials/video/ltx/ltx-2-3.md).

---

## What we already run

| Job | Workflow / model | Where |
|---|---|---|
| `/m` speaking clip | **LTX-2.3 IA2V** — plate still + mp3 + one IMAGE MOTION paragraph | `workflow/LTX_2.3_IA2V_Cloud.json`, `src/lib/ltxCloudIa2v.ts` |
| Pod Send to LTX | LTX Director hotfix (`LTXDirector`, KJ nodes, LTXV*) | `src/lib/ltxPreflight.ts` |
| Scratch still | Siray Seedream / XAI plateCast — **no speech yet** | `/scratch` |
| FX | Wan explosion graph | `wan_fx` |

Cloud native names the same IA2V job: **Image-Audio-to-Video** — “upload an image and an audio file to generate lip-synced video.” That is `/m` Generate. Do not send `says` / lip-sync to Siray i2v (mouth melt).

---

## The seven sources

### 1. [Motion Path Animation From A Single Image with WanMove](https://www.youtube.com/watch?v=fJ3R43T3tRg)

**What:** One still → video by **drawing motion paths**, not keyframes. **Wan-Move** (Alibaba Tongyi) + **WanVideoWrapper** + **FL Path Animator** (or native `WanMoveTrackToVideo`). Cloud workflow exists.

**Official:** [Wan-Move tutorial](https://docs.comfy.org/tutorials/video/wan/wan-move.md). ~5s, 480p. Models: `Wan21-WanMove_fp8…`, `lightx2v_I2V_14B_480p_…` LoRA, `umt5_xxl`, `clip_vision_h`, `wan_2.1_vae`.

**Design choice:** load the image **into** the path editor (not only Load Image → animator). Comfy has no standard pause; otherwise Queue would start before you draw.

**For us:** Scratch **motion without speech** later — “hand raises, head turns” on a locked plate. **Not** `/m` lip-sync. Do not feed the 4-view character sheet as the still.

### 2. [Wan 2.2 Animate masterclass](https://www.youtube.com/watch?v=PJJjN1MrfJQ)

**What:** **Wan 2.2 Animate 14B** via **ComfyUI-WanVideoWrapper** + **KJNodes**. Preflight: update Comfy, wrapper, KJNodes.

**Two modes** ([native docs](https://docs.comfy.org/tutorials/video/wan/wan2-2-animate.md)):

| Mode | Inputs | Result |
|---|---|---|
| **Move / Animation** | Plate still + driving video (pose + face). Disconnect background + mask. | Subject moves; **keeps the plate’s place** |
| **Mix / Replacement** | Reference still + video + **Points Editor** mask (green = replace, red = keep) | Subject **into the video’s place**, lighting matched |

Driving video should be a **human actor** for OpenPose. Prompts are weak; masks/pose are the control. Resolution Master — mismatch crops. Native “Video Extend” = +77 frames (~4.8s) per block.

**For us:** Move mode is “Jo’s plate, Matty’s acting clip.” Replacement is VFX, not Crash Lab default. Points Editor needs a first run or a pasted frame (same pause problem as Wan-Move).

### 3. [Comfy Org stream — AnimateDiff + IP Adapter](https://www.youtube.com/watch?v=tqVkHj17Ifo)

**What:** History + a **weighted IP-Adapter** loop: N stills, hold N frames each, **AnimateDiff Evolved** (16-frame context, stride/loop) + **Animate LCM**. SD1.5 (`realism by stable yogi` + Animate LCM is their goat). Prompt is almost unused (“magical transformation”) — **images are the prompt**.

**Vs Wan first/last frame:** Wan often **crossfades**. AnimateDiff **drags you through** the two pictures (drunk uncle). Superpower = **perfect loops** (repeat first still as last). Motion knobs are touchy (1.00–1.15). Render low, then high-res fix. Potato GPU (8 GB).

**For us:** Artistic still-to-still, not lip-sync. Do not put this on `/m` speech. Scratch “morph three plates” later, maybe.

### 4. [Unlimited animation by stitching 5s clips](https://www.youtube.com/watch?v=tPOOm1YRMRc&t=94s) (from 1:34)

**What:** Classical **key / in-between**. Three templates (Comfy ≥ 0.3.48):

1. **Flux** — hero still (character + place).
2. **Flux Context** — next **key still** (small pose change, same person).
3. **Wan 2.2 first + last frame → video** (~5s). AI is the in-betweener.

Soft keys only — a 5s clip cannot survive a scene jump. Time the gesture in a mirror. 14B ≈ hours on a 3090; **5B ≈ 30 min**, a bit softer. Stitch in an editor.

**For us:** Same idea as `/m` rant split: **chunk, don’t one-shot a minute**. Our speaking chunks are **4–6s / ≤15 words**. Their visual chunks are **~5s keys**. Do not use FLF2V for lip-sync (no mp3).

### 5. [ComfyUI text-to-image](https://docs.comfy.org/tutorials/basic/text-to-image)

**What:** Checkpoint = UNet + CLIP + VAE. Empty latent = canvas. CLIP encode pos/neg. **KSampler** denoises. VAE Decode → pixels.

**Img2img:** denoise **1.0** = full noise (txt2img). **Lower denoise** keeps the input. Our plates are **ref2i** (place + face cards), not empty latent.

**SD1.5** wants 512², English comma phrases, `(token:1.2)` weights. That is **not** Sunny Banks / Skidmarks gold. Do not paste SD1.5 quality tags onto LTX IMAGE MOTION.

### 6. [SCAIL2 character replace, long video](https://www.youtube.com/watch?v=Og-2FWCUy8Q)

**What:** Template **SCAIL-2** on **Wan 2.1** + LoRA. Native cap **81 frames**. Full body (head + legs). Hands/props weak. Stitch 81-frame chunks with **~5 frame overlap**.

Custom graph: analyse footage → per-person colour masks (re-entry) → optional stop after analysis → cache so a crash can resume. Multi-character refs **front/side/back**.

**Official:** [SCAIL-2 tutorial](https://docs.comfy.org/tutorials/video/zai/scail2.md).

**For us:** Series **character plate** (4-view) is the right *kind* of ref for SCAIL2. It is still **never** handed to `plateCastIntoGen` (doubles). This is replace-in-footage, not plate → speak.

### 7. [Long movies with LTX Director Multi](https://www.youtube.com/watch?v=4uga6S4cf5o)

**What:** **LTX Director** — prompt-relay + keyframes on a timeline. One click, but long clips OOM. Fix: **two Director graphs**, overlap the last key of part 1 with scene 6, concat.

**Prompt shape per scene:** Environment, Action, Camera, Dialogue. **Simple.** Global cinematic lock. Keys **6 seconds apart**. Character stills from GPT / Gemini / Flux Edit. GGUF + transition LoRA + VRAM cleanup.

**For us:** We already preflight `LTXDirector` / `LTXDirectorGuide` on the **pod**. `/m` Cloud is **IA2V** (still + mp3), not Director Multi. **6s key spacing = `LTX_RANT_HOLD_SEC`**. Do not dump Director Multi onto a live pack. If we ever chain episodes, overlap one still at the cut (same as their scene 6 trick).

---

## LTX-2.3 native menu (Cloud)

From the official 2.3 page — pick by job, don’t mix:

| Template | Inputs | Use |
|---|---|---|
| T2V | text | No plate — skip |
| I2V | still | Idle / hold, **no** mp3 |
| FLF2V | start + end still | Key in-betweens (tutorial 4) |
| **IA2V** | **still + audio** | **`/m` gold — this is us** |
| IC-LoRA | still + driving video (depth/pose/edge) | Pose lock without Wan Animate |
| ID-LoRA | still + short audio | Voice/look personalise — not our shelf |

Checkpoint we already name in the committed graph: `ltx-2.3-22b-dev-fp8.safetensors` + distilled LoRA + spatial upscaler.

---

## Firm rules for this studio

1. **Stills first (#176)** — next Draw edits the last still. Empty room only after Clear.
2. **Speech on `/m` only (#177)** — Scratch does not lip-sync yet.
3. **Lip-sync = LTX-2.3 IA2V.** Wan-Move / AnimateDiff / FLF2V / SCAIL2 are other jobs.
4. **Chunk ~5–6s.** Rants split; Director keys sit 6s apart; Wan FLF is ~5s; SCAIL2 native 81 frames.
5. **Soft keys.** Big pose/place jumps hallucinate (walkers, morphs).
6. **Driving video ≠ mp3.** Wan Animate Move needs a human performance clip. `/m` needs the Saved line.
7. **Character sheet ≠ compositor ref.** Sheet is identity/SCAIL2. Shot plates use one face card.
8. **Export API JSON** (`Workflow → Export (API)`), commit under `workflow/`. UI format will not patch.

---

## Later (not now)

- Scratch: Wan-Move paths on a locked plate (no `says`).
- Optional: Wan Animate **Move** if we ever record a driving take.
- Optional: AnimateDiff loops from a folder of plates (VJ, not dialogue).
- Optional: Director Multi **after** IA2V clips exist — concat, don’t rewrite `story_json`.
