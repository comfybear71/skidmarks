# Comfy.org workflows — research (2026-08-23)

Source: [comfy.org/workflows](https://comfy.org/workflows/) plus a live Cloud MCP catalog pull the same day. **Search / list only. No `run_template`. No credits.**

Hub homepage said **616+** templates. Featured row is mostly **partner API** (Seedance 2.5, MiniMax H3, FLUX 3 Video, Grok Imagine, Topaz), not our speech path.

`get_catalog_overview` tag counts (verbatim, this session):

| Tag | Count |
|---|---|
| API | 314 |
| Video | 135 |
| Image | 109 |
| Image to Video | 74 |
| Text to Video | 46 |
| FLF2V | 28 |
| ControlNet | 25 |
| Lip Sync | 12 |
| Character Reference | 10 |
| Motion Control | 9 |
| Frame Interpolation | 3 |

MCP `search_templates q=LTX` returned **32** LTX-named graphs. Cryptomatte = **0**. GLIGEN = **0**.

Run a listed id later with `run_template` / `get_template` (`https://cloud.comfy.org/templates/<name>.json`). Hub pages are `https://comfy.org/workflows/<id>`.

## Already ours — do not swap

| Hub / MCP id | What it is | Us |
|---|---|---|
| `video_ltx2_3_ia2v` | **LTX-2.3: Image Audio to Video.** LoadImage + LoadAudio + `Video Generation (LTX-2.3)`. Tags: Image to Video, Lip Sync. Schema slot `340.audio`. | This **is** `/m` Generate. Desk copy: `workflow/LTX_2.3_IA2V_Cloud.json` via `src/lib/ltxCloudIa2v.ts`. |
| `video_ltx2_5_flf2v` | Two stills → in-betweens + invented audio. Subgraph `cf70afc4-…`. | Already in `docs/LTX_25_FLF2V_RESEARCH.md`. **Not** speech. |

## Map to Crazy Big Hole dumps (menu, not this test)

| Dump idea | Closest live template | Clash / hold |
|---|---|---|
| Tile + Depth cage | **No LTX-2.3 Tile+Depth template.** Closest: `video_ltx2_depth_to_video` + `video_ltx2_canny_to_video` (**LTX-2**, not 2.3). 2.3 control is **IC-LoRA**, not classic ControlNet: `video_ltx2_3_ic_lora` (Union Control, LoadVideo + LoadImage). | Do not treat dump 12 Apply Advanced ControlNet as a Hub graph we can click. |
| IP-Adapter turnaround | Hub IP-Adapter hits = **2**, both AnimateDiff (`template_animate_diff_loops`, `templates_purz_animatediff_simple_weighted_ipadapters_looping_animation`). `template_ltx2_3_ic_lora_ingredients` = **LTX-2.3 IC-LoRA: Reference Sheet Control**. Also `templates-character_sheet` = **360 Full-body Turnaround**. | **Sheet / turnaround stays out.** Single JO TOO card only. |
| Cryptomatte / GLIGEN | **Zero** templates. | Still need a real ID PNG + Mask By Color, or SAM. |
| Echo / latent inject | No named template in this pull. | — |
| Low-motion LTX + FILM/RIFE | `utility_video_frame_interpolation` (models **FILM, RIFE**). Also `utility-frame_interpolation-film`, `utility_gimm_frame_interpolation`. | Post on a finished mp4. Do not replace IA2V. |
| Wan Animate / path draw | `video_wan_animate2`, `video_wan_animate2_distilled`, `video_wan2_2_14B_animate`, `video_wanmove_480p`. | Already in `docs/COMFY_ANIMATION_RESEARCH.md`. Motion without our mp3. |
| Kick / identity lock | `video_ltx2_3_id_lora` (ID LoRA + audio). Research dump IC-LoRA weight 0.75. | Optional later. Not speech default. |

## Other LTX ids (do not put on `/m` speech)

- `video_ltx2_5_i2v` / `api_ltx2_5_i2v` — featured **LTX-2.5 I2V** (and billed Pro). Image only. Invents audio if any. **Not** our Saved mp3.
- `video_ltx2_5_t2v` / `api_ltx2_5_t2v`
- `video_ltx2_3_i2v` / `video_ltx2_3_t2v` / `video_ltx2_3_flf2v`
- Edit LoRAs: outpaint, remove object/subtitles/watermark, googly eyes, dearchive, style transition
- Older `video_ltx2_*` and `ltxv_*` (0.9.5)

`search_templates q=LTX-2.3` claimed **259** hits — many are MiniMax/Seedance false friends. Trust the **32** from `q=LTX` plus the Lip Sync tag list.

## Lip Sync tag (12)

`video_ltx2_3_ia2v` is first. Also ID LoRA, Sync 3, HeyGen, InfiniteTalk, LivePortrait, `template_image_speech_to_video` (ElevenLabs + Gemini + LTX — **not** our locked voice file).

## Character Reference tag (10)

Almost all **partner** R2V (Grok, Kling, Vidu, Wan). Plus `templates-character_sheet` (360 turnaround) and `templates-multiple_consistent_shots-nb_pro`. **Do not** feed `plate_{slug}` into those.

## How to use this later

1. He names a test.
2. `search_templates` / `get_template_schema` for that id.
3. `estimate_credits` then `run_template` — only after go.
4. Speech clips stay IA2V + our mp3.

Do not download every Hub JSON into the repo. One template = one test.