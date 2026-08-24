# AnimateDiff morph loop — recipe mapped to Cloud

Logged **2026-08-24** from Stuie’s “infinite morphing dreamscape” paste. Knowledge + one short off-pack trial. Do **not** generate onto Forgotten. Do **not** swap `/m` speech off Cloud LTX-2.3 IA2V. Do **not** feed `plate_{slug}` sheets or the KING head still into this graph.

This is the **intermission / concert-art** floor, not the people floor.

| Floor | Engine | Audio |
|---|---|---|
| People / head hold | Cloud **LTX-2.3 IA2V** + Saved mp3 | Our track |
| Concert / trippy loop | **AnimateDiff** (this note) or muted LTX-2.5 I2V | Mute invented audio. Track stays the song |

---

## What he pasted (verbatim idea)

1. Checkpoint: DreamShaper (SD 1.5) or abstract surrealism.
2. AnimateDiff Loader (Advanced) + **`v3_sd15_mm.ckpt`**.
3. Prompt travel via FizzNodes **Batch Prompt Schedule** — keys at 0 / 32 / 64 / 96, last key repeats frame 0.
4. IPAdapter Advanced ~**0.5** on a colorful abstract still + a little latent noise between frames.
5. KSampler CFG **7–9**, steps **25–30**, `euler_ancestral` or `dpmpp_2m_sde`.
6. VAE Decode → **VHS_VideoCombine** GIF or WebM at **12 or 15 fps**.

---

## What is actually on Comfy Cloud (this session)

Checked live `GET /api/object_info` and Hub templates. Not guessed.

| Recipe name | On Cloud? | Live name |
|---|---|---|
| DreamShaper SD 1.5 | **Yes** | `dreamshaper_8.safetensors`, `DreamShaper_8_pruned.safetensors` |
| AnimateDiff Loader (Advanced) | **Yes** | `ADE_AnimateDiffLoaderV1Advanced` (also Gen1 / Evolved `ADE_LoadAnimateDiffModel` + `ADE_UseEvolvedSampling`) |
| `v3_sd15_mm.ckpt` | **Yes** | Same filename on the loader combo |
| FizzNodes `BatchPromptSchedule` | **No** | Closest: `ADE_PromptScheduling` (JSON / pythonic `0: "…"`, `16: "…"`). `ScaleBatchPromptSchedule` exists and *mentions* Fizz, but the Fizz node itself is not installed |
| IPAdapter Advanced weight 0.5 | **Yes** | `IPAdapterAdvanced` (`weight` −1…5, default 1.0) + `IPAdapterUnifiedLoader` |
| Latent noise between frames | **Yes** | `ADE_NoiseLayerAdd` → `ADE_AnimateDiffSamplingSettings.noise_layers` |
| `euler_ancestral` / `dpmpp_2m_sde` | **Yes** | Native `KSampler` |
| VHS GIF / WebM 12–15 fps | **Yes** | `VHS_VideoCombine` formats include `image/gif` and `video/webm` |

Hub graphs already on Cloud (UI format, subgraphs — not a one-click API export):

- `template_animate_diff_loops` — Model Loading + three passes + **VHS at 15 fps** (`video/h264-mp4`).
- `templates_purz_animatediff_simple_weighted_ipadapters_looping_animation` — three stills → weighted IP-Adapter + AnimateDiff + **VHS at 24 fps**. Images are the prompt. That is the Comfy Org stream we already logged in `docs/COMFY_ANIMATION_RESEARCH.md`.

There is **no** Hub id named `animatediff_prompt_travel`. Prompt travel is `ADE_PromptScheduling` on a custom graph.

---

## First off-pack trial (ran this session)

Cloud job `c6572fed-33fa-4040-9135-bc88202f5b7c`. Finished in **26s**. Not written to Neon.

Short graph, not 96 frames: **16** frames (v3 context length), 512², closed loop, DreamShaper 8 + `v3_sd15_mm.ckpt`, his four lines scaled to 0 / 5 / 10 / 15, CFG **7.5**, **25** steps, `euler_ancestral`, `ADE_NoiseLayerAdd` weight **0.08**, VHS **WebM @ 12 fps**, `loop_count` 2 (file is **4.0s**). No IP-Adapter on this first run.

What I actually saw in the frames: **mandala the whole way**. Frame 0 is a neon mandala (that prompt held). Frames 5 / 10 / 15 stay kaleidoscope flowers — I did **not** get a clear cosmic eye or chrome octopus. 16 frames with the same line at both ends is too short for four destinations; the schedule blends back into the mandala. The motion is fluid, not a slideshow. That part of the recipe is real.

Next trial (he said keep the four darker stills and test): **32 frames + IP-Adapter 0.5** on those art stills, plus muted LTX-2.5 I2V on the same files. Results below.

---

## Four darker empty stills — off-pack test (same session)

Stills made through `/m` location path (`buildLocationPrompt` + `grok-imagine-image`, `music_video`, slider 100, 16:9). Empty places only. **Not** written to Forgotten.

Then two floors on each still. Mute. No Jack.

| Floor | Graph | Size / length |
|---|---|---|
| AnimateDiff + IP-Adapter 0.5 | DreamShaper 8 + `v3_sd15_mm` + `IPAdapterUnifiedLoader` STANDARD + `IPAdapterAdvanced` weight **0.5** linear, 32 frames, 768×512, VHS WebM 12 fps `loop_count` 2 (**8.0s**) | Jobs `d4f039cf…` circus, `c63a2976…` cabin, `d1d87567…` canyon, `460e4213…` estate |
| LTX-2.5 Fast I2V | Partner `LtxApi25ImageToVideo`, 5s, 1280×720, `generate_audio: false` | Jobs `5fe704ca…` circus, `020157c1…` cabin, `fe2b0ce5…` canyon, `1616a330…` estate |

What the clips actually showed (frames + video review):

| Still | AnimateDiff + IP-Adapter 0.5 | LTX-2.5 I2V hold |
|---|---|---|
| Abandoned red circus | **Remake.** Small red tent inside a bigger red space, **white** smoke. Not the original big-top + black smoke + cyan bars. Empty. Smoke moves, tent holds | **Holds the still.** Red tent interior, black smoke, cyan neon bars. Smoke rises. No people |
| Fog cabin | **Remake.** Dark teal cabin, diffuse fog, no god-rays. Empty. Fog pulses | **Holds the still.** Log cabin, pale god-rays, rolling fog. No people |
| Black-groove canyon | **Remake.** Simpler cave, red/cyan veins, camera push. Empty | **Holds the still.** Winding canyon, veins pulse, some green leftover. Camera push. Empty |
| Fog estate | **Remake.** Softer different mansion, **closed** gate. Empty | **Start holds** the open-gate house. Fog rolls in. **End: house gone**, even the red windows swallowed |

So IP-Adapter 0.5 on an art still does **not** lock the holy still. It paints a cousin of the place. LTX-2.5 I2V is the floor that uses the still as the first frame. Estate fog still ate the house — same class of empty-out as the KING fade trial.

---

## KING WITH A KEY — the head effect (why this is a different floor)

Job `mgen_20260823081619901_4b0`. Vibe on the job: *Gorgoroth only. Just his head on the red smoky room, singing the lyrics. No other people.*

That gold was **LTX-2.3 IA2V** on a head-only still, not AnimateDiff. Clip 0 holds the head through the middle, then **melts into a guitarist** near 38s. So the head look is real, and long windows still invent a body.

Off-pack LTX-**2.5 Fast I2V** (5s, 1280×720, `generate_audio=false`, partner node `LtxApi25ImageToVideo`) on a **copy** of that still:

| Trial | What we asked | What the frames showed |
|---|---|---|
| hold | Head stays, smoke creeps, mouth closed | Head holds start → end. Smoke moves. No guitarist in 5s |
| fade | Fade in / stay / fade into smoke | Start has the head. End is an **empty red stage** — head gone |
| loop | Same still as last frame | Start has the head. Mid is **empty smoke**. End has the head again (fade out / fade in, not a hold) |

So 2.5 I2V can hold a short head, or it can empty the room. It does not do the mandala → eye → octopus morph. That is AnimateDiff’s job.

---

## Hold

- Do not point `/m` Generate at this graph.
- Do not drop these loops onto Forgotten intermissions until he names that attach.
- IP-Adapter still must be **art**, not Jack / Horn / Gorgoroth / a character plate.
- For intermission **from a kept still**, use muted LTX-2.5 I2V (or LTX-2.3 IA2V with our mp3). AnimateDiff + IP-Adapter 0.5 remakes a cousin; it does not hold the still.
