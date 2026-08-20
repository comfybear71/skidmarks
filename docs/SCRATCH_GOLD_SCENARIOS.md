# Scratch gold scenarios

Logged **2026-08-20**. Living seed — **one** proven example per situation we incur, not the Prompt bible dump.

UI: **Gold prompts** button on `/scratch` (right of Clear prompt).

Source of truth in code: `src/lib/scratchBench/goldScenarios.ts`

## How this grows

1. Hammer on Scratch → tag **Pass** / Fail.
2. Export CSV (E) or paste the winning prompt here / into `goldScenarios.ts`.
3. Refine the single base for that situation until it is the best we have.
4. Only then promote into Prompt bible chips / `/m` automation.

Do **not** add dozens of near-duplicates. Replace the example when a better Pass lands.

## Seed rows (2026-08-20)

| Id | Situation | Target | Proven note |
|---|---|---|---|
| `still-one-person-mcu` | Solo MCU Draw | Prompt | Archive one-character MCU |
| `still-anti-cartoon` | Style slip / cartoon | Prompt | Style-slip Fail archive |
| `still-anti-crowd` | Strangers / doubles | Prompt | Hallucination Fail examples |
| `clip-one-person-siray20` | One person, locked pose, Siray 2.0 | Image motion | Scratch Pass — many poses |
| `clip-speaking-ltx` | LTX lip-sync speaking | Image motion | First Fleet `/m` Cloud gold |
| `clip-anti-hallucination` | Walkers / extras mid-clip | Image motion | Fail examples |

Siray 2.0 one-person set (full 1–13 pose variants) lived in chat Passes — the menu ships **one** standing base; paste CSV winners to add pose variants only if they are truly different situations.
