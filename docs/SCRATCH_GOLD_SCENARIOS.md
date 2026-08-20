# Scratch gold scenarios

Logged **2026-08-20**. Living seed — **one** proven example per situation we incur, not the Prompt bible dump.

UI: **Gold prompts** button on `/scratch` (right of Clear prompt).

Source of truth in code: `src/lib/scratchBench/goldScenarios.ts`

## Pipeline (spicy → speak)

1. **Siray Spicy** Draw — plate / edit-from-still (adult uncensored 2.0 stack).
2. Tag **Pass** on Scratch.
3. **Save** spoken mp3 (dialogue box). Prefer ~4–6s.
4. **LTX** Image motion on that same start plate — lip-sync. GLOBAL lead is hard-wired on send (`perfect lip sync…`) — do not paste it into the motion box.
5. Spicy plates can be animated on LTX after they Pass. Do not discover still prompts by batching LTX.

## How this grows

1. Hammer on Scratch → tag **Pass** / Fail.
2. Export CSV (E) or paste the winning prompt into `goldScenarios.ts`.
3. Refine the single base for that situation until it is the best we have.
4. Only then promote into Prompt bible chips / `/m` automation.

Do **not** add dozens of near-duplicates. Replace the example when a better Pass lands.

## Seed rows (2026-08-20)

| Id | Situation | Target | Proven note |
|---|---|---|---|
| `still-one-person-mcu` | Solo MCU Draw | Prompt | Archive one-character MCU |
| `still-anti-cartoon` | Style slip / cartoon | Prompt | Style-slip Fail archive |
| `still-anti-crowd` | Strangers / doubles | Prompt | Hallucination Fail examples |
| `still-spicy-edit-from-still` | Spicy edit from attached still (same room/camera, one change) | Prompt | Siray Spicy Pass — LADDER ONE squat / skirt |
| `clip-one-person-siray20` | One person, locked pose, Siray i2v 2.0 | Image motion | Scratch Pass — many poses |
| `clip-ltx-after-spicy` | Speak on a spicy Pass plate (LTX + Saved mp3) | Image motion | 2026-08-20 LADDER ONE Pass — keep typos; they shipped |
| `clip-speaking-ltx` | LTX lip-sync speaking (generic) | Image motion | First Fleet `/m` Cloud gold |
| `clip-anti-hallucination` | Walkers / extras mid-clip | Image motion | Fail examples |

### LADDER ONE spicy kit (verbatim Pass)

**Position / Prompt** — `still-spicy-edit-from-still`  
**Speech mp3** — `[playfully]you know i am a slut, you 2 dirty little tiprats!`  
**LTX Image motion** — `clip-ltx-after-spicy` (look lock kept as proven; swap only when a better Pass lands)  
**GLOBAL** — already prepended on LTX send; not stored in the motion field
