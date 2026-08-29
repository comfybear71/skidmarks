# Music video IMAGE MOTION — gold standard

Logged **2026-08-29**. Empty hands / no invented instrument applies to **every** still on `/m`, Scratch, and Crash — not Jack only. Jack’s hidden-face line is the only Jack-only lock.

Verbatim gold JSON: `docs/MUSIC_VIDEO_IMAGE_MOTION_GOLD.json`

Do **not** write these onto a live leftover pack unless Stuie says **go**. The next Send builds them. Speaking / dialogue plates stay on the Sunny Banks gold — do not rebuild those.

---

## Rule (whole app)

- **Position is the still.** Who stands where, empty hands, no extra objects.
- **LTX / H3 is a second prompt.** It must not fight Position.
- If Position says empty hands, the cook must **not** say play an instrument.
- Play only when **this** still’s Position names the horn, or the pad is `HORN` / `SAXOPHONE`.
- Leftover `performance: play` does not override empty hands.
- Stored “play the same instrument” + “Empty hands. No instrument” is dumped. The box shows gold.

Jack Ash / JACK GHOST on one leftover clip does not make these Jack-only. Frank, Jo, and the next song get the same empty-hands rule.

---

## 1. Position (still)

GOLD fill (one person):

```
JACK GHOST alone. Only JACK GHOST in frame, no one else appears. Standing centre-frame, facing camera, mid body. Empty hands. No phone. No extra objects.
```

Same shape for any name. This is the still lock, not the cook.

---

## 2. Mute / No lips on — mouths shut (32s test clips)

The live lock you pasted is the right **shape**: start image, empty hands, only Jack, mouth closed, empty `[ ]`. It is missing two locks that stop a long clip inventing a horn or a lit face:

```
Face stays hidden in the hat shadow. Do not light the eyes or cheeks. Do not reveal a face. Same silhouette as the start image.
Empty hands. No saxophone. No trumpet. No instrument. No microphone.
```

Those sit in the tail (after the `[ ]`). Anyone else gets the no-instrument line without the hidden-face line.

Empty `[ ]` = hold. Do not invent a sax to fill time. H3 2K / no last frame is a different switch — it does not write the prompt.

---

## 3. Singing / No lips off — Jack

Cyan mouth line. Empty hands. Face hidden. **No** “play the same instrument”.

---

## 4. Singing — anyone else

Mouth and head move with the music. Empty hands. No saxophone / trumpet / instrument unless Position named one.

---

## 5. Play sax

Only if Position names a saxophone (or the pad is `SAXOPHONE`). Then the sax play lock. Never next to “No saxophone. No instrument.”

---

## 6. Play trumpet

Only if Position names trumpet / horn, or the pad is `HORN`. Then the trumpet play lock. Forgotten still blocks LTX-invented valves — that block stays.

---

## 7. Sway

Body sways. Mouth still. Empty hands. Not singing. No invented instrument.

---

## 8. Walk

Walks away from camera. Empty hands. Face never readable on Jack. Not singing.

---

## 9. Empty road / Nobody

No person named. `Empty road as the start image. No people in frame. Mouth N/A.`

---

## 10. Speaking (dialogue)

Do not rebuild. Use `docs/SUNNY_BANKS_IMAGE_MOTION_STANDARD.md`.

---

## Rejected — do not send

This leftover mash fights itself (play an instrument, then forbid every instrument). The studio must dump it:

```
…is prominent, hands and body play the same instrument as the start image…
Empty hands. No saxophone. No trumpet. No instrument. No microphone.
…plays this instrumental slice… Same person, same instrument…
```
