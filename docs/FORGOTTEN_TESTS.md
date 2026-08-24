# Forgotten — named tests

Logged **2026-08-24**. Job `mgen_20260824085817084_edp`. Pack `THE JACK ASH BAND — FORGOTTEN 84_edp`. This pack is the test bed until the Jack Ash package is complete. Do not Start directing. Do not mint a new job.

| Id | Name | What we are proving | Status |
|---|---|---|---|
| **T1** | Wave follow | Playhead stays on screen. Wave slides right-to-left at 28px/s. | Code this session. Live `aiglitch.app` after merge. |
| **T2** | Lyric sections | `[Intro]` / `[Verse]` / `[Chorus]` / `[Bridge]` / `[Outro]` become timed bands from the sheet, not one INTRO over 4:51. | Import rewritten. Re-applied on this job. |
| **T3** | People stills | Nine plates, learned cameras (tight CU, MCU, sit, wide, OTS, OTS two, wide three). Anti-cel lock. Fresh Draw — do not refine the cartoon takes. | Staging + lock in code. Draw on this job. |
| **T4** | Concert skull still | Gold skull + cobras, **no people**. Holy still only. Double Talkin' Jive / Bangkok Thunderdome look. | Named. Research in `docs/CONCERT_LOOP_PLATE.md`. Not generated — wait for more video tests. |
| **T5** | Concert loop I2V | Muted Cloud `video_ltx2_5_i2v` ~5s on the T4 still. Not `/m` speech. | Later. After more video tests. Then implement. |
| **T6** | Who-plays + intermission | Jack on vocal hits only. Horn fade in / play / fade out / revolve. Gaps = animation inserts. No sax. | Clocks in `src/lib/forgottenWhoPlays.ts`. Concert loop still T4/T5. |

Marquee lyric pins (line up words to the playhead) stay a separate desk tool — they do not replace T2 section tags. 42 pins are on this job (sheet-spread inside each Section). Leave this pack as the test. Next songs use `docs/MUSIC_VIDEO_BASE.md`.
