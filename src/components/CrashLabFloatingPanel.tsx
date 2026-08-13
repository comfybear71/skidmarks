"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { CrashLabCollapseBtn } from "@/components/CrashLabCollapseBtn";
import {
  CRASH_DESK_LAYOUT_VER,
  CRASH_STRIP_H,
  px,
  type CrashPanelId,
} from "@/lib/crashDeskLayout";
import { useCrashDeskMode } from "@/hooks/useCrashDeskMode";
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
  const { geom, deskReady, collapsed, mode, togglePanel, setGeom } =
    useCrashDeskMode(panelId);
  const [cardReady, setCardReady] = useState(true);
  const [z, setZ] = useState(40);
  const moveRef = useRef<{
    mode: "move" | "resize";
    edge?: string;
    startX: number;
    startY: number;
    orig: CardGeom;
  } | null>(null);

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

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!moveRef.current) return;
      const { mode, edge, startX, startY, orig } = moveRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (mode === "move") {
        setGeom({
          ...orig,
          x: Math.max(0, orig.x + dx),
          y: Math.max(0, orig.y + dy),
        });
        return;
      }
      let { x, y, w, h } = orig;
      if (edge?.includes("e")) w = Math.max(minW, orig.w + dx);
      if (edge?.includes("s")) h = Math.max(minH, orig.h + dy);
      if (edge?.includes("w")) {
        w = Math.max(minW, orig.w - dx);
        x = orig.x + (orig.w - w);
      }
      if (edge?.includes("n")) {
        h = Math.max(minH, orig.h - dy);
        y = orig.y + (orig.h - h);
      }
      setGeom({ x: Math.max(0, x), y: Math.max(0, y), w, h });
    };
    const onUp = () => {
      moveRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [minH, minW, setGeom]);

  const bringFront = useCallback(() => {
    setZ(bumpCrashLabZ());
  }, []);

  const startMove = useCallback(
    (e: ReactMouseEvent) => {
      if ((e.target as HTMLElement).closest("button, select, textarea, input, a"))
        return;
      bringFront();
      e.preventDefault();
      moveRef.current = {
        mode: "move",
        startX: e.clientX,
        startY: e.clientY,
        orig: geom,
      };
    },
    [geom, bringFront],
  );

  function startResize(edge: string) {
    return (e: ReactMouseEvent) => {
      bringFront();
      e.preventDefault();
      e.stopPropagation();
      moveRef.current = {
        mode: "resize",
        edge,
        startX: e.clientX,
        startY: e.clientY,
        orig: geom,
      };
    };
  }

  if (!visible) return null;

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
      onMouseDown={bringFront}
    >
      <div
        className="relative flex h-full flex-col overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel)] shadow-lg"
        style={{ width: px(geom.w), height: collapsed ? px(CRASH_STRIP_H) : "100%" }}
      >
        <div className={CRASH_PANEL_TITLE_BAR} onMouseDown={startMove}>
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
              className="pointer-events-auto absolute bottom-0 right-0 z-30 h-5 w-5 cursor-se-resize"
              onMouseDown={startResize("se")}
              title="Drag to resize"
            />
            <div
              className="pointer-events-auto absolute bottom-0 left-0 z-30 h-5 w-5 cursor-sw-resize"
              onMouseDown={startResize("sw")}
            />
            <div
              className="pointer-events-auto absolute top-0 right-0 z-30 h-5 w-5 cursor-ne-resize"
              onMouseDown={startResize("ne")}
            />
            <div
              className="pointer-events-auto absolute top-0 left-0 z-30 h-5 w-5 cursor-nw-resize"
              onMouseDown={startResize("nw")}
            />
            {/* Fat bottom grab — height resize (move = title bar) */}
            <div
              className="pointer-events-auto absolute bottom-0 left-0 right-0 z-30 flex h-3 cursor-s-resize items-end justify-center bg-gradient-to-t from-black/35 to-transparent"
              onMouseDown={startResize("s")}
              title="Drag to resize height"
            >
              <span className="mb-0.5 h-0.5 w-10 rounded-full bg-[var(--acid)]/70" />
            </div>
            <div
              className="pointer-events-auto absolute top-0 left-5 right-5 z-30 h-3 cursor-n-resize"
              onMouseDown={startResize("n")}
            />
            {/* Side grips only mid-edge — full-height strips steal the scrollbar */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-30 flex w-3 items-center">
              <div
                className="pointer-events-auto h-14 w-full cursor-w-resize"
                onMouseDown={startResize("w")}
                title="Drag to resize width"
              />
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 z-30 flex w-3 items-center justify-end">
              <div
                className="pointer-events-auto h-14 w-full cursor-e-resize"
                onMouseDown={startResize("e")}
                title="Drag to resize width"
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
