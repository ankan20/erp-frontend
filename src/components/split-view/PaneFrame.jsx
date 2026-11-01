"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GripVertical,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCw,
  Undo2,
  X,
} from "lucide-react";
import { getBreadcrumbs } from "@/lib/breadcrumbs";
import { MESSAGE_KEY, PANE_NAME_PREFIX, splitActions } from "./splitStore";

export const titleFor = (url) => {
  const crumbs = getBreadcrumbs(url || "");
  return crumbs.length ? crumbs.slice(-2).join(" › ") : url;
};

// free-window resize handles: edge → css
const HANDLES = [
  ["n", "top-0 left-2 right-2 h-1.5 cursor-ns-resize"],
  ["s", "bottom-0 left-2 right-2 h-1.5 cursor-ns-resize"],
  ["w", "left-0 top-2 bottom-2 w-1.5 cursor-ew-resize"],
  ["e", "right-0 top-2 bottom-2 w-1.5 cursor-ew-resize"],
  ["nw", "top-0 left-0 h-3 w-3 cursor-nwse-resize"],
  ["ne", "top-0 right-0 h-3 w-3 cursor-nesw-resize"],
  ["sw", "bottom-0 left-0 h-3 w-3 cursor-nesw-resize"],
  ["se", "bottom-0 right-0 h-4 w-4 cursor-nwse-resize"],
];

function IconBtn({ label, onClick, disabled, children, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/90 hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent ${
        danger ? "hover:bg-red-500/80" : ""
      }`}
    >
      {children}
    </button>
  );
}

/** One extra window: a title bar + the real page loaded in a frame. */
export default function PaneFrame({
  pane,
  index,
  count,
  floating,
  maximized,
  hidden,
  dimmed,
  style,
  elRef,
  onSwap,
  onHeaderPointerDown,
  onResizeStart,
}) {
  const [loaded, setLoaded] = useState(false);
  const frameRef = useRef(null);

  // a new src means a new load
  const [loadedSrc, setLoadedSrc] = useState(pane.src);
  if (loadedSrc !== pane.src) {
    setLoadedSrc(pane.src);
    setLoaded(false);
  }

  // the page inside says "ready" once it has switched to window mode
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || !e.data?.[MESSAGE_KEY]) return;
      if (e.source !== frameRef.current?.contentWindow) return;
      if (e.data.type === "ready") setLoaded(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // fallback: if the page never says "ready" (e.g. login page), stop the spinner
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setLoaded(true), 8000);
    return () => clearTimeout(t);
  }, [loaded, pane.src]);

  const title = titleFor(pane.url);

  return (
    <section
      ref={elRef}
      aria-label={`Split window: ${title}`}
      onPointerDownCapture={() => floating && splitActions.bringToFront(pane.id)}
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden border border-[#6d9dc5] bg-white ${floating ? "rounded-md shadow-2xl" : ""} ${
        dimmed ? "opacity-50" : ""
      }`}
      style={{ ...style, display: hidden ? "none" : "flex" }}
    >
      <header
        className={`flex h-7 shrink-0 select-none items-center gap-0.5 bg-[#144664] px-1 text-white ${maximized ? "" : "cursor-grab active:cursor-grabbing"}`}
        onPointerDown={(e) => {
          if (maximized || e.button !== 0 || e.target.closest("button")) return;
          onHeaderPointerDown(e, pane.id);
        }}
        title={maximized ? undefined : floating ? "Drag to move" : "Drag onto another window to swap places"}
      >
        {!maximized && <GripVertical className="h-3.5 w-3.5 shrink-0 text-white/60" aria-hidden="true" />}
        <span className="min-w-0 flex-1 truncate px-1 text-[12px] font-medium" title={pane.url}>
          {title}
        </span>
        <IconBtn
          label="Back"
          onClick={() => {
            try {
              frameRef.current?.contentWindow?.history.back();
            } catch {
              /* ignore */
            }
          }}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label="Reload" onClick={() => splitActions.reloadPane(pane.id)}>
          <RotateCw className="h-3.5 w-3.5" />
        </IconBtn>
        {!floating && !maximized && count > 1 && (
          <>
            <IconBtn label="Move earlier" disabled={index === 0} onClick={() => splitActions.movePane(pane.id, -1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Move later" disabled={index === count - 1} onClick={() => splitActions.movePane(pane.id, 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </IconBtn>
          </>
        )}
        <IconBtn label="Swap with main page" onClick={() => onSwap(pane)}>
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label={maximized ? "Restore" : "Maximise"} onClick={() => splitActions.toggleMaximize(pane.id)}>
          {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </IconBtn>
        <IconBtn label="Open in new browser tab" onClick={() => window.open(pane.url, "_blank", "noopener")}>
          <ExternalLink className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label="Close window" danger onClick={() => splitActions.closePane(pane.id)}>
          <X className="h-4 w-4" />
        </IconBtn>
      </header>

      <div className="relative min-h-0 flex-1">
        <iframe
          ref={frameRef}
          name={`${PANE_NAME_PREFIX}${pane.id}`}
          src={pane.src}
          title={title}
          onLoad={() => setTimeout(() => setLoaded(true), 1500)}
          className="absolute inset-0 h-full w-full border-0 bg-[#f5f5f5]"
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#f5f5f5]">
            <Loader2 className="h-6 w-6 animate-spin text-[#2f6f9f]" />
          </div>
        )}
      </div>

      {floating &&
        !maximized &&
        HANDLES.map(([edge, cls]) => (
          <div
            key={edge}
            aria-hidden="true"
            onPointerDown={(e) => e.button === 0 && onResizeStart(e, pane.id, edge)}
            className={`absolute z-10 ${cls}`}
          />
        ))}
    </section>
  );
}
