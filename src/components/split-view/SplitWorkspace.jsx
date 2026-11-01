"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Columns2, Rows2, LayoutGrid, AppWindow, Equal, Plus, X, GripVertical, Layers } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MAIN, MAX_PANES, MESSAGE_KEY, currentUrl, gridDims, splitActions, useSplitState } from "./splitStore";
import PaneFrame, { titleFor } from "./PaneFrame";
import OpenInSplitDialog from "./OpenInSplitDialog";

const GAP = 6; // px between tiled windows (the drag bars sit in the gap)
const MIN_SHARE = 0.08; // a track never gets smaller than 8 % of the space
const MIN_FLOAT_W = 220; // px
const MIN_FLOAT_H = 140; // px
const SWAP_START_PX = 6; // drag distance before a swap-drag starts

const LAYOUT_BUTTONS = [
  ["row", "Side by side", Columns2],
  ["column", "Stacked", Rows2],
  ["grid", "Grid", LayoutGrid],
  ["float", "Free", AppWindow],
];

// narrow screens: windows are always stacked
const narrowQuery = "(max-width: 767px)";
const subscribeNarrow = (cb) => {
  const m = window.matchMedia(narrowQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useNarrow = () => useSyncExternalStore(subscribeNarrow, () => window.matchMedia(narrowQuery).matches, () => false);

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const sum = (a) => a.reduce((x, y) => x + y, 0);

/** Pixel offsets of the gaps between tracks (for the drag bars). */
function barOffsets(weights, size) {
  const avail = size - GAP * (weights.length - 1);
  const total = sum(weights);
  const out = [];
  let pos = 0;
  for (let i = 0; i < weights.length - 1; i++) {
    pos += (avail * weights[i]) / total;
    out.push(pos + GAP * i);
  }
  return { offsets: out, avail };
}

/**
 * Wraps the page content. With no extra windows the page renders in the same
 * place as before. The page element is never moved in the DOM (only styled),
 * so opening, moving or resizing windows never reloads the current page.
 */
export default function SplitWorkspace({ children, disabled = false }) {
  const split = useSplitState();
  const router = useRouter();
  const narrow = useNarrow();
  const areaRef = useRef(null);
  const mainRef = useRef(null);
  const paneEls = useRef(new Map());
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState(null);
  const [swapPane, setSwapPane] = useState(null);

  // inside a window (frame) there is no nested split view
  const panes = disabled ? [] : split.panes;
  const active = panes.length > 0;
  const layout = narrow ? "column" : split.layout;
  const floating = active && layout === "float";
  const maximized = panes.some((p) => p.id === split.maximized) ? split.maximized : null;
  const order = active ? split.order : [MAIN];
  const dims = gridDims(layout, order.length);
  const tracksOk = split.cols.length === dims.cols && split.rows.length === dims.rows;
  const cols = tracksOk ? split.cols : Array(dims.cols).fill(1);
  const rows = tracksOk ? split.rows : Array(dims.rows).fill(1);

  // messages from windows: navigation inside a window, "open another window"
  useEffect(() => {
    if (disabled) return;
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || !e.data?.[MESSAGE_KEY]) return;
      const { type, paneId, url } = e.data;
      if (type === "navigated" && paneId) splitActions.paneNavigated(paneId, url);
      if (type === "open-picker") splitActions.openPicker(paneId || null);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [disabled]);

  // area size (for drag bars and free windows)
  useEffect(() => {
    if (!active || !areaRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setArea({ w: r.width, h: r.height });
    });
    ro.observe(areaRef.current);
    return () => ro.disconnect();
  }, [active]);

  // ── one pointer handler for every kind of drag ─────────────────
  const elFor = (id) => (id === MAIN ? mainRef.current : paneEls.current.get(id));
  const targetAt = (x, y, exclude) => {
    for (const id of order) {
      if (id === exclude) continue;
      const el = elFor(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { id, rect: r };
    }
    return null;
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      if (drag.kind === "track") {
        const weights = [...drag.weights];
        const total = sum(weights);
        const delta = ((drag.axis === "col" ? dx : dy) / drag.avail) * total;
        const a = weights[drag.i];
        const b = weights[drag.i + 1];
        const min = total * MIN_SHARE;
        const na = clamp(a + delta, min, a + b - min);
        weights[drag.i] = na;
        weights[drag.i + 1] = a + b - na;
        if (drag.axis === "col") splitActions.setTracks(weights, drag.other);
        else splitActions.setTracks(drag.other, weights);
      } else if (drag.kind === "move") {
        const r = drag.rect0;
        splitActions.setFloat(drag.id, {
          ...r,
          x: clamp(r.x + dx / drag.W, 0.1 - r.w, 0.95),
          y: clamp(r.y + dy / drag.H, 0, 0.95),
        });
      } else if (drag.kind === "resize") {
        const r = drag.rect0;
        const minW = Math.min(MIN_FLOAT_W / drag.W, 0.9);
        const minH = Math.min(MIN_FLOAT_H / drag.H, 0.9);
        let { x, y, w, h } = r;
        const fx = dx / drag.W;
        const fy = dy / drag.H;
        if (drag.edge.includes("e")) w = clamp(r.w + fx, minW, 1 - r.x);
        if (drag.edge.includes("s")) h = clamp(r.h + fy, minH, 1 - r.y);
        if (drag.edge.includes("w")) {
          const nx = clamp(r.x + fx, 0, r.x + r.w - minW);
          w = r.w + (r.x - nx);
          x = nx;
        }
        if (drag.edge.includes("n")) {
          const ny = clamp(r.y + fy, 0, r.y + r.h - minH);
          h = r.h + (r.y - ny);
          y = ny;
        }
        splitActions.setFloat(drag.id, { x, y, w, h });
      } else if (drag.kind === "swap") {
        const started = drag.started || Math.hypot(dx, dy) > SWAP_START_PX;
        const target = started ? targetAt(e.clientX, e.clientY, drag.id) : null;
        setDrag((d) => (d ? { ...d, started, x: e.clientX, y: e.clientY, target } : d));
      }
    };
    const onUp = () => {
      if (drag.kind === "swap" && drag.started && drag.target) splitActions.swapPositions(drag.id, drag.target.id);
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // targetAt reads refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  const startTrack = (e, axis, i) => {
    e.preventDefault();
    const size = axis === "col" ? area.w : area.h;
    const weights = axis === "col" ? cols : rows;
    setDrag({
      kind: "track",
      axis,
      i,
      sx: e.clientX,
      sy: e.clientY,
      weights: [...weights],
      other: axis === "col" ? [...rows] : [...cols],
      avail: Math.max(1, barOffsets(weights, size).avail),
    });
  };

  const onHeaderPointerDown = (e, id) => {
    e.preventDefault();
    if (floating) {
      const pane = panes.find((p) => p.id === id);
      setDrag({ kind: "move", id, sx: e.clientX, sy: e.clientY, rect0: pane.float, W: area.w || 1, H: area.h || 1 });
    } else {
      setDrag({ kind: "swap", id, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, started: false, target: null });
    }
  };

  const onResizeStart = (e, id, edge) => {
    e.preventDefault();
    e.stopPropagation();
    const pane = panes.find((p) => p.id === id);
    setDrag({ kind: "resize", id, edge, sx: e.clientX, sy: e.clientY, rect0: pane.float, W: area.w || 1, H: area.h || 1 });
  };

  const confirmSwap = () => {
    const pane = swapPane;
    setSwapPane(null);
    if (!pane) return;
    splitActions.setPaneUrl(pane.id, currentUrl());
    router.push(pane.url);
  };

  // ── styles ──────────────────────────────────────────────────
  const tiled = active && !floating && !maximized;
  let areaStyle;
  if (maximized) areaStyle = { display: "flex", position: "relative" };
  else if (floating) areaStyle = { position: "relative" };
  else if (active)
    areaStyle = {
      display: "grid",
      position: "relative",
      gap: GAP,
      gridTemplateColumns: cols.map((f) => `minmax(0, ${f}fr)`).join(" "),
      gridTemplateRows: rows.map((f) => `minmax(0, ${f}fr)`).join(" "),
    };

  let mainStyle;
  if (maximized) mainStyle = { display: "none" };
  else if (floating) mainStyle = { position: "absolute", inset: 0 };
  else if (active) mainStyle = { order: order.indexOf(MAIN), outline: "1px solid #b5c7d8" };

  const paneStyle = (pane) => {
    if (maximized === pane.id) return { flex: "1 1 0%" };
    if (floating) {
      const f = pane.float;
      return {
        position: "absolute",
        left: `${f.x * 100}%`,
        top: `${f.y * 100}%`,
        width: `${f.w * 100}%`,
        height: `${f.h * 100}%`,
        zIndex: 10 + split.zOrder.indexOf(pane.id),
      };
    }
    return { order: order.indexOf(pane.id) };
  };

  const colBars = tiled ? barOffsets(cols, area.w).offsets : [];
  const rowBars = tiled ? barOffsets(rows, area.h).offsets : [];
  const dragTitle = drag?.kind === "swap" ? (drag.id === MAIN ? "Main page" : titleFor(panes.find((p) => p.id === drag.id)?.url)) : "";

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {active && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[#b5c7d8] bg-[#e8f2ff] px-2 py-1 text-[12px] text-[#144664]">
          <span className="font-semibold">Split view</span>
          <span className="text-gray-600">· {panes.length + 1} windows</span>
          {tiled && (
            <button
              type="button"
              onPointerDown={(e) => e.button === 0 && onHeaderPointerDown(e, MAIN)}
              className="inline-flex cursor-grab items-center gap-1 rounded border border-dashed border-[#6d9dc5] bg-white px-2 py-0.5 active:cursor-grabbing"
              title="Drag onto a window to swap places with the main page"
            >
              <GripVertical className="h-3.5 w-3.5" /> Main page
            </button>
          )}
          <span className="ml-auto inline-flex overflow-hidden rounded border border-[#6d9dc5]">
            {!narrow &&
              LAYOUT_BUTTONS.map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => splitActions.setLayout(key)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 ${layout === key ? "bg-[#144664] text-white" : "bg-white hover:bg-[#f0f6ff]"}`}
                  aria-pressed={layout === key}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
          </span>
          {floating ? (
            <button type="button" onClick={splitActions.cascade} className="inline-flex items-center gap-1 rounded border border-[#6d9dc5] bg-white px-2 py-0.5 hover:bg-[#f0f6ff]">
              <Layers className="h-3.5 w-3.5" /> Cascade
            </button>
          ) : (
            <button type="button" onClick={splitActions.equalize} className="inline-flex items-center gap-1 rounded border border-[#6d9dc5] bg-white px-2 py-0.5 hover:bg-[#f0f6ff]">
              <Equal className="h-3.5 w-3.5" /> Equal sizes
            </button>
          )}
          <button
            type="button"
            onClick={() => splitActions.openPicker()}
            disabled={panes.length >= MAX_PANES}
            className="inline-flex items-center gap-1 rounded border border-[#6d9dc5] bg-white px-2 py-0.5 hover:bg-[#f0f6ff] disabled:opacity-40"
            title={panes.length >= MAX_PANES ? `Up to ${MAX_PANES} extra windows` : "Open another window"}
          >
            <Plus className="h-3.5 w-3.5" /> Add window
          </button>
          <button type="button" onClick={splitActions.closeAll} className="inline-flex items-center gap-1 rounded border border-red-300 bg-white px-2 py-0.5 text-red-700 hover:bg-red-50">
            <X className="h-3.5 w-3.5" /> Close split
          </button>
        </div>
      )}

      <div ref={areaRef} className="flex min-h-0 min-w-0 flex-1" style={areaStyle}>
        {/* main page — always the first child, never moved */}
        <div
          ref={mainRef}
          className={active ? "min-h-0 min-w-0 overflow-auto bg-[#f5f5f5]" : "flex-1 overflow-auto"}
          style={mainStyle}
        >
          {children}
        </div>

        {active &&
          panes.map((pane) => (
            <Fragment key={pane.id}>
              <PaneFrame
                pane={pane}
                index={order.indexOf(pane.id)}
                count={order.length}
                floating={floating && maximized !== pane.id}
                maximized={maximized === pane.id}
                hidden={!!maximized && maximized !== pane.id}
                dimmed={drag?.kind === "swap" && drag.started && drag.id === pane.id}
                style={paneStyle(pane)}
                elRef={(el) => (el ? paneEls.current.set(pane.id, el) : paneEls.current.delete(pane.id))}
                onSwap={setSwapPane}
                onHeaderPointerDown={onHeaderPointerDown}
                onResizeStart={onResizeStart}
              />
            </Fragment>
          ))}

        {/* drag bars between columns / rows (tiled layouts) */}
        {colBars.map((left, i) => (
          <div
            key={`c${i}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Drag to resize columns"
            onPointerDown={(e) => startTrack(e, "col", i)}
            onDoubleClick={splitActions.equalize}
            className="absolute top-0 bottom-0 z-20 cursor-col-resize bg-[#b5c7d8] hover:bg-[#2f6f9f]"
            style={{ left, width: GAP }}
          />
        ))}
        {rowBars.map((top, i) => (
          <div
            key={`r${i}`}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Drag to resize rows"
            onPointerDown={(e) => startTrack(e, "row", i)}
            onDoubleClick={splitActions.equalize}
            className="absolute left-0 right-0 z-20 cursor-row-resize bg-[#b5c7d8] hover:bg-[#2f6f9f]"
            style={{ top, height: GAP }}
          />
        ))}
      </div>

      {/* while dragging, a cover stops the windows (frames) from swallowing the mouse */}
      {drag && (
        <div
          className={`fixed inset-0 z-[80] ${
            drag.kind === "track" ? (drag.axis === "col" ? "cursor-col-resize" : "cursor-row-resize") : drag.kind === "resize" ? "cursor-nwse-resize" : "cursor-grabbing"
          }`}
        >
          {drag.kind === "swap" && drag.started && (
            <>
              {drag.target && (
                <div
                  className="pointer-events-none fixed rounded-md border-2 border-dashed border-amber-400 bg-amber-200/30"
                  style={{ left: drag.target.rect.left, top: drag.target.rect.top, width: drag.target.rect.width, height: drag.target.rect.height }}
                >
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-amber-500 px-2 py-1 text-[12px] font-semibold text-white shadow">
                    Drop to swap places
                  </span>
                </div>
              )}
              <div
                className="pointer-events-none fixed rounded bg-[#144664] px-2 py-1 text-[12px] font-medium text-white shadow-lg"
                style={{ left: drag.x + 12, top: drag.y + 12 }}
              >
                {dragTitle}
              </div>
            </>
          )}
        </div>
      )}

      <AlertDialog open={!!swapPane} onOpenChange={(v) => !v && setSwapPane(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px]">Swap with main page</AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              The two pages change content and both reload. Anything typed but not saved in them will be lost. (To only
              change places, drag the window instead.)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[12px] h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwap} className="text-[12px] h-8 bg-blue-600 hover:bg-blue-700">
              Swap
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!disabled && <OpenInSplitDialog />}
    </div>
  );
}
