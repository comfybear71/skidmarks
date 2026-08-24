# Concert loop plates — Jack Ash

Logged **2026-08-24** from Stuie’s “Double Talkin' Jive” / gold-skull research. He wants this feature: **looping art plates**, not only band members.

Knowledge only. Do **not** generate onto a live pack. Do **not** swap `/m` speech off Cloud LTX-2.3 IA2V. Comfy = ComfyUI Cloud only. Ask before a generate — GPU time is real money.

Hub ids already catalogued: `docs/COMFY_WORKFLOWS.md` (`video_ltx2_5_i2v` / `api_ltx2_5_i2v`). Speech lock: `docs/COMFY_MCP.md`, `docs/LTX_25_FLF2V_RESEARCH.md`.

---

## What he asked for (plain)

A dark, hypnotic, **gold-and-black** looping backdrop — concert visual, not a person.

Example still: polished gold skull, gold cobras from the sockets, obsidian void, spotlight, no human skin.

Example motion: snakes slither slowly, metal reflections, slow zoom, seamless loop, 4–6 seconds.

This is a **place / art plate**. Nobody from the band is on it. Instruments are not on it unless he names them later.

---

## Two floors on a Jack Ash video

| Floor | What | Engine |
|---|---|---|
| **People** | 1–3 named members on a still (Jack empty-handed; Horn/Sax/Guitar/Drummer only if Position names the instrument) | Seedream still → `/m` **LTX-2.3 IA2V** only when a Saved mp3 is the audio |
| **Concert loop** | Art still with no people → short I2V loop under the song | Still first (Flux / SDXL / Seedream). Motion = **LTX-2.5 I2V** (`video_ltx2_5_i2v`), **not** IA2V, **not** FLF2V |

Do not feed `plate_{slug}` turnaround sheets into either floor.

---

## His Comfy notes, mapped to this studio

| His note | Our lock |
|---|---|
| LTX-Video **v2.5 I2V** in ComfyUI | Hub `video_ltx2_5_i2v` / billed `api_ltx2_5_i2v`. Image only. **Invents audio** — mute / discard it. The Jack Ash mp3 stays the song. |
| Still first (Flux / SDXL) because LTX melts metal from text | Same rule as Crash Lab: **holy still first**. Do not I2V from a prompt-only latent. |
| `LTXVideoImageToVideoLatent`, native **768×512** or **512×512** | Respect native size. Do not send a 4K still raw. |
| `frame_count` 65 or 97 @ 24fps (~4–6s) | LTX length is **8n+1**. 65 and 97 both fit. 24fps. |
| Low `motion_bucket_id` **30–50** | High motion turns gold into skin/liquid. Creep only. |
| Mask: skull still, snakes move | Optional later. First test = whole plate low motion. Mask math is a second test. |
| Fade last 10 frames into first 10 | Native LTX does **not** force a loop. Post: FILM/RIFE already listed as `utility_video_frame_interpolation` in `docs/COMFY_WORKFLOWS.md`. |
| No human skin | Prompt lock. Same as “no extras” on people stills. |

**Not this job:** LTX-2.5 **FLF2V** (two stills, invents audio) — `docs/LTX_25_FLF2V_RESEARCH.md`. **Not** `/m` Generate (IA2V + Saved mp3).

---

## Still prompt (logged, not sent)

```
A photorealistic heavy metal concert backdrop. A gleaming, polished solid gold human skull. Intricate metallic gold cobras and snakes slithering out of the eye sockets and wrapping tightly around the jaw. Dark obsidian black void background, ultra high contrast, dramatic cinematic spotlighting, deep shadows, 8k resolution, gothic rock art style. No people. No band. No readable text.
```

## Motion prompt (logged, not sent)

```
Slow hypnotic motion, the golden snakes are slithering and writhing slowly around the skull, gold metallic reflections catching the light, dark shadow background, seamless looping motion, slow camera zoom, eerie and freaky atmosphere, no human skin, dark cinematic metal aesthetic.
```

---

## Requirements before any Jack Ash cook

1. Song mp3 on **that** job (`scratchSong.fileName`). Forgotten now has one.
2. Lyrics / sections on that job.
3. People stills: 2–3 named, anti-cel if the card is graphic (Jack Ghost).
4. **At least one concert-loop still** approved — empty of people — before we pretend the video is only the band.
5. He names the test (which song, which still). Then `estimate_credits` / `run_template` on Cloud. Not before.
6. Loop clip is **picture only**. Never replace the track mp3 with LTX-invented audio.
7. Do not Start directing again on Forgotten. Do not mint jobs for MY NEW TOY / BURNING BRIGHT / EAST / GIVE ME SOMETHING until he says go.

## First test (when he says go)

One still (gold skull, no people) → Cloud `video_ltx2_5_i2v` ~5s @ 24fps, low motion → mute audio → check metal holds → then talk loop fade. Not on the live Forgotten people plates. Park the result as art, not a member still.
