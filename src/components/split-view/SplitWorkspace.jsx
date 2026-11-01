"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Columns2, Rows2, Equal, Plus, X } from "lucide-react";
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
import { MAX_PANES, MESSAGE_KEY, currentUrl, splitActions, useSplitState } from "./splitStore";
import PaneFrame from "./PaneFrame";
import OpenInSplitDialog from "./OpenInSplitDialog";

const MIN_SHARE = 0.12; // a window never gets smaller than 12 % of the space

// narrow screens: windows are always stacked
const narrowQuery = "(max-width: 767px)";
const subscribeNarrow = (cb) => {
  const m = window.matchMedia(narrowQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useNarrow = () => useSyncExternalStore(subscribeNarrow, () => window.matchMedia(narrowQuery).matches, () => false);

/**
 * Wraps the page content. With no extra windows it renders the page exactly in
 * the same place as before; the page element is never moved, so opening or
 * closing windows does not reload the current page.
 */
export default function SplitWorkspace({ children, disabled = false }) {
  const split = useSplitState();
  const router = useRouter();
  const narrow = useNarrow();
  const areaRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [swapPane, setSwapPane] = useState(null);

  // inside a window (frame) there is no nested split view
  const panes = disabled ? [] : split.panes;
  const active = panes.length > 0;
  const dir = narrow ? "column" : split.dir;
  const maximized = panes.some((p) => p.id === split.maximized) ? split.maximized : null;

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

  // ── resize by dragging the bar between two windows ───────────────
  const startDrag = (e, leftIndex) => {
    e.preventDefault();
    const rect = areaRef.current.getBoundingClientRect();
    setDrag({
      leftIndex,
      start: dir === "row" ? e.clientX : e.clientY,
      areaSize: dir === "row" ? rect.width : rect.height,
      sizes: [...split.sizes],
    });
  };
  useEffect(() => {
    if (!drag) return;
    const total = drag.sizes.reduce((a, b) => a + b, 0);
    const min = total * MIN_SHARE;
    const onMove = (e) => {
      const pos = dir === "row" ? e.clientX : e.clientY;
      const delta = ((pos - drag.start) / drag.areaSize) * total;
      const a = drag.sizes[drag.leftIndex];
      const b = drag.sizes[drag.leftIndex + 1];
      const na = Math.min(Math.max(a + delta, min), a + b - min);
      const sizes = [...drag.sizes];
      sizes[drag.leftIndex] = na;
      sizes[drag.leftIndex + 1] = a + b - na;
      splitActions.setSizes(sizes);
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, dir]);

  const confirmSwap = () => {
    const pane = swapPane;
    setSwapPane(null);
    if (!pane) return;
    const mainUrl = currentUrl();
    splitActions.setPaneUrl(pane.id, mainUrl);
    router.push(pane.url);
  };

  const weight = (i) => split.sizes[i] ?? 1;
  const flexFor = (i) => `${weight(i)} 1 0%`;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {active && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[#b5c7d8] bg-[#e8f2ff] px-2 py-1 text-[12px] text-[#144664]">
          <span className="font-semibold">Split view</span>
          <span className="text-gray-600">· {panes.length + 1} windows</span>
          <span className="ml-auto inline-flex overflow-hidden rounded border border-[#6d9dc5]">
            {!narrow && (
              <>
                <button
                  type="button"
                  onClick={() => splitActions.setDir("row")}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 ${dir === "row" ? "bg-[#144664] text-white" : "bg-white hover:bg-[#f0f6ff]"}`}
                  aria-pressed={dir === "row"}
                >
                  <Columns2 className="h-3.5 w-3.5" /> Side by side
                </button>
                <button
                  type="button"
                  onClick={() => splitActions.setDir("column")}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 ${dir === "column" ? "bg-[#144664] text-white" : "bg-white hover:bg-[#f0f6ff]"}`}
                  aria-pressed={dir === "column"}
                >
                  <Rows2 className="h-3.5 w-3.5" /> Stacked
                </button>
              </>
            )}
          </span>
          <button type="button" onClick={splitActions.equalize} className="inline-flex items-center gap-1 rounded border border-[#6d9dc5] bg-white px-2 py-0.5 hover:bg-[#f0f6ff]">
            <Equal className="h-3.5 w-3.5" /> Equal sizes
          </button>
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

      <div ref={areaRef} className="flex min-h-0 min-w-0 flex-1" style={{ flexDirection: dir }}>
        {/* main page — always the first child, never moved */}
        <div
          className={active ? "min-h-0 min-w-0 overflow-auto" : "flex-1 overflow-auto"}
          style={active ? { flex: flexFor(0), order: 0, display: maximized ? "none" : undefined } : undefined}
        >
          {children}
        </div>

        {active &&
          panes.map((pane) => (
            <Fragment key={pane.id}>
              {/* drag bar between this window and the one before it */}
              <div
                role="separator"
                aria-orientation={dir === "row" ? "vertical" : "horizontal"}
                aria-label="Drag to resize"
                onPointerDown={(e) => startDrag(e, pane.pos)}
                onDoubleClick={splitActions.equalize}
                className={`shrink-0 bg-[#b5c7d8] hover:bg-[#2f6f9f] ${dir === "row" ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize"}`}
                style={{ order: pane.pos * 2 + 1, display: maximized ? "none" : undefined }}
              />
              <PaneFrame
                pane={pane}
                count={panes.length}
                dir={dir}
                maximized={maximized === pane.id}
                hidden={!!maximized && maximized !== pane.id}
                style={{ flex: maximized === pane.id ? "1 1 0%" : flexFor(pane.pos + 1), order: pane.pos * 2 + 2 }}
                onSwap={setSwapPane}
              />
            </Fragment>
          ))}
      </div>

      {/* while dragging, a cover stops the windows from swallowing the mouse */}
      {drag && <div className={`fixed inset-0 z-[80] ${dir === "row" ? "cursor-col-resize" : "cursor-row-resize"}`} />}

      <AlertDialog open={!!swapPane} onOpenChange={(v) => !v && setSwapPane(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px]">Swap with main page</AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              The two pages change places and both reload. Anything typed but not saved in them will be lost.
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
