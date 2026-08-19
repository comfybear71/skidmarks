# LTX-2.5 FLF2V — research notes

Logged **2026-08-19** from the official Comfy Hub listing Stuie sent:

[comfy.org/workflows/d78377cf53f4-d78377cf53f4](https://comfy.org/workflows/d78377cf53f4-d78377cf53f4/)

JSON pulled and read in this session: `https://comfy.org/workflows/download/d78377cf53f4.json` (130 588 bytes, Hub id `d78377cf53f4`). Knowledge only. Do **not** rebuild a live pack. Do **not** swap `/m` speech off Cloud LTX-2.3 IA2V.

Title on the page: **LTX-2.5: FLF2V**. Author: ComfyUI. Published 2026-08-12. Tags: Image Generation / FLF2V / Video.

---

## What this workflow is (plain)

You give it **two stills**: the picture the clip should **start** on, and the picture it should **end** on. LTX invents every frame in between, plus a soundtrack it makes up from the prompt.

That is **first + last frame → video**. It is not “one plate + our Saved mp3 → talking clip.”

| | This Hub graph | `/m` Generate today |
|---|---|---|
| Start still | Load First Frame | Shot plate (or chained last frame, if that PR is in) |
| End still | Load Last Frame — **required** | None. Motion is free after frame 0 |
| Audio | Model **writes** audio from the prompt (Audio VAE) | Our **ElevenLabs mp3** is the audio |
| Model | LTX-**2.5** distilled 22B | LTX-**2.3** IA2V template |
| Job | Interpolate two known pictures | Lip-sync a line on one picture |

If we pointed `/m` at this graph, Jo would not speak Stuie’s Saved line. She would speak whatever the Audio VAE invented. **Speech stays on IA2V.**

---

## Two Comfy products with the same name

Do not mix these up. The Hub URL is the **open-weights subgraph**. The Partner-node docs are a **billed API**.

1. **Native / local (this JSON).** Subgraph `First & Last Frame to Video (LTX-2.5)` (`cf70afc4-5a03-47ce-8210-734b1de6c6bc`). Loads `ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors` plus Gemma 4 and two VAEs. Runs on a GPU (Comfy Cloud or a pod) with the files on disk. Official native tutorial: [docs.comfy.org/tutorials/video/ltx/ltx-2-5](https://docs.comfy.org/tutorials/video/ltx/ltx-2-5).
2. **Partner API.** [docs.comfy.org/tutorials/partner-nodes/lightricks/ltx-2-5](https://docs.comfy.org/tutorials/partner-nodes/lightricks/ltx-2-5). One `last_frame` socket on an LTX-2.5 API node. Fast vs Pro. Billed **per second**. Fast I2V up to 20s / 4K; Pro FLF2V listing ships with Pro selected. No transformer file on disk.

Same idea (two stills → clip). Different bill, different node, different duration caps.

---

## Outside graph (what you see before “Enter subgraph”)

Five nodes:

| Node | Title / role | Verified widgets |
|---|---|---|
| `LoadImage` | **Load First Frame** | demo `robot_hand_back.png` |
| `LoadImage` | **Load Last Frame** | demo `robot_hand_energy.png` |
| Subgraph `cf70afc4-…` | **First & Last Frame to Video (LTX-2.5)** | prompt, enhance on, **5s**, **1280×720**, seed, **24 fps**, five model filenames |
| `SaveVideo` | writes `video/ltx2.5_flf2v` | auto codec |
| `MarkdownNote` | “Note: About LTX-2.5” | Hub copy of the model pitch + parameter table |

Default demo prompt (trimmed) starts with the lock we already use, then adds the **end** lock:

```
Use the provided start image as the first frame and the provided end image as the final frame anchor.
The video opens on the back of the robotic hand… [action beat by beat] …
the crystal's steady hum filling the silence as the video ends on the open palm with the glowing crystal.
```

Hub copy: describe the **transition**, keep both stills the **same aspect**, pre-crop if they mismatch. Duration in the player is **frames ÷ fps**. Bigger frame count, same fps = slower, smoother move.

---

## Inside the subgraph (the actual pipeline)

Nine groups. Order of work:

```
first still ─┐
             ├─ resize to width×height ─ LTXVPreprocess (CRF 18) ─ LTXVAddGuide
last still  ─┘                                                      │
prompt ─ (optional Gemma enhancer) ─ CLIP encode pos/neg ─ LTXVConditioning
empty video latent + empty audio latent ─ concat AV
Sampler (distilled 8-step, Dual CFG 1/1) ─ separate AV ─ decode video + decode audio ─ CreateVideo
```

### 1. Video settings

- Duration primitive default **5** seconds.
- Frame rate primitive default **24**.
- Width / height primitives default **1280 / 720**.
- Frame count = `duration * fps + 1` (`ComfyMathExpression` `a * b + 1`). That is the LTX **8n+1** rule: 5×24+1 = **121** = 8×15+1. Our IA2V template uses the **same** `a * b + 1` expression.

### 2. First / last still prep

Each still: `ResizeImageMaskNode` (scale to width×height, center, nearest-exact) → `LTXVPreprocess` **img_compression 18**. Hub FAQ: mismatch aspect stretches. Pre-crop both to the same size first.

### 3. Guides (the FLF2V trick)

Two `LTXVAddGuide` nodes, chained:

| Guide | `frame_idx` | `strength` | Meaning |
|---|---|---|---|
| First still | **0** | **0.7** | Lock the opening frame |
| Last still | **-1** (end of the latent) | **0.7** | Lock the closing frame |

Official node: [LTXVAddGuide](https://docs.comfy.org/built-in-nodes/LTXVAddGuide). Encodes the still through the **video VAE** and plants it as a keyframe in the conditioning. `strength` 1.0 = exact; this template uses **0.7** so the in-betweens can move. Negative index counts from the end. Single stills are allowed at any index; long video guides must sit on multiples of 8.

Then `LTXVCropGuides` lines the guides up with the latent canvas.

**This is the whole difference from IA2V.** `/m` Cloud uses `LTXVImgToVideoInplace` on **one** image (the plate / chained last frame) plus `LoadAudio` for the mp3. No second guide. No end still.

### 4. Prompt

- `PrimitiveStringMultiline` prompt in.
- `prompt_enhance` default **true** → `TextGenerateLTX2Prompt` on `gemma4_e2b_it_bf16.safetensors` (max_length 600, sampling on). `ComfySwitchNode` picks enhanced vs raw.
- Positive `CLIPTextEncode` from the Gemma **12B** LTX encoder.
- Negative is a long stock dump (blurry, extra limbs, mismatched lip sync, added dialogue, 3D CGI look, …). Not our show lock.

Native I2V docs: do **not** re-describe what is already in the start still. Describe **what happens next**. FLF2V docs: describe **the transition** and the audio you want the model to invent.

### 5. Model files (gated Hugging Face `Lightricks/LTX-2.5`)

| Slot | File | Role |
|---|---|---|
| unet | `ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors` | Distilled DiT. Comfy int8 only — not for `ltx-pipelines` |
| video_vae | `ltx-2.5-video-vae-bf16.safetensors` | Encode guides / decode frames |
| audio_vae | `ltx-2.5-audio-vae-bf16.safetensors` | Invent + decode soundtrack |
| clip | `gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors` | Text encoder |
| prompt_enhance_model | `gemma4_e2b_it_bf16.safetensors` | Short-prompt expander |

FLF2V **does not** load the spatial ×2 upscaler that T2V/I2V templates include. Distilled recipe: **explicit 8-step sigma schedule**, **CFG = 1** (unguided). This graph matches that: `ManualSigmas` `1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0` and `LTXVDualCFGGuider` **video_cfg 1 / audio_cfg 1**. `SamplerEulerAncestral` eta 0, s_noise 1.

### 6. Sampling + decode

Empty video latent + empty audio latent → `LTXVConcatAVLatent` → `SamplerCustomAdvanced` → `LTXVSeparateAVLatent` → `VAEDecodeTiled` (tile 768) + `LTXVAudioVAEDecode` → `CreateVideo` at the chosen fps.

There is **no `LoadAudio`**. Sound is generated. To export silent, the RunComfy write-up says disable the audio branch before `CreateVideo` — still not a path for our mp3.

---

## LTX-2.5 model facts (from the note + HF + Comfy tutorials)

Carried from 2.3: native 4K, **synchronized audio-video**. New in 2.5:

- **Pixel Diffusion / Diffusion Fidelity Rendering** — keyframes-first; this FLF2V graph *is* that idea (two keyframes, in-betweens filled).
- **Diffusion Video Decoder** — sharper faces, less smear (this template’s FLF2V decode is still the convolutional VAE, not the extra DiT decoder).
- **Native multishot** — one generation, several connected shots. Prompt in prose (“A hard cut transitions to…”).
- **Gemma 4 12B** encoder + **prompt enhancer**.
- **Auto Duration** — duration head can guess clip length from the action. This subgraph still exposes a **Duration** primitive (default 5).
- Distilled 22B is the fast path; full/SFT transformer uses real CFG and step counts, not this 8-step list.

HF CLI equivalent of FLF2V is `--image path FRAME_IDX STRENGTH` (frame 0 = first). Last frame is the same flag at the end index.

---

## How this sits next to our send path

Verified against `workflow/LTX_2.3_IA2V_Cloud.json` and `src/lib/ltxCloudIa2v.ts` in this session.

| Piece | FLF2V Hub graph | `/m` Cloud IA2V |
|---|---|---|
| Start lock | `LTXVAddGuide` idx **0**, strength **0.7** | `LTXVImgToVideoInplace` on the plate |
| End lock | `LTXVAddGuide` idx **-1**, strength **0.7** | none |
| Audio in | none (Audio VAE out) | `LoadAudio` + encode our mp3 |
| Duration | 5s default, user primitive | follows mp3, pad to **4s**, ceiling 180s |
| FPS | 24 | 24 |
| Frame math | `sec * fps + 1` | same expression in the template |
| Prompt lock | start **and** end image | “Use the provided start image as the first frame” |
| Enhance | Gemma E2B on by default | we send the gold paragraph as-is |
| Speech | described in the prompt, model voices it | Stuie’s words on the mp3 |

### Last-frame chaining (cousin, not this graph)

A split rant that feeds **clip N’s last frame** in as clip N+1’s **start still** is the first half of FLF2V (guide at 0). It is **not** this workflow unless we also pass a **known last still** at −1.

We do not have that last still for a talking chunk unless we draw it (Scratch / a target pose plate). Guessing an end face from the next sentence would be a new Draw, not this Hub graph.

Using FLF2V for a rant without an end still, or with the original plate as the end, would **pull the mouth back** to the plate pose — the snap we are trying to avoid.

**Do not** send FLF2V for `/m` lip-sync. The mp3 would be ignored.

### Where FLF2V *would* earn a test later

Scratch / silent camera: two scored stills (Jo sitting → Jo standing, same place, same face card), 4–6s, same aspect, prompt describes only the move. That is the Hub demo (robot hand back → palm + crystal). Speech stays off until Stuie opens it.

---

## Practical rules locked from this graph

1. Two stills, **same aspect**, same lighting, same person/place. Pre-crop. Do not feed the 4-view character sheet.
2. Prompt: one paragraph, **start lock + end lock + what happens between + the sounds**. Do not re-describe the stills.
3. Length: `seconds × 24 + 1` frames. Default 5s. Hub: more frames, same fps = slower.
4. Distilled: leave CFG at 1 and the 8-step sigma list alone.
5. Guide strength **0.7** in this official template — not 1.0.
6. Generated audio ≠ Saved mp3. `/m` stays IA2V.
7. Gated HF repo — download fails until the license is accepted.
8. Partner API FLF2V is a different node and a different bill.

---

## Sources opened this session

- Hub page + downloaded JSON `d78377cf53f4.json` (nodes, widgets, subgraph groups).
- [Comfy native LTX-2.5](https://docs.comfy.org/tutorials/video/ltx/ltx-2-5)
- [Comfy Partner LTX-2.5 API](https://docs.comfy.org/tutorials/partner-nodes/lightricks/ltx-2-5)
- [LTXVAddGuide](https://docs.comfy.org/built-in-nodes/LTXVAddGuide)
- [Hugging Face Lightricks/LTX-2.5](https://huggingface.co/Lightricks/LTX-2.5) (file table, distilled CFG=1, `--image` guides)
- RunComfy write-up of the same FLF2V+audio layout (group names, no LoadAudio)

Related studio files: `workflow/LTX_2.3_IA2V_Cloud.json`, `src/lib/ltxCloudIa2v.ts`, `docs/PLATE_AUTOMATION_ARCHIVE.md`.
