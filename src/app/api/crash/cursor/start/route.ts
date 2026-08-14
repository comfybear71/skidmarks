import { NextResponse } from "next/server";
import {
  createCursorEpisodePack,
  resumeCursorEpisodePack,
} from "@/lib/cursorPackCreate";
import { readActivePack } from "@/lib/crashActivePack";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { crashLabShowFolderName } from "@/lib/showArchivePaths";
import {
  CURSOR_ORIGINAL_ARSEHOLE,
  CURSOR_ORIGINAL_CAST,
  CURSOR_ORIGINAL_PLACES,
} from "@/lib/cursorOriginalKit";
import { sunnyBanksCursorKit } from "@/lib/cursorSunnyBanksKit";
import { startSunnyBanksCursorPack } from "@/lib/cursorSunnyBanksStart";
import {
  hydrateShowShelfManifests,
  persistCursorPackToCloud,
} from "@/lib/cursorCloudSync";

export const runtime = "nodejs";

/**
 * POST { styleId, resume?: boolean, folderName?: string }
 * Skidmarks — Clive CURSOR pack (resume CURSOR_CLIVE… OK).
 * Sunny Banks — new CURSOR_SUNNY_BANKS pack, gallery faces, never Clive.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      resume?: boolean;
      folderName?: string;
    };
    const styleId = parseStyleCardId(body.styleId || "skidmarks");
    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }

    // Vercel has no local shelf — mirror World/Cast names from Neon first so
    // the resolvers below can find real places and cast. No-op locally.
    await hydrateShowShelfManifests(styleId);

    if (styleId === "sunny_banks") {
      const named = String(body.folderName || "").trim();
      if (named.startsWith("CURSOR_") && !/CLIVE/i.test(named)) {
        try {
          const resumed = resumeCursorEpisodePack({
            styleId,
            folderName: named,
          });
          const kit = sunnyBanksCursorKit();
          const castN = (resumed.sceneKit.castKeys || []).filter(Boolean).length;
          const worldN = (resumed.sceneKit.worldKeys || []).filter(Boolean)
            .length;
          const facesReady =
            Boolean(resumed.sceneKit.arseholeKey) && castN >= 4 && worldN >= 4;
          await persistCursorPackToCloud({
            styleId,
            folderName: resumed.folderName,
            story: resumed.story,
            sceneKit: resumed.sceneKit,
          });
          return NextResponse.json({
            ok: true,
            resumed: true,
            facesReady,
            folderName: resumed.folderName,
            path: `MY MOVIES\\${crashLabShowFolderName(styleId)}\\_CRASH_LAB\\${resumed.folderName}`,
            story: resumed.story,
            sceneKit: resumed.sceneKit,
            kit,
            arseholeKey: resumed.sceneKit.arseholeKey || "",
            castKeys: resumed.sceneKit.castKeys || [],
            worldKeys: resumed.sceneKit.worldKeys || [],
          });
        } catch {
          /* fall through to new pack */
        }
      }
      const started = startSunnyBanksCursorPack();
      await persistCursorPackToCloud({
        styleId,
        folderName: started.folderName,
        story: started.story,
        sceneKit: started.sceneKit,
      });
      return NextResponse.json({
        ok: true,
        resumed: false,
        facesReady: started.facesReady,
        folderName: started.folderName,
        path: `MY MOVIES\\${crashLabShowFolderName(styleId)}\\_CRASH_LAB\\${started.folderName}`,
        story: started.story,
        sceneKit: started.sceneKit,
        kit: started.kit,
        arseholeKey: started.arseholeKey,
        castKeys: started.castKeys,
        worldKeys: started.worldKeys,
      });
    }

    const kit = {
      arsehole: CURSOR_ORIGINAL_ARSEHOLE,
      cast: CURSOR_ORIGINAL_CAST,
      places: CURSOR_ORIGINAL_PLACES,
    };

    const wantResume = Boolean(body.resume);
    const named = String(body.folderName || "").trim();
    const active = readActivePack();
    const resumeTarget =
      named ||
      (wantResume &&
      active?.styleId === styleId &&
      active?.folderName?.startsWith("CURSOR_")
        ? active.folderName
        : "");

    if (resumeTarget) {
      const resumed = resumeCursorEpisodePack({
        styleId,
        folderName: resumeTarget,
      });
      const facesReady =
        Boolean(resumed.sceneKit.arseholeKey) &&
        (resumed.sceneKit.castKeys || []).filter(Boolean).length >= 4;
      await persistCursorPackToCloud({
        styleId,
        folderName: resumed.folderName,
        story: resumed.story,
        sceneKit: resumed.sceneKit,
      });
      return NextResponse.json({
        ok: true,
        resumed: true,
        facesReady,
        folderName: resumed.folderName,
        path: `MY MOVIES\\${crashLabShowFolderName(styleId)}\\_CRASH_LAB\\${resumed.folderName}`,
        story: resumed.story,
        sceneKit: resumed.sceneKit,
        kit,
      });
    }

    const created = createCursorEpisodePack({ styleId });
    await persistCursorPackToCloud({
      styleId,
      folderName: created.folderName,
      story: created.story,
      sceneKit: created.sceneKit,
    });
    return NextResponse.json({
      ok: true,
      resumed: false,
      facesReady: false,
      folderName: created.folderName,
      path: `MY MOVIES\\${crashLabShowFolderName(styleId)}\\_CRASH_LAB\\${created.folderName}`,
      story: created.story,
      sceneKit: created.sceneKit,
      kit,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
