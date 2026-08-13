# Missing assets — live Blob/Neon gap report

Generated from the live Neon DB + Vercel Blob (2 shows, 16 episodes).
`file` in a Blob path is the last path segment; keep the exact filename shown.
Story references world/cast by `g:{file}` — strip the `g:` prefix for the Blob filename.

## Totals

| Kind | Missing | Target Blob location |
|------|---------|----------------------|
| WORLD images | 53 | `shows/{show}/world-cards/{file}` |
| CAST faces | 50 | `shows/{show}/style-cards/{file}` |
| Plates (referenced, not uploaded) | 20 | `shows/{show}/episodes/{folder}/plates/{file}` |
| Dialogue audio (referenced, not uploaded) | 65 | `shows/{show}/episodes/{folder}/audio/{file}` |
| SFX references (0 in Blob) | 99 | `shows/{show}/episodes/{folder}/sfx/{file}` (per-episode) or `shows/{show}/spx/sfx/{file}` (shelf) |

WORLD and CAST have **zero** objects in Blob today — every referenced file is missing.

## WORLD images → `shows/{show}/world-cards/{file}`

### skidmarks (32)
- `shows/skidmarks/world-cards/back_room_screen_test.png`  ← local `data/crash/world-cards/skidmarks/back_room_screen_test.png`
- `shows/skidmarks/world-cards/crack_house_basement.png`  ← local `data/crash/world-cards/skidmarks/crack_house_basement.png`
- `shows/skidmarks/world-cards/crack_house_home.png`  ← local `data/crash/world-cards/skidmarks/crack_house_home.png`
- `shows/skidmarks/world-cards/crack_house_zone.png`  ← local `data/crash/world-cards/skidmarks/crack_house_zone.png`
- `shows/skidmarks/world-cards/dap_bedroom.png`  ← local `data/crash/world-cards/skidmarks/dap_bedroom.png`
- `shows/skidmarks/world-cards/dap_house_wreck.png`  ← local `data/crash/world-cards/skidmarks/dap_house_wreck.png`
- `shows/skidmarks/world-cards/dirty_dog_bar_floor.png`  ← local `data/crash/world-cards/skidmarks/dirty_dog_bar_floor.png`
- `shows/skidmarks/world-cards/dirty_dog_bar_floor_b.png`  ← local `data/crash/world-cards/skidmarks/dirty_dog_bar_floor_b.png`
- `shows/skidmarks/world-cards/dirty_dog_pub_main.png`  ← local `data/crash/world-cards/skidmarks/dirty_dog_pub_main.png`
- `shows/skidmarks/world-cards/loc_town_street_side_v1.png`  ← local `data/crash/world-cards/skidmarks/loc_town_street_side_v1.png`
- `shows/skidmarks/world-cards/park.png`  ← local `data/crash/world-cards/skidmarks/park.png`
- `shows/skidmarks/world-cards/pavement_whack.png`  ← local `data/crash/world-cards/skidmarks/pavement_whack.png`
- `shows/skidmarks/world-cards/place_1786102458845.png`  ← local `data/crash/world-cards/skidmarks/place_1786102458845.png`
- `shows/skidmarks/world-cards/place_1786102473299.png`  ← local `data/crash/world-cards/skidmarks/place_1786102473299.png`
- `shows/skidmarks/world-cards/place_1786102488068.png`  ← local `data/crash/world-cards/skidmarks/place_1786102488068.png`
- `shows/skidmarks/world-cards/place_1786102499881.png`  ← local `data/crash/world-cards/skidmarks/place_1786102499881.png`
- `shows/skidmarks/world-cards/place_1786102536109.png`  ← local `data/crash/world-cards/skidmarks/place_1786102536109.png`
- `shows/skidmarks/world-cards/place_1786102550558.png`  ← local `data/crash/world-cards/skidmarks/place_1786102550558.png`
- `shows/skidmarks/world-cards/place_1786102563466.png`  ← local `data/crash/world-cards/skidmarks/place_1786102563466.png`
- `shows/skidmarks/world-cards/place_1786280272563.png`  ← local `data/crash/world-cards/skidmarks/place_1786280272563.png`
- `shows/skidmarks/world-cards/place_1786530674289.png`  ← local `data/crash/world-cards/skidmarks/place_1786530674289.png`
- `shows/skidmarks/world-cards/place_1786530681538.png`  ← local `data/crash/world-cards/skidmarks/place_1786530681538.png`
- `shows/skidmarks/world-cards/place_1786530688282.png`  ← local `data/crash/world-cards/skidmarks/place_1786530688282.png`
- `shows/skidmarks/world-cards/place_1786530695157.png`  ← local `data/crash/world-cards/skidmarks/place_1786530695157.png`
- `shows/skidmarks/world-cards/place_v3_bank_1786364976692.png`  ← local `data/crash/world-cards/skidmarks/place_v3_bank_1786364976692.png`
- `shows/skidmarks/world-cards/place_v3_cafe_1786364969464.png`  ← local `data/crash/world-cards/skidmarks/place_v3_cafe_1786364969464.png`
- `shows/skidmarks/world-cards/place_v3_depot_1786364990902.png`  ← local `data/crash/world-cards/skidmarks/place_v3_depot_1786364990902.png`
- `shows/skidmarks/world-cards/place_v3_flat_1786364953933.png`  ← local `data/crash/world-cards/skidmarks/place_v3_flat_1786364953933.png`
- `shows/skidmarks/world-cards/place_v3_shop_1786364984333.png`  ← local `data/crash/world-cards/skidmarks/place_v3_shop_1786364984333.png`
- `shows/skidmarks/world-cards/place_v3_street_1786364960666.png`  ← local `data/crash/world-cards/skidmarks/place_v3_street_1786364960666.png`
- `shows/skidmarks/world-cards/suburban_street_cafe.png`  ← local `data/crash/world-cards/skidmarks/suburban_street_cafe.png`
- `shows/skidmarks/world-cards/suburban_street_main.png`  ← local `data/crash/world-cards/skidmarks/suburban_street_main.png`

### sunny_banks (21)
- `shows/sunny_banks/world-cards/cliff_top_coast_path.png`  ← local `data/crash/world-cards/sunny_banks/cliff_top_coast_path.png`
- `shows/sunny_banks/world-cards/dap_bedroom.png`  ← local `data/crash/world-cards/sunny_banks/dap_bedroom.png`
- `shows/sunny_banks/world-cards/dirty_dog_pub.png`  ← local `data/crash/world-cards/sunny_banks/dirty_dog_pub.png`
- `shows/sunny_banks/world-cards/park.png`  ← local `data/crash/world-cards/sunny_banks/park.png`
- `shows/sunny_banks/world-cards/place_1786102618157.png`  ← local `data/crash/world-cards/sunny_banks/place_1786102618157.png`
- `shows/sunny_banks/world-cards/place_1786102631293.png`  ← local `data/crash/world-cards/sunny_banks/place_1786102631293.png`
- `shows/sunny_banks/world-cards/place_1786102649034.png`  ← local `data/crash/world-cards/sunny_banks/place_1786102649034.png`
- `shows/sunny_banks/world-cards/place_1786102663162.png`  ← local `data/crash/world-cards/sunny_banks/place_1786102663162.png`
- `shows/sunny_banks/world-cards/place_1786102677734.png`  ← local `data/crash/world-cards/sunny_banks/place_1786102677734.png`
- `shows/sunny_banks/world-cards/place_1786102692093.png`  ← local `data/crash/world-cards/sunny_banks/place_1786102692093.png`
- `shows/sunny_banks/world-cards/place_1786102706758.png`  ← local `data/crash/world-cards/sunny_banks/place_1786102706758.png`
- `shows/sunny_banks/world-cards/place_1786102720600.png`  ← local `data/crash/world-cards/sunny_banks/place_1786102720600.png`
- `shows/sunny_banks/world-cards/place_1786102741992.png`  ← local `data/crash/world-cards/sunny_banks/place_1786102741992.png`
- `shows/sunny_banks/world-cards/place_1786102757254.png`  ← local `data/crash/world-cards/sunny_banks/place_1786102757254.png`
- `shows/sunny_banks/world-cards/place_1786102772638.png`  ← local `data/crash/world-cards/sunny_banks/place_1786102772638.png`
- `shows/sunny_banks/world-cards/place_1786102793265.png`  ← local `data/crash/world-cards/sunny_banks/place_1786102793265.png`
- `shows/sunny_banks/world-cards/place_v3_cafe_1786364969464.png`  ← local `data/crash/world-cards/sunny_banks/place_v3_cafe_1786364969464.png`
- `shows/sunny_banks/world-cards/place_v3_depot_1786364990902.png`  ← local `data/crash/world-cards/sunny_banks/place_v3_depot_1786364990902.png`
- `shows/sunny_banks/world-cards/place_v3_flat_1786364953933.png`  ← local `data/crash/world-cards/sunny_banks/place_v3_flat_1786364953933.png`
- `shows/sunny_banks/world-cards/place_v3_hell_1786364997694.png`  ← local `data/crash/world-cards/sunny_banks/place_v3_hell_1786364997694.png`
- `shows/sunny_banks/world-cards/place_v3_street_1786364960666.png`  ← local `data/crash/world-cards/sunny_banks/place_v3_street_1786364960666.png`

## CAST faces → `shows/{show}/style-cards/{file}`

### skidmarks (41)
- `shows/skidmarks/style-cards/baby.png`  ← local `data/crash/style-cards/skidmarks/baby.png`
- `shows/skidmarks/style-cards/bank_teller.jpg`  ← local `data/crash/style-cards/skidmarks/bank_teller.jpg`
- `shows/skidmarks/style-cards/bird.png`  ← local `data/crash/style-cards/skidmarks/bird.png`
- `shows/skidmarks/style-cards/chloe.png`  ← local `data/crash/style-cards/skidmarks/chloe.png`
- `shows/skidmarks/style-cards/construction_worker.png`  ← local `data/crash/style-cards/skidmarks/construction_worker.png`
- `shows/skidmarks/style-cards/crackwhore_darryl.png`  ← local `data/crash/style-cards/skidmarks/crackwhore_darryl.png`
- `shows/skidmarks/style-cards/dad.png`  ← local `data/crash/style-cards/skidmarks/dad.png`
- `shows/skidmarks/style-cards/dap.png`  ← local `data/crash/style-cards/skidmarks/dap.png`
- `shows/skidmarks/style-cards/elderly_woman.png`  ← local `data/crash/style-cards/skidmarks/elderly_woman.png`
- `shows/skidmarks/style-cards/fuzz.png`  ← local `data/crash/style-cards/skidmarks/fuzz.png`
- `shows/skidmarks/style-cards/garrick.png`  ← local `data/crash/style-cards/skidmarks/garrick.png`
- `shows/skidmarks/style-cards/judge.png`  ← local `data/crash/style-cards/skidmarks/judge.png`
- `shows/skidmarks/style-cards/kim_the_gypsy_kunt.jpg`  ← local `data/crash/style-cards/skidmarks/kim_the_gypsy_kunt.jpg`
- `shows/skidmarks/style-cards/mr_right.png`  ← local `data/crash/style-cards/skidmarks/mr_right.png`
- `shows/skidmarks/style-cards/mum.png`  ← local `data/crash/style-cards/skidmarks/mum.png`
- `shows/skidmarks/style-cards/sarah.png`  ← local `data/crash/style-cards/skidmarks/sarah.png`
- `shows/skidmarks/style-cards/sharon.png`  ← local `data/crash/style-cards/skidmarks/sharon.png`
- `shows/skidmarks/style-cards/shop_cashier.jpg`  ← local `data/crash/style-cards/skidmarks/shop_cashier.jpg`
- `shows/skidmarks/style-cards/silas.png`  ← local `data/crash/style-cards/skidmarks/silas.png`
- `shows/skidmarks/style-cards/stranger.png`  ← local `data/crash/style-cards/skidmarks/stranger.png`
- `shows/skidmarks/style-cards/thumb_1786096758336.png`  ← local `data/crash/style-cards/skidmarks/thumb_1786096758336.png`
- `shows/skidmarks/style-cards/thumb_1786096809634.png`  ← local `data/crash/style-cards/skidmarks/thumb_1786096809634.png`
- `shows/skidmarks/style-cards/thumb_1786096829613.png`  ← local `data/crash/style-cards/skidmarks/thumb_1786096829613.png`
- `shows/skidmarks/style-cards/thumb_1786096854905.png`  ← local `data/crash/style-cards/skidmarks/thumb_1786096854905.png`
- `shows/skidmarks/style-cards/thumb_1786271377479.png`  ← local `data/crash/style-cards/skidmarks/thumb_1786271377479.png`
- `shows/skidmarks/style-cards/thumb_1786280528288.png`  ← local `data/crash/style-cards/skidmarks/thumb_1786280528288.png`
- `shows/skidmarks/style-cards/thumb_1786280548564.png`  ← local `data/crash/style-cards/skidmarks/thumb_1786280548564.png`
- `shows/skidmarks/style-cards/thumb_1786280614089.png`  ← local `data/crash/style-cards/skidmarks/thumb_1786280614089.png`
- `shows/skidmarks/style-cards/thumb_1786280877486.png`  ← local `data/crash/style-cards/skidmarks/thumb_1786280877486.png`
- `shows/skidmarks/style-cards/thumb_1786280950673.png`  ← local `data/crash/style-cards/skidmarks/thumb_1786280950673.png`
- `shows/skidmarks/style-cards/thumb_1786280983247.png`  ← local `data/crash/style-cards/skidmarks/thumb_1786280983247.png`
- `shows/skidmarks/style-cards/thumb_1786281213195.png`  ← local `data/crash/style-cards/skidmarks/thumb_1786281213195.png`
- `shows/skidmarks/style-cards/thumb_1786293763074.png`  ← local `data/crash/style-cards/skidmarks/thumb_1786293763074.png`
- `shows/skidmarks/style-cards/tom.jpg`  ← local `data/crash/style-cards/skidmarks/tom.jpg`
- `shows/skidmarks/style-cards/toms_brother.jpg`  ← local `data/crash/style-cards/skidmarks/toms_brother.jpg`
- `shows/skidmarks/style-cards/upload_1786528971520.png`  ← local `data/crash/style-cards/skidmarks/upload_1786528971520.png`
- `shows/skidmarks/style-cards/upload_1786529032984.png`  ← local `data/crash/style-cards/skidmarks/upload_1786529032984.png`
- `shows/skidmarks/style-cards/upload_1786529039337.png`  ← local `data/crash/style-cards/skidmarks/upload_1786529039337.png`
- `shows/skidmarks/style-cards/upload_1786529046125.png`  ← local `data/crash/style-cards/skidmarks/upload_1786529046125.png`
- `shows/skidmarks/style-cards/upload_1786531318070.jpg`  ← local `data/crash/style-cards/skidmarks/upload_1786531318070.jpg`
- `shows/skidmarks/style-cards/young_fiancee.jpg`  ← local `data/crash/style-cards/skidmarks/young_fiancee.jpg`

### sunny_banks (9)
- `shows/sunny_banks/style-cards/thumb_1786096652402.png`  ← local `data/crash/style-cards/sunny_banks/thumb_1786096652402.png`
- `shows/sunny_banks/style-cards/thumb_1786096667708.png`  ← local `data/crash/style-cards/sunny_banks/thumb_1786096667708.png`
- `shows/sunny_banks/style-cards/thumb_1786096687757.png`  ← local `data/crash/style-cards/sunny_banks/thumb_1786096687757.png`
- `shows/sunny_banks/style-cards/thumb_1786096703064.png`  ← local `data/crash/style-cards/sunny_banks/thumb_1786096703064.png`
- `shows/sunny_banks/style-cards/thumb_1786096716796.png`  ← local `data/crash/style-cards/sunny_banks/thumb_1786096716796.png`
- `shows/sunny_banks/style-cards/thumb_1786096739616.png`  ← local `data/crash/style-cards/sunny_banks/thumb_1786096739616.png`
- `shows/sunny_banks/style-cards/thumb_1786542758199.png`  ← local `data/crash/style-cards/sunny_banks/thumb_1786542758199.png`
- `shows/sunny_banks/style-cards/thumb_1786598798159.png`  ← local `data/crash/style-cards/sunny_banks/thumb_1786598798159.png`
- `shows/sunny_banks/style-cards/upload_1786598798946.png`  ← local `data/crash/style-cards/sunny_banks/upload_1786598798946.png`

## Plates referenced but not uploaded → `shows/{show}/episodes/{folder}/plates/{file}`

### sunny_banks/CURSOR_SUNNY_BANKS_3 (4)
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/plates/cplate_20260813144239506_h7d.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/plates/cplate_20260813144256063_fk1.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/plates/cplate_20260813144314079_rd7.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/plates/cplate_20260813144330307_st6.png`

### sunny_banks/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2 (16)
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155212875_5mt.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155225152_v9n.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155237370_wfg.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155251185_c2m.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155302536_yx8.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155315368_h0o.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155327900_uq7.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155339756_qcd.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155400297_0cj.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155431474_2cm.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155454802_9b9.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155509112_iwh.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155526017_eaz.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155539653_kn5.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155551953_abq.png`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_THE_FIRST_FLEET_2/plates/cplate_20260813155614805_e5a.png`

## Dialogue audio referenced but not uploaded → `shows/{show}/episodes/{folder}/audio/{file}`

### skidmarks/CURSOR_CLIVE_THE_CLIPBOARD_3 (10)
- `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/audio/01_01_Clive_the_Clipboard_Section-twelve-Moira-You've-been-loi_mspyamh2.mp3`
- `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/audio/01_02_Moira_from_Accounts_It's-a-bus-stop-Clive-Sit-down_mspyaqug.mp3`
- `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/audio/01_03_Clive_the_Clipboard_I'll-be-logging-this-In-triplicate_mspyasm0.mp3`
- `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/audio/02_02_Keith_the_Crossing_Guard_He-means-there's-nobody-here-love_mspyavlw.mp3`
- `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/audio/02_03_Clive_the_Clipboard_Silence-Keith-I'm-mid-enforcement_mspyawu1.mp3`
- `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/audio/03_01_Clive_the_Clipboard_Bay-fourteen-is-a-moral-hazard-I'm-i_mspyay3k.mp3`
- `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/audio/03_03_Clive_the_Clipboard_That's-harassment-of-an-officer-Note_mspyb1q7.mp3`
- `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/audio/04_01_Clive_the_Clipboard_You're-loitering-adjacent-to-waste-r_mspyb2z2.mp3`
- `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/audio/04_02_Young_Declan_Mate-Touch-grass-Or-a-bin-Either's-f_mspyb5g4.mp3`
- `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/audio/04_03_Clive_the_Clipboard_I'll-see-you-in-tribunal_mspyb6sn.mp3`

### skidmarks/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG (6)
- `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/audio/01_02_Kim_the_Gypsy_KUNT_You're-walking-like-you've-already-w.mp3`
- `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/audio/02_02_Kim_the_Gypsy_KUNT_I'm-going-to-need-a-stronger-drink-a.mp3`
- `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/audio/03_01_CrackWhore_Darryl_Soundcheck-One-two-that's-the-sound-.mp3`
- `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/audio/03_02_Kim_the_Gypsy_KUNT_That's-the-sound-of-a-man-arguing-wi.mp3`
- `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/audio/04_03_Kim_the_Gypsy_KUNT_DAP-just-said-everything-I'm-thinkin.mp3`
- `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/audio/05_02_Kim_the_Gypsy_KUNT_Someone-threw-a-plastic-chair-That's.mp3`

### skidmarks/CURSOR_THE_PROJECT_PITCH (12)
- `shows/skidmarks/episodes/CURSOR_THE_PROJECT_PITCH/audio/01_01_DAP_It-is-a-simple-pivot-table-Kim-thoug.mp3`
- `shows/skidmarks/episodes/CURSOR_THE_PROJECT_PITCH/audio/01_02_Kim_the_Gypsy_KUNT_I-wrote-the-macro-for-that-spreadshe.mp3`
- `shows/skidmarks/episodes/CURSOR_THE_PROJECT_PITCH/audio/01_03_Garry_Crump_Let's-keep-it-professional-team-the-.mp3`
- `shows/skidmarks/episodes/CURSOR_THE_PROJECT_PITCH/audio/02_01_DAP_Data-architecture-requires-a-masculi.mp3`
- `shows/skidmarks/episodes/CURSOR_THE_PROJECT_PITCH/audio/02_02_Kim_the_Gypsy_KUNT_You-haven't-even-cleared-the-formatt.mp3`
- `shows/skidmarks/episodes/CURSOR_THE_PROJECT_PITCH/audio/02_03_Jesusexe_Actually-DAP-has-a-point-about-the-s.mp3`
- `shows/skidmarks/episodes/CURSOR_THE_PROJECT_PITCH/audio/03_01_Garry_Crump_Wait-a-minute-DAP-you've-deleted-the.mp3`
- `shows/skidmarks/episodes/CURSOR_THE_PROJECT_PITCH/audio/03_02_Jesusexe_Oh-wow-that-is-an-absolute-bin-fire-.mp3`
- `shows/skidmarks/episodes/CURSOR_THE_PROJECT_PITCH/audio/03_03_DAP_It-was-a-streamlined-omission-to-max.mp3`
- `shows/skidmarks/episodes/CURSOR_THE_PROJECT_PITCH/audio/04_01_Kim_the_Gypsy_KUNT_You-just-erased-our-biggest-contract.mp3`
- `shows/skidmarks/episodes/CURSOR_THE_PROJECT_PITCH/audio/04_02_DAP_stammers-The-algorithm-will-vindicat.mp3`
- `shows/skidmarks/episodes/CURSOR_THE_PROJECT_PITCH/audio/04_03_Garry_Crump_Security-is-on-their-way-down-DAP.mp3`

### skidmarks/EP03_KIM_THE_KUNT (9)
- `shows/skidmarks/episodes/EP03_KIM_THE_KUNT/audio/05_01_Sharon_You're-a-weapon-babe-if-he's-that-so.mp3`
- `shows/skidmarks/episodes/EP03_KIM_THE_KUNT/audio/08_01_Bank_Teller_Of-course-Mrs-I'll-process-that-now-.mp3`
- `shows/skidmarks/episodes/EP03_KIM_THE_KUNT/audio/09_01_Kim_the_Gypsy_KUNT_Don't-you-Mrs-me-Move-faster-I've-go.mp3`
- `shows/skidmarks/episodes/EP03_KIM_THE_KUNT/audio/11_01_Shop_Cashier_Sorry-yeah-I'll-void-it-and-redo-it-.mp3`
- `shows/skidmarks/episodes/EP03_KIM_THE_KUNT/audio/14_01_Tom's_Brother_And-that-right-there-is-a-small-toke.mp3`
- `shows/skidmarks/episodes/EP03_KIM_THE_KUNT/audio/22_01_Kim_the_Gypsy_KUNT_Tom-babe-look-at-me-I-know-I've-been_msoewkqv.mp3`
- `shows/skidmarks/episodes/EP03_KIM_THE_KUNT/audio/24_01_Tom_No-We're-done-Kim-Here's-your-final-_msof16ae.mp3`
- `shows/skidmarks/episodes/EP03_KIM_THE_KUNT/audio/23_01_Kim_the_Gypsy_KUNT_No-no-this-isn't-I-was-winning-I-was.mp3`
- `shows/skidmarks/episodes/EP03_KIM_THE_KUNT/audio/26_01_Narrator_The-universe-doesn't-balance-its-boo.mp3`

### skidmarks/EP04_DEEP_FRIED_GOES_TO_SCHOOL (15)
- `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/audio/01_01_Deep_Fried_Terry_Brittany's-school-Fresh-faces-Untapp.mp3`
- `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/audio/01_02_Custard_You're-going-to-get-expelled-and-you.mp3`
- `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/audio/01_03_Deep_Fried_Terry_That's-the-spirit-Custard-Grab-your-.mp3`
- `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/audio/02_01_Brittany_Year11_Dad's-mate-is-not-a-career-day-speak.mp3`
- `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/audio/02_02_Deep_Fried_Terry_Relax-I'm-networking-Very-educationa.mp3`
- `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/audio/02_03_Brittany_Year11_If-Mum-finds-you-here-I'm-changing-m.mp3`
- `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/audio/03_01_Shazza_Crack_He's-at-Brittany's-school-Of-course-.mp3`
- `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/audio/03_03_Bin_Bag_Barry_I-paid-already-Please-don't-make-it-.mp3`
- `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/audio/04_01_Marcus_Velvet_School-gate's-amateur-hour-Come-to-T.mp3`
- `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/audio/04_02_Trina_Afterhours_After-party-flat's-already-sticky-Yo.mp3`
- `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/audio/05_02_Trina_Afterhours_Don't-sit-on-that-sofa-Or-do-I'm-pas.mp3`
- `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/audio/06_01_Brittany_Year11_You-came-BACK-With-glitter-It's-Tues.mp3`
- `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/audio/06_03_Brittany_Year11_I'm-ringing-Shazza-She'll-collect-yo.mp3`
- `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/audio/07_03_Custard_The-school-rang-Brittany's-mum-used-.mp3`
- `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/audio/08_01_Shazza_Crack_School-Club-Flat-House-You're-a-tour.mp3`

### sunny_banks/CURSOR_SUNNY_BANKS (4)
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS/audio/01_02_Shazza_It's-a-dirty-dam-Nuggets-Calm-down_msr1t42h.mp3`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS/audio/03_03_Nan_Put-it-down-Darren-Tea's-on-Bat's-re_msr1thgp.mp3`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS/audio/04_02_Shazza_He's-hiding-from-a-lawnmower-Bazza_msr1tktc.mp3`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS/audio/04_03_Ranger_Bazza_Unlicensed-panic-That's-a-fine_msr1tmmv.mp3`

### sunny_banks/CURSOR_SUNNY_BANKS_2 (5)
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_2/audio/01_01_Nuggets_hat's-the-mothership-pad-They're-lan_msq8mvrg.mp3`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_2/audio/01_02_Shazza_It's-a-dirty-dam-Nuggets-Calm-down_msq6c0dr.mp3`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_2/audio/03_03_Nan_Put-it-down-Darren-Tea's-on-Bat's-re_msq6ccg1.mp3`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_2/audio/04_02_Shazza_He's-hiding-from-a-lawnmower-Bazza_msq6cftw.mp3`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_2/audio/04_03_Ranger_Bazza_Unlicensed-panic-That's-a-fine_msq6cha4.mp3`

### sunny_banks/CURSOR_SUNNY_BANKS_3 (4)
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/audio/01_02_Shazza_It's-a-dirty-dam-Nuggets-Calm-down_msr2btd1.mp3`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/audio/03_03_Nan_Put-it-down-Darren-Tea's-on-Bat's-re_msr2c3hd.mp3`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/audio/04_02_Shazza_He's-hiding-from-a-lawnmower-Bazza_msr2c67i.mp3`
- `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/audio/04_03_Ranger_Bazza_Unlicensed-panic-That's-a-fine_msr2c7kc.mp3`

## SFX references (no SFX objects in Blob yet)

Each row shows the story's SFX reference. `spxId` points at a shelf item whose filename lives
in the local `data/crash/spx/{show}/manifest.json` (needed to resolve id→file). `audioFile`
is a per-episode upload under `data/crash/story/{show}/sfx/`.

### skidmarks/CURSOR_CLIVE_THE_CLIPBOARD_3 (8)
- "Bus shelter rattle"  spxId=spx_xxcy227 audioFile=sfx_1786530861181.mp3 → `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/sfx/sfx_1786530861181.mp3`
- "Clipboard slap"  spxId=spx_uw14e4g audioFile=sfx_1786530863720.mp3 → `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/sfx/sfx_1786530863720.mp3`
- "Fryer spit"  spxId=spx_4n4kpc0 audioFile=sfx_1786530865962.mp3 → `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/sfx/sfx_1786530865962.mp3`
- "Door chime"  spxId=spx_x2tc9fd audioFile=sfx_1786530867664.mp3 → `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/sfx/sfx_1786530867664.mp3`
- "Car park wind"  spxId=spx_pc9aklg audioFile=sfx_1786530869756.mp3 → `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/sfx/sfx_1786530869756.mp3`
- "Pen scratch"  spxId=spx_gccfmuw audioFile=sfx_1786530872184.mp3 → `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/sfx/sfx_1786530872184.mp3`
- "Bin lid"  spxId=spx_1n51els audioFile=sfx_1786530874384.mp3 → `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/sfx/sfx_1786530874384.mp3`
- "Foot scrape"  spxId=spx_rnop62v audioFile=sfx_1786530876688.mp3 → `shows/skidmarks/episodes/CURSOR_CLIVE_THE_CLIPBOARD_3/sfx/sfx_1786530876688.mp3`

### skidmarks/CURSOR_PARISH_OF_STAFF (9)
- "Organ fart"  spxId=spx_lym1mmh audioFile=sfx_ps_intro_1.mp3 → `shows/skidmarks/episodes/CURSOR_PARISH_OF_STAFF/sfx/sfx_ps_intro_1.mp3`
- "Collection plate rattle"  spxId=spx_8ma7i2j audioFile=sfx_ps_intro_2.mp3 → `shows/skidmarks/episodes/CURSOR_PARISH_OF_STAFF/sfx/sfx_ps_intro_2.mp3`
- "Amen slam"  spxId=spx_6k6sr84 audioFile=sfx_ps_outro_1.mp3 → `shows/skidmarks/episodes/CURSOR_PARISH_OF_STAFF/sfx/sfx_ps_outro_1.mp3`
- "Hall echo cough"  spxId=spx_pq310g0 audioFile=sfx_ps_01_1.mp3 → `shows/skidmarks/episodes/CURSOR_PARISH_OF_STAFF/sfx/sfx_ps_01_1.mp3`
- "Phone notification"  spxId=spx_wwhwwhs audioFile=sfx_ps_01_2.mp3 → `shows/skidmarks/episodes/CURSOR_PARISH_OF_STAFF/sfx/sfx_ps_01_2.mp3`
- "Plastic plate shake"  spxId=spx_xpz8ug6 audioFile=sfx_ps_02_1.mp3 → `shows/skidmarks/episodes/CURSOR_PARISH_OF_STAFF/sfx/sfx_ps_02_1.mp3`
- "Wind in stone courtyard"  spxId=spx_8ax0s7o audioFile=sfx_ps_02_2.mp3 → `shows/skidmarks/episodes/CURSOR_PARISH_OF_STAFF/sfx/sfx_ps_02_2.mp3`
- "Shoe squeak on marble"  spxId=spx_ijwlrj6 audioFile=sfx_ps_03_1.mp3 → `shows/skidmarks/episodes/CURSOR_PARISH_OF_STAFF/sfx/sfx_ps_03_1.mp3`
- "Awkward silence sting"  spxId=spx_v95hchz audioFile=sfx_ps_03_2.mp3 → `shows/skidmarks/episodes/CURSOR_PARISH_OF_STAFF/sfx/sfx_ps_03_2.mp3`

### skidmarks/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG (15)
- "Theme sting"  spxId=spx_pi4p4qc audioFile=sfx_tn_intro_theme.mp3 → `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/sfx/sfx_tn_intro_theme.mp3`
- "Title whoosh"  spxId=spx_fc6mc9f audioFile=sfx_tn_intro_whoosh.mp3 → `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/sfx/sfx_tn_intro_whoosh.mp3`
- "Sting out"  spxId=spx_ql84a6o audioFile=sfx_tn_outro_sting.mp3 → `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/sfx/sfx_tn_outro_sting.mp3`
- "Street footsteps"  spxId=spx_9ex8q8h audioFile=sfx_tn_01_1.mp3 → `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/sfx/sfx_tn_01_1.mp3`
- "Distant traffic"  spxId=spx_xr77i6n audioFile=sfx_tn_01_2.mp3 → `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/sfx/sfx_tn_01_2.mp3`
- "Pub murmur"  spxId=spx_tc1yqpf audioFile=sfx_tn_02_1.mp3 → `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/sfx/sfx_tn_02_1.mp3`
- "Glass put down"  spxId=spx_nzpm0p4 audioFile=sfx_tn_02_2.mp3 → `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/sfx/sfx_tn_02_2.mp3`
- "Mic feedback"  spxId=spx_lxfv4h7 audioFile=sfx_tn_03_1.mp3 → `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/sfx/sfx_tn_03_1.mp3`
- "Chair scrape"  spxId=spx_1z4h7pf audioFile=sfx_tn_03_2.mp3 → `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/sfx/sfx_tn_03_2.mp3`
- "Crisp packet"  spxId=spx_fkvhn51 audioFile=sfx_tn_04_1.mp3 → `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/sfx/sfx_tn_04_1.mp3`
- "Hall hush"  spxId=spx_suo3zlo audioFile=sfx_tn_04_2.mp3 → `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/sfx/sfx_tn_04_2.mp3`
- "Chair clatter"  spxId=spx_9p6t003 audioFile=sfx_tn_05_1.mp3 → `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/sfx/sfx_tn_05_1.mp3`
- "Garden night air"  spxId=spx_2fg9r0a audioFile=sfx_tn_05_2.mp3 → `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/sfx/sfx_tn_05_2.mp3`
- "Bed creak"  spxId=spx_3jf1b5l audioFile=sfx_tn_06_1.mp3 → `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/sfx/sfx_tn_06_1.mp3`
- "Light switch"  spxId=spx_rjeix6m audioFile=sfx_tn_06_2.mp3 → `shows/skidmarks/episodes/CURSOR_TALENT_NIGHT_AT_THE_DIRTY_DOG/sfx/sfx_tn_06_2.mp3`

### skidmarks/CURSOR_THE_PROJECT_PITCH (11)
- "Theme sting"  spxId=spx_9sdiago audioFile=- → `shows/skidmarks/spx/sfx/<file for spx_9sdiago>`
- "Title whoosh"  spxId=spx_4usw0eg audioFile=- → `shows/skidmarks/spx/sfx/<file for spx_4usw0eg>`
- "Sting out"  spxId=spx_0gv7j71 audioFile=- → `shows/skidmarks/spx/sfx/<file for spx_0gv7j71>`
- "Keyboard clatter click"  spxId=spx_qie5xu7 audioFile=- → `shows/skidmarks/spx/sfx/<file for spx_qie5xu7>`
- "Fluorescent light buzz"  spxId=spx_d29bj07 audioFile=- → `shows/skidmarks/spx/sfx/<file for spx_d29bj07>`
- "Photocopier whir grind"  spxId=spx_dbnwhju audioFile=- → `shows/skidmarks/spx/sfx/<file for spx_dbnwhju>`
- "Coffee mug desk tap"  spxId=spx_ijlfy0b audioFile=- → `shows/skidmarks/spx/sfx/<file for spx_ijlfy0b>`
- "Paper rustle sharp"  spxId=spx_jwlnxus audioFile=- → `shows/skidmarks/spx/sfx/<file for spx_jwlnxus>`
- "Low office murmur"  spxId=spx_p18miiz audioFile=- → `shows/skidmarks/spx/sfx/<file for spx_p18miiz>`
- "Dramatic office sting"  spxId=spx_f72gbw5 audioFile=- → `shows/skidmarks/spx/sfx/<file for spx_f72gbw5>`
- "Security badge swipe clunk"  spxId=spx_pxqq5oh audioFile=- → `shows/skidmarks/spx/sfx/<file for spx_pxqq5oh>`

### skidmarks/EP03_KIM_THE_KUNT (13)
- "wet footsteps"  spxId=- audioFile=- → `(label only — needs a sound)`
- "wet footsteps"  spxId=- audioFile=- → `(label only — needs a sound)`
- "wet footsteps"  spxId=- audioFile=- → `(label only — needs a sound)`
- "wet footsteps"  spxId=- audioFile=- → `(label only — needs a sound)`
- "cafe murmur"  spxId=- audioFile=- → `(label only — needs a sound)`
- "wet footsteps"  spxId=- audioFile=- → `(label only — needs a sound)`
- "cafe murmur"  spxId=- audioFile=- → `(label only — needs a sound)`
- "cafe murmur"  spxId=- audioFile=- → `(label only — needs a sound)`
- "bus hiss"  spxId=- audioFile=- → `(label only — needs a sound)`
- "shop beep"  spxId=- audioFile=- → `(label only — needs a sound)`
- "wet footsteps"  spxId=- audioFile=- → `(label only — needs a sound)`
- "hell rumble"  spxId=- audioFile=- → `(label only — needs a sound)`
- "hell rumble"  spxId=- audioFile=- → `(label only — needs a sound)`

### skidmarks/EP04_DEEP_FRIED_GOES_TO_SCHOOL (19)
- "Theme sting"  spxId=spx_zk922wh audioFile=sfx_intro_theme.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_intro_theme.mp3`
- "Title whoosh"  spxId=spx_nvvjkt0 audioFile=sfx_intro_whoosh.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_intro_whoosh.mp3`
- "Sting out"  spxId=spx_2bfo7p9 audioFile=sfx_outro_sting.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_outro_sting.mp3`
- "Door slam"  spxId=spx_q3aylw6 audioFile=sfx_df_01_1.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_01_1.mp3`
- "Dump room ambience"  spxId=spx_8pob0ui audioFile=sfx_df_01_2.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_01_2.mp3`
- "School bell"  spxId=spx_j2q37hk audioFile=sfx_df_02_1.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_02_1.mp3`
- "Corridor footsteps"  spxId=spx_sz85lro audioFile=sfx_df_02_2.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_02_2.mp3`
- "Alley drip"  spxId=spx_5iqylqa audioFile=sfx_df_03_1.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_03_1.mp3`
- "Distant traffic"  spxId=spx_1utqnrg audioFile=sfx_df_03_2.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_03_2.mp3`
- "Club thump"  spxId=spx_8senpu6 audioFile=sfx_df_04_1.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_04_1.mp3`
- "Glass clink"  spxId=spx_mwc3o39 audioFile=sfx_df_04_2.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_04_2.mp3`
- "Flat party murk"  spxId=spx_lxith20 audioFile=sfx_df_05_1.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_05_1.mp3`
- "Bottle roll"  spxId=spx_pi617yy audioFile=sfx_df_05_2.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_05_2.mp3`
- "School bell"  spxId=spx_vvpgzv2 audioFile=sfx_df_06_1.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_06_1.mp3`
- "Locker slam"  spxId=spx_bqtwo0o audioFile=sfx_df_06_2.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_06_2.mp3`
- "Dump room ambience"  spxId=spx_ajt6z4s audioFile=sfx_df_07_1.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_07_1.mp3`
- "Phone buzz"  spxId=spx_6wlstqx audioFile=sfx_df_07_2.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_07_2.mp3`
- "Alley drip"  spxId=spx_g8wmdqb audioFile=sfx_df_08_1.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_08_1.mp3`
- "Distant traffic"  spxId=spx_g0wyc0j audioFile=sfx_df_08_2.mp3 → `shows/skidmarks/episodes/EP04_DEEP_FRIED_GOES_TO_SCHOOL/sfx/sfx_df_08_2.mp3`

### sunny_banks/CURSOR_SUNNY_BANKS (8)
- "Dam flies"  spxId=spx_v8ha95b audioFile=sfx_1786597168670.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS/sfx/sfx_1786597168670.mp3`
- "Pie wrap"  spxId=spx_3qm5h84 audioFile=sfx_1786597170357.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS/sfx/sfx_1786597170357.mp3`
- "Washer spin"  spxId=spx_76hsfwd audioFile=sfx_1786597172746.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS/sfx/sfx_1786597172746.mp3`
- "Coin reject"  spxId=spx_67cxw87 audioFile=sfx_1786597175461.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS/sfx/sfx_1786597175461.mp3`
- "Hair dryer"  spxId=spx_e5ositw audioFile=sfx_1786597177609.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS/sfx/sfx_1786597177609.mp3`
- "Teacup set"  spxId=spx_xt1pjca audioFile=sfx_1786597179832.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS/sfx/sfx_1786597179832.mp3`
- "Shed door"  spxId=spx_q4fmal4 audioFile=sfx_1786597181546.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS/sfx/sfx_1786597181546.mp3`
- "Clipboard tick"  spxId=spx_8i7w3ne audioFile=sfx_1786597183282.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS/sfx/sfx_1786597183282.mp3`

### sunny_banks/CURSOR_SUNNY_BANKS_2 (8)
- "Dam flies"  spxId=spx_zmed07n audioFile=sfx_1786544307447.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_2/sfx/sfx_1786544307447.mp3`
- "Pie wrap"  spxId=spx_nuyygj4 audioFile=sfx_1786544309453.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_2/sfx/sfx_1786544309453.mp3`
- "Washer spin"  spxId=spx_lekrc0j audioFile=sfx_1786544311610.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_2/sfx/sfx_1786544311610.mp3`
- "Coin reject"  spxId=spx_8lqydmh audioFile=sfx_1786544313327.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_2/sfx/sfx_1786544313327.mp3`
- "Hair dryer"  spxId=spx_yxa2vhn audioFile=sfx_1786544315122.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_2/sfx/sfx_1786544315122.mp3`
- "Teacup set"  spxId=spx_3ruryh5 audioFile=sfx_1786544317344.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_2/sfx/sfx_1786544317344.mp3`
- "Shed door"  spxId=spx_41wev5l audioFile=sfx_1786544319033.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_2/sfx/sfx_1786544319033.mp3`
- "Clipboard tick"  spxId=spx_k98duvk audioFile=sfx_1786544320813.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_2/sfx/sfx_1786544320813.mp3`

### sunny_banks/CURSOR_SUNNY_BANKS_3 (8)
- "Dam flies"  spxId=spx_yjmib7t audioFile=sfx_1786598051814.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/sfx/sfx_1786598051814.mp3`
- "Pie wrap"  spxId=spx_fqx8r7b audioFile=sfx_1786598053952.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/sfx/sfx_1786598053952.mp3`
- "Washer spin"  spxId=spx_g9b6y4w audioFile=sfx_1786598056167.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/sfx/sfx_1786598056167.mp3`
- "Coin reject"  spxId=spx_4qubz20 audioFile=sfx_1786598058111.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/sfx/sfx_1786598058111.mp3`
- "Hair dryer"  spxId=spx_moux7s4 audioFile=sfx_1786598060100.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/sfx/sfx_1786598060100.mp3`
- "Teacup set"  spxId=spx_upmsem1 audioFile=sfx_1786598062183.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/sfx/sfx_1786598062183.mp3`
- "Shed door"  spxId=spx_w5ov5jn audioFile=sfx_1786598063940.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/sfx/sfx_1786598063940.mp3`
- "Clipboard tick"  spxId=spx_87wwy79 audioFile=sfx_1786598065723.mp3 → `shows/sunny_banks/episodes/CURSOR_SUNNY_BANKS_3/sfx/sfx_1786598065723.mp3`
