"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CrashLabCollapseBtn } from "@/components/CrashLabCollapseBtn";
import {
  CRASH_DESK_LAYOUT_VER,
  CRASH_STRIP_H,
  px,
  type CrashPanelId,
} from "@/lib/crashDeskLayout";
import { useCrashDeskMode } from "@/hooks/useCrashDeskMode";
import { usePanelPointerDrag } from "@/hooks/usePanelPointerDrag";
import {
  CRASH_PANEL_MIN_H,
  CRASH_PANEL_MIN_W,
  CRASH_PANEL_SUBTITLE_COL,
  CRASH_PANEL_TITLE_BAR,
  CRASH_PANEL_TITLE_COL,
} from "@/lib/crashLabPanel";
import { bumpCrashLabZ } from "@/lib/crashLabZ";

export type CardGeom = { x: number; y: number; w: number; h: number };

type Props = {
  title: string;
  subtitle?: string;
  titleClassName?: string;
  layoutVerKey: string;
  panelId: CrashPanelId;
  minW?: number;
  minH?: number;
  visible?: boolean;
  defaultZ?: number;
  children: ReactNode;
};

export function CrashLabFloatingPanel({
  title,
  subtitle,
  titleClassName = "text-[var(--magenta-hot)]",
  layoutVerKey,
  panelId,
  minW = CRASH_PANEL_MIN_W,
  minH = CRASH_PANEL_MIN_H,
  visible = true,
  defaultZ = 40,
  children,
}: Props) {
  const {
    geom,
    deskReady,
    collapsed,
    mode,
    togglePanel,
    setGeom,
    hideOnNarrowStack,
  } = useCrashDeskMode(panelId, { minW, minH });
  const [cardReady, setCardReady] = useState(true);
  const [z, setZ] = useState(40);

  useEffect(() => {
    try {
      if (localStorage.getItem(layoutVerKey) !== CRASH_DESK_LAYOUT_VER) {
        localStorage.setItem(layoutVerKey, CRASH_DESK_LAYOUT_VER);
      }
    } catch {
      /* ignore */
    }
    setZ(defaultZ > 40 ? defaultZ : bumpCrashLabZ());
    setCardReady(true);
  }, [defaultZ, layoutVerKey]);

  const bringFront = useCallback(() => {
    setZ(bumpCrashLabZ());
  }, []);

  const { startMove, startResize } = usePanelPointerDrag({
    geom,
    setGeom,
    minW,
    minH,
    bringFront,
  });

  if (!visible || hideOnNarrowStack) return null;

  return (
    <div
      className="fixed"
      data-crash-panel={panelId}
      style={{
        left: px(geom.x),
        top: px(geom.y),
        width: px(geom.w),
        height: px(collapsed ? CRASH_STRIP_H : geom.h),
        zIndex: z,
      }}
      onPointerDown={bringFront}
    >
      <div
        className="relative flex h-full flex-col overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel)] shadow-lg"
        style={{ width: px(geom.w), height: collapsed ? px(CRASH_STRIP_H) : "100%" }}
      >
        <div
          className={`${CRASH_PANEL_TITLE_BAR} touch-none`}
          onPointerDown={startMove}
        >
          <h2 className={`${CRASH_PANEL_TITLE_COL} ${titleClassName}`}>
            {title}
          </h2>
          {subtitle ? (
            <span className={CRASH_PANEL_SUBTITLE_COL}>{subtitle}</span>
          ) : (
            <span className="flex-1" />
          )}
          <CrashLabCollapseBtn
            collapsed={collapsed}
            deskStacked={mode === "stack" || mode === "free"}
            freeFlow={mode === "free"}
            onToggle={togglePanel}
          />
        </div>

        {!collapsed ? (
          <div
            className="crash-panel-body min-h-0 flex-1 overflow-y-scroll overflow-x-hidden p-2 pb-6"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {children}
          </div>
        ) : (
          /* Keep mounted so Send-all / in-flight LTX survives switching panels */
          <div className="hidden" aria-hidden>
            {children}
          </div>
        )}

        {!collapsed ? (
          <>
            <div
              className="crash-resize-handle touch-none pointer-events-auto absolute bottom-0 right-0 z-30 h-5 w-5 cursor-se-resize"
              onPointerDown={startResize("se")}
              title="Drag to resize"
            />
            <div
              className="crash-resize-handle touch-none pointer-events-auto absolute bottom-0 left-0 z-30 h-5 w-5 cursor-sw-resize"
              onPointerDown={startResize("sw")}
            />
            <div
              className="crash-resize-handle touch-none pointer-events-auto absolute top-0 right-0 z-30 h-5 w-5 cursor-ne-resize"
              onPointerDown={startResize("ne")}
            />
            <div
              className="crash-resize-handle touch-none pointer-events-auto absolute top-0 left-0 z-30 h-5 w-5 cursor-nw-resize"
              onPointerDown={startResize("nw")}
            />
            {/* Fat bottom grab — height resize (move = title bar) */}
            <div
              className="crash-resize-handle touch-none pointer-events-auto absolute bottom-0 left-0 right-0 z-30 flex h-3 cursor-s-resize items-end justify-center bg-gradient-to-t from-black/35 to-transparent"
              onPointerDown={startResize("s")}
              title="Drag to resize height"
            >
              <span className="mb-0.5 h-0.5 w-10 rounded-full bg-[var(--acid)]/70" />
            </div>
            <div
              className="crash-resize-handle touch-none pointer-events-auto absolute top-0 left-5 right-5 z-30 h-3 cursor-n-resize"
              onPointerDown={startResize("n")}
            />
            {/* Side grips only mid-edge — full-height strips steal the scrollbar */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-30 flex w-3 items-center">
              <div
                className="crash-resize-handle touch-none pointer-events-auto h-14 w-full cursor-w-resize"
                onPointerDown={startResize("w")}
                title="Drag to resize width"
              />
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 z-30 flex w-3 items-center justify-end">
              <div
                className="crash-resize-handle touch-none pointer-events-auto h-14 w-full cursor-e-resize"
                onPointerDown={startResize("e")}
                title="Drag to resize width"
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
