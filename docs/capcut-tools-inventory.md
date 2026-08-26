# CapCut public tools inventory

Research / reference only. **Not** a scrape of in-app assets, templates, or logged-in editor features. **Not** a paywall bypass.

| Field | Value |
|---|---|
| Fetched | 26 Aug 2026 (this session) |
| Hubs | [capcut.com/tools](https://www.capcut.com/tools), [capcut.com/tools/ai-tools](https://www.capcut.com/tools/ai-tools) |
| Official URL list | [capcut.com/llms.txt](https://www.capcut.com/llms.txt) (dated **22 Jun 2026** — older than the Aug 2026 hub cards) |
| Extra host | [tools.capcut.com/tools/gemini-omni](https://tools.capcut.com/tools/gemini-omni) |
| Method | Public HTML + on-page SEO/article JSON only. English `/tools/`, `/create/`, and the Gemini Omni page. Locale mirrors skipped. |
| Not done | No sign-in, no Pro checkout, no template library (`robots.txt` disallows `/templates/`), no internal APIs |

**Pricing column is marketing copy, not a tested paywall.** Almost every page says “free”, “free to start”, or “try it free”. Credit limits, watermarks, and which models sit behind CapCut Pro were **not** verified. Where a page names Pro, that is quoted.

**Underlying model column is empty unless that page’s own title / H1 / FAQ / feature copy names a model as powering that tool.** Shared footers on every CapCut page list Seedance / Nano Banana / Gemini Omni / Seedream — those repeats are ignored.

CapCut is **not** a stock-footage library like Mixkit / Pexels / Coverr. It is an editor + AI generate/enhance suite. See [Skidmarks arsenal](#skidmarks-arsenal).

---

## Named models (only where a public page claims them)

| Model (as CapCut writes it) | What the public page says it does | Page |
|---|---|---|
| Seedance 2.5 / Dreamina Seedance 2.5 | Text-to-video, avatars, templates, script → video, storyboard assist. Copy also says “instant Dreamina Seedance 2.5” and “CapCut AI video agent”. Export marketing: HD free; FAQ claims “free 1080–8K exports”. | [AI video generator](https://www.capcut.com/tools/ai-video-generator), [AI video maker](https://www.capcut.com/tools/ai-video-maker) (same landing copy) |
| Dreamina Seedance 2.0 | Separate landing: text-to-video and image-to-video, “consistent motion, flexible formats”. | [dreamina-seedance-2-0](https://www.capcut.com/tools/dreamina-seedance-2-0) |
| Seedream 5.0 (ByteDance) | Image gen model inside the AI image generator (with Nano Banana Pro). Own landing for high-fidelity stills. Inpainting page also names it. | [AI image generator](https://www.capcut.com/tools/ai-image-generator), [seedream-5-0](https://www.capcut.com/tools/seedream-5-0), [image inpainting](https://www.capcut.com/create/image-inpainting) |
| Nano Banana Pro (Google) | Image gen / prompt-edit stills, character consistency, “4K upscaling”. Own landing. FAQ asks whether Google/CapCut charge — **unanswered by this inventory**. Also named on the AI image generator and inpainting pages. | [nano-banana-pro](https://www.capcut.com/tools/nano-banana-pro), [AI image generator](https://www.capcut.com/tools/ai-image-generator) |
| GPT Image 2 | Text-to-image landing (“try it free”). | [gpt-image-2](https://www.capcut.com/tools/gpt-image-2) |
| Dream Machine | Text-to-video and image-to-video landing. | [dream-machine-ai-video-generator](https://www.capcut.com/tools/dream-machine-ai-video-generator) |
| Happy Horse / HappyHorse | Text-to-video and image-to-video; web + desktop landings. Copy says “with audio” on the tools hub card. | [happy-horse](https://www.capcut.com/tools/happy-horse), [happy-horse-desktop](https://www.capcut.com/tools/happy-horse-desktop) |
| VEO 3.0 | Text-to-video + “smart audio”. FAQ **compares** it to Kling 3.0 — Kling is **not** listed as a CapCut tool on that page. | [veo-3-0](https://www.capcut.com/tools/veo-3-0) |
| Gemini Omni | Multimodal video: text + images + audio + clips → one draft; conversational revise. Hosted on `tools.capcut.com`. | [gemini-omni](https://tools.capcut.com/tools/gemini-omni) |

Seedream **4.0** appears only in YouTube-title blocks on the Seedance video-generator page, not as a current model picker. **Kling** is a comparison name only.

---

## Editor / timeline / export (marketing only)

Public copy for the [online video editor](https://www.capcut.com/tools/online-video-editor), [desktop editor](https://www.capcut.com/tools/desktop-video-editor), and Seedance how-to mentions:

| Action | Where public copy mentions it | Notes |
|---|---|---|
| Trim / crop / resize | Dedicated trimmer + crop pages; online editor | Trimmer page also claims “AI effects” and “without watermark” |
| Cut / merge | Video tools hub | No public keyframe how-to found |
| Keyframes | **Not found** on the public tool pages fetched | Needs desktop/app check |
| Split | Lip-sync page mentions “split-screen” as a *use case*, not a split-clip tool | Needs editor check |
| Transitions | Image-to-video + social-media hub | Not a standalone /tools/ page |
| Auto captions / auto reframe / auto subtitles | Dedicated pages + desktop “AI-powered” page | Desktop page names Script to Video, Auto Reframe, Auto Captions |
| Add text / music / audio / subtitles | Dedicated pages | Timeline placement not documented |
| Green screen / chroma key | Green screen + video BG remove pages | Video BG remove also claims one-click AI + transparent export |
| Movement tracking (zoom / shake / soft) | [ai-movement-tracking](https://www.capcut.com/tools/ai-movement-tracking) | Effect attach, not a full motion-track suite description |
| Color match / color correct | Dedicated pages | Photo vs video mix in the copy |
| Export resolution | Seedance: HD free; FAQ “1080–8K”. Image gen: “up to 8K”. Video upscaler: 4K. Image upscaler: 2x–8x, “4K & 16K” in the H1 | **Not tested** |
| Export formats | Video: resolution / format / frame rate (desktop how-to). Audio: MP3, FLAC, WAV, AAC (music generator + vocal remover). Images: format / quality / resolution | **Not tested** |
| Watermark | Online trimmer + image-to-video FAQ claim no watermark | **Not tested** |

---

## Inventory table

Categories are ours (AI Creation / Image / Video / Text & Audio / Editing/Timeline), not CapCut’s CMS folders.

| Tool Name | Category | What it does | Underlying model (if named) | Free or Pro |
|---|---|---|---|---|
| [Seedance 2.5 AI Video Generator](https://www.capcut.com/tools/ai-video-generator) (also [ai-video-maker](https://www.capcut.com/tools/ai-video-maker)) | AI Creation | Text/script → full video: avatars (100+), 30+ templates, style (realistic / cartoon 3D / cinematic), aspect ratio, voiceover, duration; optional image start; brainstorm topics/storyboards; then edit in CapCut | Seedance 2.5 / Dreamina Seedance 2.5 | Marketing: free / HD export free. 8K claim untested |
| [Free AI Video Generator](https://www.capcut.com/tools/free-ai-video-generator) | AI Creation | Generic “make a video in seconds” landing | Not named on this page | Marketing: free |
| [Free AI Video Generator (Video Studio / social)](https://www.capcut.com/tools/ai-video-generator-social) | AI Creation | Avatars, AI templates, one-click text-to-video via “Video Studio” | Not named on this page (hub card for Seedance is a different URL) | Unclear from public copy |
| [Dreamina Seedance 2.0](https://www.capcut.com/tools/dreamina-seedance-2-0) | AI Creation | Text-to-video and image-to-video; “Mini” in the H1 | Dreamina Seedance 2.0 | Unclear from public copy |
| [Dream Machine AI Video Generator](https://www.capcut.com/tools/dream-machine-ai-video-generator) | AI Creation | Videos from text prompts or image references | Dream Machine | Marketing: free / easy |
| [Happy Horse](https://www.capcut.com/tools/happy-horse) | AI Creation | Videos from text or images; short clips / social / marketing. Hub card: “from Text with Audio” | Happy Horse | Marketing: free / simple |
| [Happy Horse on Desktop](https://www.capcut.com/tools/happy-horse-desktop) | AI Creation | Same model, desktop entry | Happy Horse | Marketing: free to try |
| [VEO 3.0](https://www.capcut.com/tools/veo-3-0) | AI Creation | Text-to-video with “smart audio” and rapid editing | VEO 3.0 (Kling named only as a comparison) | Unclear from public copy |
| [Gemini Omni](https://tools.capcut.com/tools/gemini-omni) | AI Creation | Multimodal video from text + images + audio + clips; conversational revise; keep output grounded in references | Gemini Omni | Marketing uses “free”; paywall not stated |
| [Image to Video AI](https://www.capcut.com/tools/ai-image-to-video) | AI Creation | Still(s) → animated video / slideshow / reel; auto transitions, pacing, optional script + AI voiceover | Not named | FAQ discusses watermark / no-signup — **not verified** |
| [AI Video Editor](https://www.capcut.com/tools/ai-video-editor) | AI Creation | AI-assisted edit workflow (vague: “smart features that streamline”) | Not named | Marketing: free |
| [AI Clip Maker](https://www.capcut.com/tools/ai-clip-maker) | AI Creation | One-click short clips from source video + “rich media resources” | Not named | Marketing: free |
| [Long video → short clips](https://www.capcut.com/tools/ai-long-video-to-short-video) | AI Creation | Repurpose a long video into short clips | Not named | Unclear from public copy |
| [Web Video Studio — Director Mode](https://www.capcut.com/tools/web-video-studio-director-mode) | AI Creation | Scene control from text and image inputs: narrative draft, teaching sequences, frame-based editing | Not named | Marketing: free to explore |
| [AI Design Studio](https://www.capcut.com/tools/ai-design) | AI Creation | Posters, ads, branded stills; layouts, cutout, background removal | Not named | Unclear from public copy |
| [AI Image Generator](https://www.capcut.com/tools/ai-image-generator) | AI Creation | Text-to-image and image-to-image; prompt writer; then crop/filters/upscale; can hand off to image-to-video | **Seedream 5.0 (ByteDance)** and **Nano Banana Pro (Google)** — page lets you pick | Marketing: free to start / try. Export “up to 8K” untested |
| [AI Text to Image Generator](https://www.capcut.com/tools/ai-text-to-image-generator) | AI Creation | Text → image (overlaps the image generator) | Not named on this landing | Unclear from public copy |
| [AI Art Generator](https://www.capcut.com/tools/ai-art-generator) | AI Creation | Text → art; photo → artwork; anime / realistic styles | Not named | Marketing: free |
| [GPT Image 2](https://www.capcut.com/tools/gpt-image-2) | AI Creation | Text-to-image for e-commerce / content | GPT Image 2 | Marketing: try it free |
| [Nano Banana Pro](https://www.capcut.com/tools/nano-banana-pro) | AI Creation | Prompt-edit photos, character consistency, 4K upscale | Nano Banana Pro (Google) | Public FAQ asks if paid — **unverified** |
| [Seedream 5.0](https://www.capcut.com/tools/seedream-5-0) | AI Creation | High-fidelity stills for marketing / social | Seedream 5.0 | Unclear from public copy |
| [AI Portraitor / Portrait Generator](https://www.capcut.com/tools/ai-portrait-generator) | AI Creation | Portraits from a photo (selfie / family / art styles) | Not named | Marketing: free |
| [AI Meme Generator](https://www.capcut.com/tools/meme-generator) | AI Creation | Memes from text or images | Not named | Marketing: free |
| [AI Business Card Generator](https://www.capcut.com/tools/ai-business-card-generator) | AI Creation | Text prompt → print-ready business card | Not named | Marketing: free; “no sign-up required” |
| [AI Logo Generator](https://www.capcut.com/create/ai-logo-generator) | AI Creation | Logos; styles/fonts. Page also says “three models tailored for different…” **without naming them in the snippet we kept** | Not named in the description we trusted | Marketing: completely free (page claim) |
| [Ad Scripts Generator](https://www.capcut.com/tools/ad-script-generator) | AI Creation | Writes ad scripts | Not named | Unclear from public copy |
| [AI Dialogue Generator](https://www.capcut.com/tools/ai-dialogue-generator) | AI Creation | Type text, pick voices, generate spoken conversation for video | Not named | Marketing: free |
| [Product Photography Maker](https://www.capcut.com/tools/product-photography-maker) | Image | Product-shot stills from simple tools / AI assist | Not named | Marketing: free |
| [Image Inpainting](https://www.capcut.com/create/image-inpainting) | Image | Remove objects, restore, repair stills | Page names Seedream 5.0 and Nano Banana Pro | Marketing: free (FAQ asks; not tested) |
| [AI Generative Fill](https://www.capcut.com/tools/ai-generative-fill) | Image | Remove elements or fill missing parts | Not named | Marketing: free |
| [AI Image Outpainting / Expander](https://www.capcut.com/tools/ai-image-outpainting) | Image | Expand stills (copy also says videos) into a larger scene | Not named | Unclear from public copy |
| [AI Text Remover](https://www.capcut.com/create/ai-text-remover) | Image | Wipe text off images | Not named | Unclear from public copy |
| [AI People Remover](https://www.capcut.com/tools/ai-people-remover) | Image | Title: remove people from photos. **Meta description is a copy of the AI art generator blurb** — see verification list | Not named | Marketing uses “free” |
| [AI Face Cutout](https://www.capcut.com/tools/face-cutout) | Image | Cut a face out of a photo | Not named | Unclear from public copy |
| [Image Background Remover](https://www.capcut.com/tools/image-background-remover) | Image | Remove image BG; copy also says unwanted people | Not named | Marketing: free |
| [Transparent Background Maker](https://www.capcut.com/tools/transparent-background-maker) | Image | Transparent PNG; “conversational AI” refine | Not named | Marketing: no watermarks (untested) |
| [AI Image Upscaler](https://www.capcut.com/tools/ai-image-upscaler) | Image | 2x–8x upscale; H1 says 4K & 16K; mentions batch & API | Not named | Unclear from public copy |
| [Image Resolution Enhancer](https://www.capcut.com/tools/image-resolution-enhancer) | Image | Low-res → higher-quality still | Not named | Marketing: free |
| [AI Color Correction](https://www.capcut.com/tools/ai-color-correction) | Image | Revive old / low-light / promo stills | Not named | Unclear from public copy |
| [Old Photo Restoration](https://www.capcut.com/tools/old-photo-restoration) | Image | Restore old photos | Not named | Unclear from public copy |
| [Online Photo Editor](https://www.capcut.com/tools/online-photo-editor) | Image | General AI photo editor | Not named | Unclear from public copy |
| [AI Photo Editing](https://www.capcut.com/tools/ai-photo-editing) | Image | Enhance / retouch / fix | Not named | Marketing: free |
| [Online Image Resizer](https://www.capcut.com/tools/online-image-resizer) | Image | Change pixel size | Not named | Marketing: free |
| [Online Image Compressor](https://www.capcut.com/tools/online-image-compressor) | Image | Compress without “losing quality” (claim) | Not named | Marketing: free |
| [Online Image Converter](https://www.capcut.com/tools/online-image-converter) | Image | Convert to JPEG / PNG | Not named | Unclear from public copy |
| [Online Graphic Design](https://www.capcut.com/tools/online-graphic-design) | Image | Marketing graphics | Not named | Unclear from public copy |
| [AI Body Editor](https://www.capcut.com/tools/body-editor) | Image | Reshape body / enhance face & body on photos | Not named | Marketing: free |
| [Online Video Editor](https://www.capcut.com/tools/online-video-editor) | Video | Browser editor: create / edit / export | Not named | Marketing: free. FAQ claims no watermark — untested |
| [Desktop Video Editor](https://www.capcut.com/tools/desktop-video-editor) | Video | Desktop NLE landing | Not named | Unclear from public copy |
| [Desktop — AI-powered](https://www.capcut.com/tools/desktop-ai-power) | Video | Desktop AI: Script to Video, Auto Reframe, Auto Captions | Not named | Unclear from public copy |
| [Video Editing App](https://www.capcut.com/tools/video-editing-app) | Video | Mobile app landing | Not named | Marketing: free |
| [CapCut Download](https://www.capcut.com/tools/video-editor-download) | Video | Desktop / iOS / Android download | Not named | Marketing: free download |
| [Online Video Trimmer](https://www.capcut.com/tools/online-video-trimmer) | Editing/Timeline | Trim, crop, resize; claims AI effects and no watermark | Not named | Marketing: free |
| [Crop Video](https://www.capcut.com/tools/crop-video) | Editing/Timeline | Reframe / crop for scene focus | Not named | Unclear from public copy |
| [Change Video Speed](https://www.capcut.com/tools/change-video-speed) | Editing/Timeline | Speed up / slow down | Not named | Unclear from public copy |
| [Auto Reframe](https://www.capcut.com/tools/auto-reframe) | Editing/Timeline | Reframe for social aspect ratios | Not named | Unclear from public copy |
| [Add Text to Video](https://www.capcut.com/tools/add-text-to-video) | Editing/Timeline | Titles / text effects / templates | Not named | Marketing: free |
| [Add Music to Video](https://www.capcut.com/tools/add-music-to-video) | Editing/Timeline | Drop BGM onto a video | Not named | Marketing: free |
| [Add Audio to Video](https://www.capcut.com/tools/add-audio-to-video) | Editing/Timeline | Upload / mix / fine-tune sound | Not named | Marketing: free |
| [Add Subtitles to Video](https://www.capcut.com/tools/add-subtitles-to-video) | Editing/Timeline | Manual / styled subtitles | Not named | Unclear from public copy |
| [Online Video Converter](https://www.capcut.com/tools/online-video-converter) | Editing/Timeline | Change video format | Not named | Marketing: free |
| [Convert MOV to MP4](https://www.capcut.com/tools/convert-mov-to-mp4) | Editing/Timeline | MOV → MP4 | Not named | Marketing: free |
| [Free Video Compressor](https://www.capcut.com/tools/free-video-compressor) | Editing/Timeline | Shrink file size | Not named | Marketing: free |
| [Online Screen Recorder](https://www.capcut.com/tools/online-screen-recorder) | Editing/Timeline | Record the screen in the browser | Not named | Marketing: free |
| [Green Screen Software](https://www.capcut.com/tools/green-screen-software) | Video | Chroma-key / replace background | Not named | Marketing: free |
| [Video Background Remover](https://www.capcut.com/tools/video-background-remover) | Video | One-click AI BG remove + chroma-key + transparent export | Not named | Marketing: free |
| [AI Video Upscaler](https://www.capcut.com/tools/ai-video-upscaler) | Video | Upscale / enhance toward 4K | Not named | Marketing: free |
| [AI Video Enhancer](https://www.capcut.com/tools/ai-video-enhancer) | Video | Clarity, color, resolution in one click | Not named | Unclear from public copy |
| [AI Video Denoiser (desktop)](https://www.capcut.com/tools/denoise-video-with-ai) | Video | Clean noisy **footage** (page is CapCut PC). Copy mixes picture vs sound | Not named | Unclear from public copy |
| [AI Color Matcher](https://www.capcut.com/tools/match-color-with-ai) | Video | Match grade across clips | Not named | Unclear from public copy |
| [AI Movement Tracking](https://www.capcut.com/tools/ai-movement-tracking) | Video | Attach zoom / shake / soft effects to tracked motion | Not named | Unclear from public copy |
| [AI Lip Sync](https://www.capcut.com/tools/lip-sync) | Video | Match mouth movement to audio (music, VO, AI video) | Not named | Unclear from public copy |
| [AI Video Translator](https://www.capcut.com/tools/ai-video-translator) | Video | Translate spoken language; copy claims tone + lip-sync kept | Not named | Unclear from public copy |
| [AI Dubbing](https://www.capcut.com/tools/ai-dubbing) | Text & Audio | Dub / translate video audio for other languages | Not named | Unclear from public copy |
| [AI Text to Speech](https://www.capcut.com/tools/ai-text-to-speech) | Text & Audio | Paste text → voice; speed / pitch / volume; many languages | Not named | **FAQ: core TTS free; some premium voices may need CapCut Pro** |
| [Text to Speech](https://www.capcut.com/tools/text-to-speech) | Text & Audio | Same family; “200+ AI voices” | Not named | Marketing: free |
| [AI Voice Generator](https://www.capcut.com/tools/ai-voice-generator) | Text & Audio | Text → speech (overlaps TTS) | Not named | Marketing: free |
| [AI Voice Over](https://www.capcut.com/tools/ai-voice-over) | Text & Audio | Voiceovers for video / podcast | Not named | Marketing: free |
| [AI Music Generator](https://www.capcut.com/tools/ai-music-generator) | Text & Audio | Prompt → soundtrack; auto beat marks; copyright detector; export MP3/FLAC/WAV/AAC | Not named | Page claims unlimited free + royalty-free — **untested** |
| [AI Sound Effects Generator](https://www.capcut.com/tools/ai-sound-effects-generator) | Text & Audio | Match SFX to scenes (copy points at the CapCut **app**) | Not named | Unclear from public copy |
| [Vocal Remover](https://www.capcut.com/tools/vocal-remover) | Text & Audio | Isolate / remove vocals (`Audio` → Isolate voice → Remove vocal) | Not named | Unclear from public copy |
| [Remove Background Noise](https://www.capcut.com/tools/remove-background-noise-from-audio) | Text & Audio | Noise reduction on audio | Not named | Unclear from public copy |
| [Voice Enhancer](https://www.capcut.com/tools/voice-enhancer) | Text & Audio | Clean / boost spoken audio | Not named | Unclear from public copy |
| [Voice Changer](https://www.capcut.com/tools/voice-changer) | Text & Audio | Voice effects / character voices | Not named | Marketing: free |
| [MP3 Cutter](https://www.capcut.com/tools/mp3-cutter) | Text & Audio | Trim audio files | Not named | Unclear from public copy |
| [Online Audio Editor](https://www.capcut.com/tools/online-audio-editor) | Text & Audio | Mix, effects, BGM | Not named | Marketing: free |
| [Audio Converter](https://www.capcut.com/tools/audio-converter) | Text & Audio | Change audio format | Not named | Unclear from public copy |
| [Auto Caption Generator](https://www.capcut.com/tools/auto-caption-generator) | Text & Audio | Auto captions on video | Not named | Unclear from public copy |
| [AI Caption Generator](https://www.capcut.com/tools/ai-caption-generator) | Text & Audio | Auto subtitles (overlaps auto caption) | Not named | Unclear from public copy |
| [AI Speech to Text](https://www.capcut.com/tools/ai-speech-to-text) | Text & Audio | Transcribe speech | Not named | Unclear from public copy |
| [Convert Sound to Text](https://www.capcut.com/tools/convert-sound-to-text) | Text & Audio | Audio → text (overlaps STT) | Not named | Unclear from public copy |
| [Video to Text](https://www.capcut.com/tools/video-to-text) | Text & Audio | Transcribe a video | Not named | Marketing: free |
| [Subtitle Translator](https://www.capcut.com/tools/subtitle-translator) | Text & Audio | Translate existing subtitles | Not named | Unclear from public copy |
| [Online Text Editor](https://www.capcut.com/tools/online-text-editor) | Text & Audio | On-video text / captions | Not named | Unclear from public copy |
| [Cloud Collaboration](https://www.capcut.com/tools/cloud-collaboration-platform) | Editing/Timeline | Shared creative workspace | Not named | Unclear from public copy |
| [Free Cloud Storage](https://www.capcut.com/tools/free-cloud-storage) | Editing/Timeline | Cloud storage for editor media | Not named | Marketing: free (quota unstated) |

### Category index pages (not tools)

These are hubs, not actions. Left out of the table on purpose:

- [AI Tools](https://www.capcut.com/tools/ai-tools), [Tools](https://www.capcut.com/tools)
- [Models](https://www.capcut.com/tools/models) — SSR listing was thin; model cards live on their own URLs
- [Image](https://www.capcut.com/tools/image), [Video](https://www.capcut.com/tools/video), [Text](https://www.capcut.com/tools/text), [Audio](https://www.capcut.com/tools/audio)
- [DIY Design](https://www.capcut.com/create/diy-design), [Lifestyle](https://www.capcut.com/create/lifestyle), [Marketing](https://www.capcut.com/create/marketing), [Social Media](https://www.capcut.com/create/social-media)
- [AI Design Social](https://www.capcut.com/tools/ai-design-social) — meta description is only “AI design”

`/resource/` links from the hubs are blog/guides (howto, templates, Subway Surfers trend), not tools.

---

## Needs manual verification

Do not treat these as facts. The public page was vague, contradictory, 404, or login-gated.

1. **Free vs Pro / credits** — Almost every tool says free. TTS is the only page that clearly says **some voices are Pro**. Nano Banana Pro’s own FAQ asks if Google/CapCut charge. Image/video generators show a `creditModal` in page JSON — we did not open it.
2. **Voice cloning** — `https://www.capcut.com/tools/ai-voice-cloning` **404**. Not in `llms.txt`. Avatar clone (“upload a short video of yourself”) is mentioned *inside* the Seedance video-generator copy. Whether that is voice-clone, face-clone, or both is unconfirmed.
3. **Dead slugs** (404 this session): `/tools/text-to-video`, `/tools/image-to-video`, `/tools/ai-lip-sync`, `/tools/ai-sound-effect-generator`. Live replacements: Seedance / `ai-image-to-video` / `lip-sync` / `ai-sound-effects-generator`.
4. **Keyframes, clip split, transitions as first-class tools** — No public `/tools/` page for keyframe or split. Transitions appear only as a feature mention. Desktop app almost certainly has them; this inventory did not open the app.
5. **AI People Remover** — Title says people-removal; SEO description is copy-pasted from the AI art generator. Actual action unconfirmed.
6. **AI Design Social** — Description is one word (“AI design”).
7. **Denoise video** — Title is PC video denoiser; surrounding copy talks about **sound** clarity. Picture vs audio unclear.
8. **Outpainting “images and videos”** — One page claims both. Whether video outpaint exists is unconfirmed.
9. **Image upscaler “batch & API”** — Marketing only. No public API docs fetched. Do not assume a Skidmarks-callable API.
10. **Image-to-video vs Seedance / Dream Machine / Happy Horse / VEO / Gemini Omni** — Several products all claim image→video. Which model the generic `ai-image-to-video` page actually runs is **not named**.
11. **Duplicate landings** — `ai-video-generator` ≡ `ai-video-maker` (same H1/copy). TTS / voice generator / voice over overlap. Auto caption / AI caption overlap. Speech-to-text / sound-to-text / video-to-text overlap. Image BG remove / transparent BG overlap. Generative fill / inpainting overlap.
12. **In-app stock / templates / music library** — Not catalogued. `robots.txt` blocks `/templates/`. Opening the editor to list stock clips would be login + asset scrape — out of scope.
12b. **In-app Video Effects / Filters catalog** — See [In-app effects library](#in-app-effects-library-not-on-the-public-web). Thousands of cloud presets. No public full list. We did not open the app.
13. **llms.txt vs live hub** — June 2026 list is missing Seedance 2.5, Nano Banana Pro, GPT Image 2, Happy Horse, VEO 3.0, Gemini Omni, Director Mode, body editor, etc. Prefer the Aug 2026 hub + this table.
14. **Style transfer** — No public tool page with that name. Closest: AI art / image-to-image / Nano Banana prompt-edit.
15. **Subway Surfers template** — Resource/trend article, not a tool.

---

## Skidmarks arsenal

This is a **map**, not a go-ahead to wire CapCut into Crash Lab.

**What CapCut is not:** a licensed stock house. Support-shot b-roll should stay on Mixkit / Pexels / Pixabay / Coverr (or a dropped file). CapCut’s own media/templates were not listed here.

**What the public pages suggest it *could* sit next to, if Stuie says go later:**

| Job | CapCut public tool | Why it might matter | Catch |
|---|---|---|---|
| Support still → motion without LTX | Image to Video / Seedance / Dream Machine / Happy Horse / VEO / Gemini Omni | Same family as “hang a clip on TRACK” | Login, credits, model unnamed on the generic page; do not cook from here |
| Clean a still | BG remove, generative fill, inpaint, people remove, text remove, upscale | Plate cleanup | People-remover copy is broken; Pro/credits unknown |
| Expand a plate | Outpainting | Wider canvas | “Videos” claim unverified |
| VO / captions | TTS, auto captions, STT | Not stock; useful for Speak-adjacent work | Premium voices may be Pro |
| Lip match | Lip sync / video translator | Mouth lock after a VO swap | Model unnamed |
| Long talk → shorts | Long-to-short / clip maker | Not our stitch (stitch stays out) | Quality untested |
| Score | AI music generator | Royalty-free **claim** | Do not trust the claim without a licence read |
| Timeline NLE | Online / desktop editor | Trim, captions, reframe | Keyframes not documented on the public pages |

**Do not:** sign in from this VM to “just look”, pull CapCut template packs, or treat CapCut as a silent stock source. If a tool is added to the desk later, it should be a named, licensed path — same rule as Mixkit Free vs Restricted.

**Spice / transitions (if built later):** our own named effects only — not CapCut’s cloud menu. Scope is **music-video Support / stock clips** (one file, hang on the existing clock). Not Hero LTX, not speech, not a stitch of the song.

---

## In-app effects library (not on the public web)

CapCut’s weekly cloud presets (Video Effects, Body Effects, Photo Effects, Filters) are **not** on any static tools page. The public `/tools` inventory above is landings (upscaler, lip sync, Seedance…). The “thousands of effects” people see on TikTok live **inside a project timeline**. We did not open that app. We will not scrape it.

How CapCut itself tells you to browse (owner note, not a crawl):

| In-app place | What it holds (their buckets) |
|---|---|
| **Effects → Video Effects** | Horizontal libraries: Trending, Opening & Closing, Lens, Glitch, Retro, Nightclub, … |
| **Body Effects** | Track a person — neon outline, clone, etc. |
| **Photo Effects** | 3D zoom, AI still styles |
| **Filters** | Colour grades: Cinematic, Food, Vibe, Scenery, … |
| **Search** in Video Effects | Keywords (`blur`, `glitch`, `neon`, `vintage`, `shake`) pull extra cloud items that never sit on the main tabs |

There is no complete text list to copy. If we want shimmer / split screen / fade text / zoom / shake on **our** stock, we name **our** tools. We do not import CapCut’s catalog.

---

## Source notes

- 108 English tool/create URLs returned **HTTP 200** this session (cached under `/tmp/capcut-inventory/pages` on the research VM; not committed).
- Hub HTML also listed locale copies of `/tools/ai-tools` (`/de-de/`, `/ja-jp/`, …) — skipped as duplicates.
- How-tos on several AI pages say **sign up / log in** before generate. That is why Free vs Pro is still “marketing”.
- ByteDance/CapCut terms and licence for generated media were **not** re-read here. The image-generator FAQ itself says generated images are “typically not copyrighted in the traditional sense” and tells you to review licensing. Treat that as a warning, not a green light.
